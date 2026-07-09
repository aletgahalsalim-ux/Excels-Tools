"""Formula & dependency analysis.

Extracts every formula, parses local and cross-sheet references, builds the
dependency graph and detects engine-level anomalies:
- circular_reference: cycle in the dependency graph (or a formula whose own
  cell lies inside a range it references on the same sheet)
- hardcoded_number: numeric literals buried inside formulas
- broken_reference: #REF! errors
- dead_formula: a formula whose referenced cells are all empty
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from openpyxl.utils import range_boundaries
from openpyxl.workbook import Workbook

# 'Sheet name'!A1:B2  or  SheetName!A1
_CROSS_SHEET_RE = re.compile(
    r"(?:'(?P<quoted>[^']+)'|(?P<plain>[A-Za-z_؀-ۿ][\w؀-ۿ]*))!"
    r"(?P<ref>\$?[A-Z]{1,3}\$?\d+(?::\$?[A-Z]{1,3}\$?\d+)?)"
)
_LOCAL_REF_RE = re.compile(r"(?<![!\w:$])(\$?[A-Z]{1,3}\$?\d+(?::\$?[A-Z]{1,3}\$?\d+)?)")
# Numeric literals not part of a cell address (A1) or function name
_NUMBER_LITERAL_RE = re.compile(r"(?<![A-Za-z0-9_.$])(\d+(?:\.\d+)?)(?![A-Za-z0-9_])")
_IGNORED_LITERALS = {"0", "1", "2", "12", "100", "365", "0.5"}


@dataclass
class FormulaInfo:
    sheet_name: str
    cell: str
    formula: str
    local_refs: list[str] = field(default_factory=list)
    cross_sheet_refs: list[str] = field(default_factory=list)

    def to_json(self) -> dict[str, Any]:
        return {
            "sheetName": self.sheet_name,
            "cell": self.cell,
            "formula": self.formula,
            "localRefs": self.local_refs,
            "crossSheetRefs": self.cross_sheet_refs,
        }


def _strip_dollars(ref: str) -> str:
    return ref.replace("$", "")


def parse_refs(formula: str) -> tuple[list[str], list[str]]:
    """Return (local_refs, cross_sheet_refs) parsed from a formula string."""
    cross: list[str] = []
    spans: list[tuple[int, int]] = []
    for m in _CROSS_SHEET_RE.finditer(formula):
        sheet = m.group("quoted") or m.group("plain")
        cross.append(f"{sheet}!{_strip_dollars(m.group('ref'))}")
        spans.append(m.span())

    local: list[str] = []
    for m in _LOCAL_REF_RE.finditer(formula):
        if any(start <= m.start() < end for start, end in spans):
            continue  # already captured as part of a cross-sheet ref
        local.append(_strip_dollars(m.group(1)))
    return local, cross


def _expand_single_cells(ref: str) -> list[str] | None:
    """A single-cell ref returns itself; ranges return None (handled separately)."""
    return None if ":" in ref else [ref]


def _cell_in_range(cell: str, ref_range: str) -> bool:
    try:
        min_c, min_r, max_c, max_r = range_boundaries(ref_range)
        cc, cr, _, _ = range_boundaries(cell)
        return bool(min_c <= cc <= max_c and min_r <= cr <= max_r)
    except ValueError:
        return False


def extract_formulas(wb_formulas: Workbook) -> list[FormulaInfo]:
    formulas: list[FormulaInfo] = []
    for ws in wb_formulas.worksheets:
        for row in ws.iter_rows():
            for cell in row:
                if isinstance(cell.value, str) and cell.value.startswith("="):
                    local, cross = parse_refs(cell.value)
                    formulas.append(
                        FormulaInfo(
                            sheet_name=ws.title,
                            cell=cell.coordinate,
                            formula=cell.value,
                            local_refs=local,
                            cross_sheet_refs=cross,
                        )
                    )
    return formulas


def _build_graph(formulas: list[FormulaInfo]) -> dict[str, set[str]]:
    """node = 'Sheet!A1'; edge formula-cell -> referenced single cells."""
    graph: dict[str, set[str]] = {}
    for f in formulas:
        node = f"{f.sheet_name}!{f.cell}"
        edges: set[str] = set()
        for ref in f.local_refs:
            cells = _expand_single_cells(ref)
            if cells:
                edges.update(f"{f.sheet_name}!{c}" for c in cells)
        for ref in f.cross_sheet_refs:
            if ":" not in ref:
                edges.add(ref)
        graph[node] = edges
    return graph


def _find_cycles(graph: dict[str, set[str]]) -> set[str]:
    """Nodes participating in a dependency cycle (iterative DFS, 3-color)."""
    WHITE, GRAY, BLACK = 0, 1, 2
    color: dict[str, int] = {n: WHITE for n in graph}
    in_cycle: set[str] = set()

    for start in graph:
        if color[start] != WHITE:
            continue
        stack: list[tuple[str, list[str]]] = [(start, list(graph[start]))]
        color[start] = GRAY
        path = [start]
        while stack:
            node, children = stack[-1]
            if children:
                child = children.pop()
                if child not in graph:
                    continue
                if color[child] == GRAY:
                    # cycle: everything on the path from child to node
                    idx = path.index(child)
                    in_cycle.update(path[idx:])
                elif color[child] == WHITE:
                    color[child] = GRAY
                    stack.append((child, list(graph[child])))
                    path.append(child)
            else:
                color[node] = BLACK
                stack.pop()
                path.pop()
    return in_cycle


def detect_anomalies(
    formulas: list[FormulaInfo], value_grids: dict[str, dict[str, Any]]
) -> list[dict[str, Any]]:
    """value_grids: sheet name -> {'A1': value} for non-empty cells."""
    anomalies: list[dict[str, Any]] = []

    # circular references — graph cycles
    cycle_nodes = _find_cycles(_build_graph(formulas))
    for f in formulas:
        node = f"{f.sheet_name}!{f.cell}"
        is_circular = node in cycle_nodes or any(
            ":" in ref and _cell_in_range(f.cell, ref) for ref in f.local_refs
        )
        if is_circular:
            anomalies.append(
                {
                    "type": "circular_reference",
                    "sheetName": f.sheet_name,
                    "cell": f.cell,
                    "detail": f"Formula {f.formula} participates in a circular dependency",
                }
            )

    for f in formulas:
        # broken references
        if "#REF!" in f.formula:
            anomalies.append(
                {
                    "type": "broken_reference",
                    "sheetName": f.sheet_name,
                    "cell": f.cell,
                    "detail": f"Formula {f.formula} contains a #REF! error",
                }
            )
            continue

        # hardcoded numeric literals
        literals = [
            m.group(1)
            for m in _NUMBER_LITERAL_RE.finditer(f.formula)
            if m.group(1) not in _IGNORED_LITERALS
        ]
        if literals:
            anomalies.append(
                {
                    "type": "hardcoded_number",
                    "sheetName": f.sheet_name,
                    "cell": f.cell,
                    "detail": (
                        f"Formula {f.formula} contains hardcoded number(s): "
                        f"{', '.join(literals[:5])}"
                    ),
                }
            )

        # dead formulas — every single-cell local ref points at an empty cell
        single_refs = [r for r in f.local_refs if ":" not in r]
        if single_refs:
            grid = value_grids.get(f.sheet_name, {})
            if all(grid.get(r) is None for r in single_refs) and not f.cross_sheet_refs:
                anomalies.append(
                    {
                        "type": "dead_formula",
                        "sheetName": f.sheet_name,
                        "cell": f.cell,
                        "detail": f"Formula {f.formula} references only empty cells",
                    }
                )

    return anomalies
