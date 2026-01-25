#!/usr/bin/env node

/**
 * 🛡️ Research Guard Hook
 * Intercepts write operations to remind the agent about research protocols.
 */

async function main() {
  // Read input from stdin
  const input = JSON.parse(await readStdin());
  
  // Logic: We don't block aggressively (exit 2) because it might annoy the user on trivial edits.
  // Instead, we inject a strong System Message that appears in the transcript *before* the tool executes.
  // This influences the model's "conscience".
  
  const response = {
    decision: "allow", // We allow it, but with a warning. Change to "deny" to be strict.
    systemMessage: "🛡️ [Research Guard] verifying: Have you consulted Context7 or Exa docs before writing this code? If this is a complex implementation and you haven't researched, please STOP and query docs first."
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
