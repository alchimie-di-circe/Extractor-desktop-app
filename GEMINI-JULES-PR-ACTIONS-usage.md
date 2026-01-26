# 🤖 Gemini & Jules GitHub Actions Usage Guide

This document explains how to use the automated AI engineering workflows in this repository.

## 🚀 Quick Setup (New Repo)
To mirror this setup in another repository:
1.  **Copy Files**: Copy the entire `.github/` folder to the new repository.
2.  **Configure Secrets**: In the GitHub repository settings (Settings > Secrets and variables > Actions), add:
    *   `GEMINI_API_KEY`: Your primary Gemini API Key.
    *   `JULES_API_KEY`: Your Jules API Key (required for `/auto-fix`).
3.  **Enable Actions**: Ensure "Allow GitHub Actions to create and approve pull requests" is enabled in Settings > Actions > General.

---

## 🛠 Available Slash Commands
You can trigger these commands by commenting on any **Issue** or **Pull Request**. Start your comment with `@gemini-cli`.

| Command | Action | Recommended Use Case |
| :--- | :--- | :--- |
| `@gemini-cli /review` | Triggers a deep PR review. | Quality check before merging a PR. |
| `@gemini-cli /auto-fix` | Triggers **Jules Agent** to fix bot comments. | Fixes issues from CodeRabbit, Qodo, or Linting automatically. |
| `@gemini-cli /triage` | Analyzes and labels an Issue/PR. | Organizing new bug reports or feature requests. |
| `@gemini-cli [any text]` | General assistant invocation. | "Explain this code", "Refactor this function", "Generate tests". |

---

## 🔄 Workflow Details

### 1. 🔀 Gemini Dispatch (`gemini-dispatch.yml`)
The "brain" of the operation. It listens for events and routes them to the correct workflow.
*   **Triggers**: Issue/PR opened, comment created.
*   **Logic**: It parses the `@gemini-cli` command and determines which sub-workflow to call.

### 2. 🤖 Agentic Auto-Fix (`gemini-auto-fix.yml`)
Uses the **Jules Agent** to perform complex multi-file corrections.
*   **Context Aggregator**: It scans all previous comments from other bots (CodeRabbit, Qodo, Sentry) and prioritizes them.
*   **Execution**: Applies fixes directly to your branch.
*   **Model**: Defaults to `gemini-2.5-pro`.

### 3. 🔎 Gemini Review (`gemini-review.yml`)
Provides a comprehensive review of the code changes in a PR.
*   **Output**: Comments directly on the PR diff with suggestions and bug catches.

### 4. 🔀 Gemini Invoke (`gemini-invoke.yml`)
A general-purpose tool for any task you describe.
*   **Capability**: Can read files, create branches, and open new PRs based on your natural language request.

### 5. 🤖 Gemini Triage (`gemini-triage.yml`)
Automates project management.
*   **Action**: Reads the labels available in your repo and applies the most relevant ones to an issue based on its description.

---

## 🔒 Security & Privacy
*   **Review Plan**: For destructive actions or code generation, Gemini will often post a **Plan of Action** and wait for a `/approve` comment before proceeding.
*   **Untrusted Input**: All workflows treat user input and external file content as untrusted to prevent prompt injection.
