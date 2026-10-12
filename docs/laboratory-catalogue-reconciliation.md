# Laboratory catalogue reconciliation

Live production was **not** queried in this programme. Counts below are from the development seed (`KENYA_LAB_CATALOG` in `backend/src/laboratory/data/kenya-lab-catalog.seed.ts`) on 12 Oct 2026.

| Source | Orderable tests | Parameters | Reference ranges |
| --- | --- | --- | --- |
| Historical audit lead | 192 | 277 | 140 |
| Current seed (deduped by code) | 192 | 277 | 140 |
| Seed panels | 13 | — | — |
| Seed departments | 7 | — | — |
| Seed specimen types | 13 | — | — |
| Parameters with **no** interval | 151 | — | — |
| Non-numeric parameters (text/boolean/select) | 162 | — | — |

## Dual catalogue

- Legacy: `demo.lab_tests`, `demo.lab_panels` (small local list; items store `test_id` / `panel_id`).
- Kenya/Jalaram orderable: `demo.lab_orderable_tests`, `demo.lab_test_parameters`, `demo.lab_reference_ranges` (`orderable_test_id` on request items).
- Earlier live snapshot (Phase 0, not repeated here): 13 requests, 20 items (18 legacy `test_id`, 2 orderable), 11 results all with `parameter_id` null.

## Mapping policy

- No automatic migration or relabel of clinical result rows.
- Unambiguous code matches can be listed for laboratory review; guessed name matches must not rewrite history.
- Existing requests keep the definition attached at order time (`test_id` or `orderable_test_id` plus stored `unit`, `reference_range`, `flag`).

## Gap report (requires laboratory approval)

1. 151 parameters have empty `referenceRanges` in seed — evaluation will persist `UNASSESSED` until intervals are signed off.
2. Sex- or age-conditional ranges must be confirmed; the engine will not invent demographics to select them.
3. Overlapping equal-specificity ranges with different bounds are treated as conflicts (no auto-pick).
4. Legacy `lab_tests` codes vs orderable codes are **not** auto-merged.
5. Sample report PDFs must not be copied into production intervals.
6. Effective dating / version columns for ranges are **not** added. Historical accuracy relies on the values stored on `lab_results` at verification time.

## Data risk

- Additive columns (`result_comment`, `supersedes_id`, `amendment_reason`, `rejection_reason`) do not rewrite verified values.
- A unique index on `(request_item_id, parameter_id)` for current rows is **proposed only** after a duplicate audit; it is commented in planned SQL.
- Deploying entity mappings before the planned SQL is applied will make TypeORM SELECT fail on missing columns.
