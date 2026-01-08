# GitHub CLI Reference

> Quick reference for common `gh` commands used in this repo.

## Auth
```bash
gh auth status
gh auth login
```

## PR workflow
```bash
# Create a PR
gh pr create --title "<title>" --body "<body>"

# View PR status/details
gh pr view <PR_URL_OR_NUMBER>

# Checkout a PR locally
gh pr checkout <PR_NUMBER>
```

## Review bot feedback
Use this to fetch only AI review comments (CodeRabbit, Qodo, Greptile).
```bash
gh pr view <PR_URL_OR_NUMBER> --json comments --jq '{
  comments: .comments | map(select(.author.login == "coderabbitai" or .author.login == "qodo-code-review" or .author.login == "greptile-apps") | {bot: .author.login, body: .body, created: .createdAt})
}'
```

## Notes
- Use `gh auth status` before PR workflows to confirm access.
- Prefer `gh pr create` over manual PR creation in the browser.
