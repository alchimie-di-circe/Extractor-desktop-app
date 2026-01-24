# Run Tests

Run tests with detailed output and Wallaby MCP server integration.

## Arguments:
$ARGUMENTS - "unit", "test" (default: "unit")

## Prerequisites:
- **Wallaby.js**: Must be started manually in VS Code (`Wallaby.js: Start` command)
- Wallaby provides real-time test results without re-running

## Steps:

1. **Check Wallaby status first using Wallaby MCP server tools**: 
   - Use `wallaby_failingTests` to see current failures
   - Use `wallaby_allTests` to see all test status

2. **Run tests via CLI**:
   - Unit: `pnpm run test:unit -- --run --reporter=verbose`

3. **Debug failures with Wallaby MCP server tools**:
   - Use `wallaby_runtimeValues` for variable inspection
   - Use `wallaby_coveredLinesForFile` for coverage analysis
   - Use `wallaby_testById` for detailed test info

4. **Report**:
   - Pass/fail counts
   - Failed test names and error messages
   - Suggested fixes based on runtime values
