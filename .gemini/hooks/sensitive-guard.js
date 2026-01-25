#!/usr/bin/env node

/**
 * 🛡️ Sensitive File Guard
 * Warns before editing critical configuration files.
 */

async function main() {
  const input = JSON.parse(await readStdin());
  const { tool_input } = input;
  const filePath = tool_input.file_path || tool_input.path || tool_input.file; // handle different tools

  const SENSITIVE_FILES = [
    '.env',
    '.env.local',
    'AGENTS.md',
    '.github/workflows/gemini-invoke.yml',
    'package.json',
    'pnpm-lock.yaml'
  ];

  if (!filePath) {
    console.log(JSON.stringify({ decision: "allow" }));
    return;
  }

  // Check if file is in sensitive list (partial match for path)
  const isSensitive = SENSITIVE_FILES.some(f => filePath.endsWith(f));

  if (isSensitive) {
    console.log(JSON.stringify({
      decision: "allow", // We don't block, but we inject a system message
      systemMessage: "🛑 **CRITICAL FILE ALERT**: You are about to modify `" + filePath + "`.\n\n⚠️  This is a high-risk configuration file.\n1.  Double-check your changes.\n2.  Ensure you are not exposing secrets (.env).\n3.  Verify syntax before saving."
    }));
  } else {
    console.log(JSON.stringify({ decision: "allow" }));
  }
}

function readStdin() {
  return new Promise((resolve) => {
    const chunks = [];
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString()));
  });
}

readStdin().then(main).catch(console.error);
