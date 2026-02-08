# Qodo Proposal Report - JSON-RPC Library (2026-02-07)

## 1. Context

- Branch: `task-6---wave3`
- Reference report style: `TS_CHECK_REPORT_PR15_2026-02-07.md`
- Source: Qodo bot high-level suggestion on custom JSON-RPC handler/transport
- Scope: evaluation memo only (no migration implementation in this PR)

## 2. Current State (Verified)

- Custom JSON-RPC handler in Python:
  - `/Users/alexandthemusic/TRAE_Extractor-app/Trae_Extractor-app-v2/python/sandboxed/jsonrpc_handler.py`
- Custom transport/framing in Electron supervisor:
  - `/Users/alexandthemusic/TRAE_Extractor-app/Trae_Extractor-app-v2/electron/sidecar-ipc-handlers.ts`
- Recent status:
  - Unit tests pass after targeted fixes (`pnpm run test:unit -- --run`)
  - Python photos service tests pass (`python3 -m pytest python/tests/test_photos_service.py -q`)
  - `pnpm run check` still fails on pre-existing Svelte typing issues in `src/routes/extract/+page.svelte` (not caused by JSON-RPC design)

## 3. Qodo Suggestion Summary

Qodo suggests replacing custom JSON-RPC 2.0 handling/transport with standard libraries to reduce complexity and long-term maintenance burden.

## 4. Technical Assessment

### Benefits (if migrated)
- Less protocol boilerplate to maintain
- Lower risk of framing/parsing edge-case bugs
- Potentially clearer compliance with JSON-RPC behavior

### Costs/Risks (if migrated now)
- Cross-layer refactor (Electron transport + Python server contract)
- Higher regression risk on IPC/sandbox lifecycle
- Scope expansion beyond current PR objective (bugfix stabilization)

### Classification
- Suggestion quality: **valid**
- Blocking level for current PR: **non-blocking**

## 5. Decision

- **Do not migrate to a JSON-RPC library in the current PR.**
- Keep the current custom implementation for now, with targeted bugfixes already applied.

## 6. Follow-up Recommendation (Dedicated Task)

Open a separate spike/task for library migration with:

1. Candidate selection (TS + Python library pair)
2. Compatibility check with current Unix socket model and message framing
3. Incremental migration plan (feature flag or adapter layer)
4. Full regression matrix (IPC unit + integration + failure-path tests)

## 7. Re-open Criteria

Revisit migration when at least one condition is met:

1. Recurrent protocol bugs appear in custom handler/transport
2. New feature needs (batch RPC, richer notification semantics) exceed current design
3. A dedicated refactor window is available with explicit test budget

## 8. Practical Note for PR Discussion

Recommended response to Qodo:
- Acknowledge the recommendation as correct in principle.
- Clarify that this PR intentionally limits scope to high-confidence bug fixes.
- Confirm migration will be tracked as a dedicated follow-up item.

## 9. Final Status

- Qodo library proposal: **accepted as future improvement**
- Current PR scope: **fixes only, no protocol migration**