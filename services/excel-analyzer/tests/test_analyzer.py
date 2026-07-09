import json
from pathlib import Path

import jsonschema

from app.engine.analyzer import analyze_workbook

SCHEMA_PATH = (
    Path(__file__).resolve().parents[3]
    / "packages"
    / "shared"
    / "schemas"
    / "analysis-result.schema.json"
)


def test_analysis_result_matches_shared_contract(balanced_model):
    result = analyze_workbook(str(balanced_model), "balanced_model.xlsx")
    schema = json.loads(SCHEMA_PATH.read_text())
    jsonschema.validate(result, schema)  # raises on contract drift

    assert result["workbook"]["sheetCount"] == 2
    assert result["stats"]["totalDetectedTables"] == 3
    assert result["workbook"]["namedRanges"] == [
        {"name": "TotalAssets", "target": "'Balance Sheet'!$B$2"}
    ]


def test_broken_model_matches_contract_too(broken_model):
    result = analyze_workbook(str(broken_model), "broken_model.xlsx")
    schema = json.loads(SCHEMA_PATH.read_text())
    jsonschema.validate(result, schema)
