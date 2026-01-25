#!/usr/bin/env node

/**
 * ✅ Auto-Lint Hook (Biome Edition)
 * Runs Biome check after a file is modified to catch errors early.
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

async function main() {
  const input = JSON.parse(await readStdin());
  const { tool_result, tool_input } = input;
  
  // We only care if the tool succeeded
  if (tool_result && tool_result.is_error) {
    console.log(JSON.stringify({}));
    return;
  }

  const filePath = tool_input.file_path || tool_input.path;

  // Only run for supported files
  if (!filePath || !filePath.match(/\.(ts|js|tsx|jsx|svelte|json|css)$/)) {
    console.log(JSON.stringify({}));
    return;
  }

  let messages = [];
  let hasError = false;

  // Run Biome Check (Apply safe fixes automatically)
  try {
    // --write: Applies safe fixes
    // --no-errors-on-unmatched: Avoids error if file is ignored
    execSync(`npx biome check --write --no-errors-on-unmatched "${filePath}"`, { 
      encoding: 'utf8', 
      stdio: 'pipe',
      timeout: 5000 
    });
    messages.push(`✅ Biome auto-fixed ${path.basename(filePath)}`);
  } catch (error) {
    hasError = true;
    const output = error.stdout || error.stderr || error.message;
    // Keep it brief
    const cleanOutput = output.split('\n')
      .filter(l => l.includes('error:') || l.includes('×'))
      .slice(0, 5)
      .join('\n');
    messages.push(`❌ Biome Check Failed:\n${cleanOutput}`);
  }

  const response = {
    hookSpecificOutput: {
      hookEventName: "AfterTool",
      // If we fixed it, let the agent know. If we failed, WARN the agent.
      additionalContext: messages.join('\n') + (hasError ? "\n\n👉 Please FIX these linting errors immediately." : "")
    }
  };

  console.log(JSON.stringify(response));
}

function readStdin() {
  return new Promise((resolve) => {
    const chunks = [];
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString()));
  });
}

readStdin().then(main).catch(console.error);