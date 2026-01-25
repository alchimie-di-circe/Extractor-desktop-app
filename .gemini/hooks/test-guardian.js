#!/usr/bin/env node

/**
 * 🧪 Test Guardian Hook
 * Reminds the agent to write/update tests when modifying source code.
 */
const fs = require('fs');
const path = require('path');

async function main() {
  const input = JSON.parse(await readStdin());
  const { tool_input } = input;
  const filePath = tool_input.file_path || tool_input.path;

  // Only strict source files
  if (!filePath || !filePath.match(/^src\/lib\/.*\.(ts|svelte)$/) || filePath.includes('.spec.') || filePath.includes('.test.')) {
    console.log(JSON.stringify({}));
    return;
  }

  // Construct expected test path (co-located)
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  
  // check for .spec.ts or .test.ts
  const specPath = path.join(dir, `${base}.spec.ts`);
  const testPath = path.join(dir, `${base}.test.ts`);
  
  const hasTest = fs.existsSync(specPath) || fs.existsSync(testPath);

  if (!hasTest) {
    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "AfterTool",
        additionalContext: `⚠️  **Missing Test Warning**: You modified 
${filePath}
 but no corresponding 
.spec.ts
 or 
.test.ts
 was found.
👉 Please consider adding a unit test for this component/logic.`
      }
    }));
  } else {
    // If test exists, maybe remind to run it?
    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "AfterTool",
        additionalContext: `ℹ️  **Test Reminder**: Remember to update/run the tests for 
${base}
 if logic changed.`
      }
    }));
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
