# Task 6 Pre-PR Checklist

**Branch:** `task-6---wave3`  
**Target:** Main  
**Scope:** 32 files, +5196/-121 LOC  

---

## Automated Steps (Delegabile a Droid/CLI)

### Step 1: Fix shadcn Import Type Issues
- [ ] Convert `import type` → `import` in accordion/progress components
- [ ] Files: `src/lib/components/ui/accordion/*.svelte`, `src/lib/components/ui/progress/*.svelte`

### Step 2: Lint Fixes
- [ ] `pnpm run lint:fix` → Biome auto-format
- [ ] `pnpm run lint` → Zero errors
- [ ] Command: `pnpm run lint:fix && pnpm run lint`

### Step 3: Type Check
- [ ] `pnpm run check` → Zero TypeScript/Svelte errors
- [ ] Target: 0 errors (warnings acceptable)

### Step 4: Python Tests
- [ ] `python3 -m pytest python/tests/ -v --tb=short`
- [ ] Target: 230/230 passing
- [ ] Coverage: Security core (31) + Agent tools (52) + Existing (147)

### Step 5: TypeScript Unit Tests
- [ ] `pnpm run test:unit -- --run`
- [ ] All tests passing

### Step 6: CodeRabbit CLI Pre-Review
- [ ] Run 1: `coderabbit review --type committed --base main --plain --config CLAUDE.md`
- [ ] Parse findings → fix critical/high issues
- [ ] Run 2: Re-verify with `coderabbit review --type committed --base-commit <base> --plain`
- [ ] Iterate until: Zero critical/high, only nitpick/info remain
- [ ] **Iterative strategy:**
  - Run coderabbit on full diff
  - Commit fixes for critical findings
  - Re-run to verify (base-commit = commit before fixes)
  - Repeat until clean

### Step 7: Build Verification
- [ ] `pnpm run package`
- [ ] Build succeeds, no errors

### Step 8: Push to Remote
- [ ] `git push -u origin task-6---wave3`

### Step 9: Create Pull Request
- [ ] `gh pr create --title "Task 6: Secure Sandboxed Extraction & Agent Integration" --body-file TASK_6_COMPLETION_SUMMARY.md --base main`

---

## Manual Steps (Richiede Intervento Umano - TU)

### Visual Verification
- [ ] Start dev environment: `pnpm run dev`
- [ ] Navigate to `/extract`
- [ ] Verify: Tab "Carica File" presente e funzionante
- [ ] Verify: Tab "Libreria Foto" presente
- [ ] Verify: Tab switch works (click between them)
- [ ] Verify: Photos Library tab shows loading/error state (no socket connection)

### Full Disk Access Test
- [ ] Locate sandbox supervisor logs (check stderr from Electron dev)
- [ ] If socketserver starts with permission error, verify it maps to UI error message
- [ ] Confirm dialog UX aligns with permission requirement

### PR Review & Merge
- [ ] Review PR comments from CodeRabbit (web UI post-push)
- [ ] Approve PR if all auto-checks pass
- [ ] Merge to main

---

## Test Coverage Summary

| Phase | Category | Count | Status |
|-------|----------|-------|--------|
| 1-3 | Python Security Core | 31 tests | ✅ Automated |
| 5 | Python Agent Tools | 52 tests | ✅ Automated |
| Existing | Runtime/Config/API | 147 tests | ✅ Automated |
| **Total** | **Python Tests** | **230 tests** | **Automated** |
| E2E | SvelteKit (Playwright) | 1 test | ✅ Demo test only |
| Manual | Electron UI (dev mode) | 1 flow | Manual by user |

---

## Notes

### Why TestSprite NOT Used
- TestSprite tests SvelteKit dev server (`pnpm run dev` without Electron)
- `window.electronAPI` doesn't exist in SvelteKit headless mode
- Photos Library tab IPC calls would fail in Playwright
- Only for: Upload tab structure, basic layout, non-Electron features

### Why Agent Browser CLI / Chrome DevTools MCP NOT Used
- Trae Extractor is **Electron app**, not web app
- Browser-based tools can't access:
  - `window.electronAPI` (contextBridge/preload)
  - IPC handlers (osxphotos, keychain, config)
  - Sidecar supervisor
- UI testing requires full Electron runtime: `pnpm run dev`

### CodeRabbit Strategy
CodeRabbit CLI will find issues **before** posting to GitHub:
1. Reduces post-PR noise (no auto-comments cluttering the review)
2. Allows iterative fixing in local commits
3. PR review on GitHub is cleaner (only human findings + context)

---

## Time Estimate

| Phase | Duration | Notes |
|-------|----------|-------|
| Steps 1-7 (Automated) | 40-50 min | Includes CodeRabbit iterative cycles |
| Manual checks (You) | 10 min | Visual verification + FDA test |
| **Total** | **~60 min** | Can delegate Steps 1-9 to droid |

---

## Delegation Instructions

**To another Droid session:**
```
"Complete the automated steps 1-9 from task-6-pre-PR-checklist.md:
- Fix shadcn import type issues
- Run quality gates (lint, type check, tests)
- Run CodeRabbit review iteratively until clean
- Build verification
- Push and create PR

Once done, I will verify the manual steps (visual checks, FDA test)."
```

**After PR Creation:**
The user (`alchimie-di-circe`) manually reviews:
1. Visual UI check in dev mode
2. Full Disk Access error state
3. Approve + merge PR
