from app.engine.formulas import parse_refs


def test_parse_local_refs():
    local, cross = parse_refs("=A1+B2*SUM(C1:C10)")
    assert local == ["A1", "B2", "C1:C10"]
    assert cross == []


def test_parse_cross_sheet_refs():
    local, cross = parse_refs("='Balance Sheet'!B2+Assumptions!C3-A1")
    assert cross == ["Balance Sheet!B2", "Assumptions!C3"]
    assert local == ["A1"]


def test_dollar_signs_stripped():
    local, cross = parse_refs("=$A$1+'S1'!$B$2")
    assert local == ["A1"]
    assert cross == ["S1!B2"]


def test_anomalies_detected(broken_model):
    from app.engine.analyzer import analyze_workbook

    result = analyze_workbook(str(broken_model), "broken_model.xlsx")
    types = {a["type"] for a in result["anomalies"]}
    assert "circular_reference" in types
    assert "hardcoded_number" in types
    assert "broken_reference" in types
    assert "dead_formula" in types

    circular_cells = {
        a["cell"] for a in result["anomalies"] if a["type"] == "circular_reference"
    }
    assert circular_cells == {"C3", "C4"}

    hardcoded = [a for a in result["anomalies"] if a["type"] == "hardcoded_number"]
    assert any("12345" in a["detail"] for a in hardcoded)


def test_clean_model_has_no_anomalies(balanced_model):
    from app.engine.analyzer import analyze_workbook

    result = analyze_workbook(str(balanced_model), "balanced_model.xlsx")
    assert result["anomalies"] == []
    # the cross-sheet formula was captured
    cross = [f for f in result["formulas"] if f["crossSheetRefs"]]
    assert cross and cross[0]["crossSheetRefs"] == ["Balance Sheet!B2"]
