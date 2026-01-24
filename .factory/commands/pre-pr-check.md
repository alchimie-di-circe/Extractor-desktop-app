# Pre-PR Quality Check

Run complete pre-PR validation for all the changes in this branch or task. 

## Steps:

1. **Lint Check**: Run `pnpm run lint` and report any errors/warnings
2. **Type Check**: Run `pnpm run check` and report TypeScript/Svelte errors
3. **Unit Tests**: Run `pnpm run test:unit -- --run` and report failures using Wallaby MCP server tools (check for Wallaby.js running first, if it's not running ask to the user if you can't start it)
4. **DevServer Check** (if running): Use `get_dev_server_status` MCP tool for runtime errors (devserver mcp).
5. **Svelte Validation**: For modified .svelte files, use `svelte-autofixer` MCP tool (Svelte mcp server).

## Output:
Provide a summary table:
| Check | Status | Issues |
|-------|--------|--------|
| Lint | PASS/FAIL | count |
| Types | PASS/FAIL | count |
| Tests | PASS/FAIL | passed/failed |

Final verdict: READY TO COMMIT or NEEDS FIXES
