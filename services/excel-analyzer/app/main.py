"""Excel Analysis Engine — FastAPI service.

POST /analyze : multipart .xlsx upload -> AnalysisResult JSON
GET  /health  : liveness probe
"""

from __future__ import annotations

import os
import tempfile

from fastapi import FastAPI, File, HTTPException, Query, UploadFile

from .engine.analyzer import ENGINE_VERSION, analyze_workbook

app = FastAPI(title="Excel Analysis Engine", version=ENGINE_VERSION)

ALLOWED_EXTENSIONS = {".xlsx", ".xlsm"}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "engineVersion": ENGINE_VERSION}


@app.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    max_rows_per_table: int = Query(default=200, ge=1, le=10000),
) -> dict:
    name = file.filename or "workbook.xlsx"
    ext = os.path.splitext(name)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=422, detail=f"Unsupported file extension: {ext}")

    tmp_path = ""
    try:
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
            tmp_path = tmp.name
            tmp.write(await file.read())
        return analyze_workbook(tmp_path, name, max_rows_per_table=max_rows_per_table)
    except HTTPException:
        raise
    except Exception as exc:  # corrupted/password-protected files -> structured 422
        raise HTTPException(status_code=422, detail=f"Failed to analyze workbook: {exc}") from exc
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
