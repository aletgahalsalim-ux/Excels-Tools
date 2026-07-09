#!/usr/bin/env bash
# End-to-end smoke test (doc phase 11):
# register -> create project -> upload fixture with planted errors ->
# wait for pipeline -> assert planted findings exist -> generate & download DOCX.
#
# Prereqs: API on $API_URL, excel-analyzer on :8100, postgres+redis running.
set -euo pipefail

API_URL="${API_URL:-http://localhost:3001/api/v1}"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

say() { printf '\n\033[1;36m== %s\033[0m\n' "$*"; }
fail() { printf '\033[1;31mFAIL: %s\033[0m\n' "$*"; exit 1; }

command -v jq >/dev/null || fail "jq is required"

say "1/6 generate fixture workbook (planted: unbalanced BS, circular ref, hardcoded number)"
PYTHON="${PYTHON:-python3}"
if [ -x "$(dirname "$0")/../services/excel-analyzer/.venv/bin/python" ]; then
  PYTHON="$(dirname "$0")/../services/excel-analyzer/.venv/bin/python"
fi
"$PYTHON" "$(dirname "$0")/make-fixture.py" "$WORKDIR/fixture.xlsx"

say "2/6 register user + create project"
EMAIL="smoke-$(date +%s)@e2e.local"
TOKEN=$(curl -sf "$API_URL/auth/register" -H 'Content-Type: application/json' -d "{
  \"email\": \"$EMAIL\", \"password\": \"smoke-pass-123\",
  \"name\": \"Smoke Tester\", \"organizationName\": \"Smoke Org\"
}" | jq -r .accessToken)
[ -n "$TOKEN" ] && [ "$TOKEN" != null ] || fail "registration returned no token"

PROJECT_ID=$(curl -sf "$API_URL/projects" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"name":"Smoke Project"}' | jq -r .id)

say "3/6 upload workbook"
FILE_ID=$(curl -sf "$API_URL/projects/$PROJECT_ID/files" -H "Authorization: Bearer $TOKEN" \
  -F "file=@$WORKDIR/fixture.xlsx" | jq -r .id)
echo "file: $FILE_ID"

say "4/6 wait for pipeline"
for _ in $(seq 1 60); do
  STATUS=$(curl -sf "$API_URL/files/$FILE_ID/status" -H "Authorization: Bearer $TOKEN" | jq -r .status)
  echo "  status: $STATUS"
  case "$STATUS" in
    completed) break ;;
    failed) fail "pipeline failed: $(curl -sf "$API_URL/files/$FILE_ID/status" -H "Authorization: Bearer $TOKEN" | jq -r .errorMessage)" ;;
  esac
  sleep 2
done
[ "$STATUS" = completed ] || fail "pipeline did not complete in time"

say "5/6 assert planted findings"
RESULTS=$(curl -sf "$API_URL/files/$FILE_ID/results" -H "Authorization: Bearer $TOKEN")
echo "$RESULTS" | jq -r '.[] | "\(.severity)\t\(.ruleKey)\t\(.message)"'
echo "$RESULTS" | jq -e 'map(select(.ruleKey == "balance_sheet_balance" and .severity == "error")) | length >= 1' >/dev/null \
  || fail "planted balance-sheet error was not detected"
echo "$RESULTS" | jq -e 'map(select(.ruleKey == "anomaly:circular_reference")) | length >= 1' >/dev/null \
  || fail "planted circular reference was not detected"
echo "$RESULTS" | jq -e 'map(select(.ruleKey == "anomaly:hardcoded_number")) | length >= 1' >/dev/null \
  || fail "planted hardcoded number was not detected"

say "6/6 generate + download DOCX (ar) and HTML (en)"
DOC=$(curl -sf "$API_URL/files/$FILE_ID/documents" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"format":"docx","language":"ar"}')
URL=$(echo "$DOC" | jq -r .downloadUrl)
curl -sf "http://localhost:3001$URL" -H "Authorization: Bearer $TOKEN" -o "$WORKDIR/report-ar.docx"
SIZE=$(stat -c%s "$WORKDIR/report-ar.docx")
[ "$SIZE" -gt 5000 ] || fail "DOCX suspiciously small ($SIZE bytes)"
file "$WORKDIR/report-ar.docx" | grep -qi 'Microsoft Word\|Zip' || fail "not a DOCX file"

HTML_DOC=$(curl -sf "$API_URL/files/$FILE_ID/documents" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"format":"html","language":"en"}')
HTML_URL=$(echo "$HTML_DOC" | jq -r .downloadUrl)
curl -sf "http://localhost:3001$HTML_URL" -H "Authorization: Bearer $TOKEN" -o "$WORKDIR/report-en.html"
grep -q 'Financial Validation Report' "$WORKDIR/report-en.html" || fail "HTML report missing validation section"

printf '\n\033[1;32mE2E SMOKE PASSED\033[0m — DOCX %s bytes, findings verified.\n' "$SIZE"
