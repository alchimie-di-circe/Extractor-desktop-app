# TestSprite E2E Tests

Generate and run comprehensive E2E tests using TestSprite MCP server tools.

## Prerequisites:
- Dev server running: `pnpm run dev` (port 5173)
- TestSprite MCP server connected 

## Workflow:

### 1. Bootstrap
Use `testsprite_bootstrap` MCP tool:
- localPort: 5173
- type: "frontend"
- projectPath: "/Users/alexandthemusic/TRAE_Extractor-app/Trae_Extractor-app-v2"
- testScope: "codebase" (full) or "diff" (changes only)

### 2. Generate Code Summary
Use `testsprite_generate_code_summary` to analyze project structure.

### 3. Generate Test Plan
Use `testsprite_generate_frontend_test_plan` with focus on:
- LLM Provider configuration flow (/settings/llm-providers)
- Navigation and sidebar functionality
- Settings persistence

### 4. Execute Tests
Use `testsprite_generate_code_and_execute`:
- projectName: "Trae_Extractor-app-v2"
- testIds: [] (all) or specific IDs
- additionalInstruction: "Focus on Electron IPC and Svelte 5 components"

### 5. Handle Failures
If tests fail:
- Use `testsprite_rerun_tests` after fixes
- Read report from `testsprite_tests/TestSprite_MCP_Test_Report.md`

## Output:
- Test execution summary
- Critical failures with screenshots
- Recommendations for fixes



## Notes:
- Find more detailed info on Testsprite MCP server tools usage in .claude/CLAUDE.md 
- More online (ONLY if you need faulting infos): [Testsprite Documentation](https://docs.testsprite.ai)
