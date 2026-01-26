# 🪝 Gemini CLI Hooks Configuration

This repository uses **Gemini CLI Hooks** to automate quality checks, enforce security, and prevent bugs *before* they reach a PR.

## 📂 Active Hooks

Located in `.gemini/hooks/` and registered in `.gemini/settings.json`.

### 1. ✅ Auto-Lint (Biome)
*   **Trigger:** After `write_file`, `replace`, `edit_file`.
*   **Action:** Runs `biome check --write` on the modified file.
*   **Benefit:** Automatically fixes formatting and linting errors. If fixing fails, it alerts the agent immediately to correct its code.

### 2. 🧪 Test Guardian
*   **Trigger:** After `write_file`, `replace`, `edit_file` on `src/lib/*`.
*   **Action:** Checks if a corresponding `.spec.ts` or `.test.ts` file exists.
*   **Benefit:** Nudges the agent to create or update tests when modifying logic, ensuring high coverage.

### 3. 🛡️ Sensitive File Guard
*   **Trigger:** Before `write_file`, `replace`, `edit_file`.
*   **Action:** Checks if the target file is "sensitive" (`.env`, `package.json`, `AGENTS.md`).
*   **Benefit:** Injects a strict system warning to the agent, forcing a double-check of the intended changes to prevent breaking configuration or leaking secrets.

### 4. 📚 Research Guard
*   **Trigger:** Before `write_file`, `replace`, `edit_file`.
*   **Action:** Reminds the agent to consult documentation (Context7/Exa) if it hasn't done so recently for complex tasks.

## ⚙️ Usage

These hooks run **automatically** in your local Gemini CLI environment. You do not need to invoke them manually.

*   **Logs:** Errors are printed to the CLI stderr.
*   **Bypass:** If absolutely necessary, you can temporarily disable hooks by editing `.gemini/settings.json` (not recommended).

## 🚀 Adding New Hooks

1.  Create a script in `.gemini/hooks/`.
2.  Make it executable (or run via `node`).
3.  Register it in `.gemini/settings.json` under the appropriate event (`BeforeTool` / `AfterTool`).

Refer to [Official Gemini CLI Hooks Docs](https://geminicli.com/docs/hooks/) for more details.
