/**
 * Manual verification script to inspect generated YAML output
 * Run with: npx vitest run src/lib/services/__tests__/cagent-generator.verification.ts
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { generateCagentYaml } from '../cagent-generator';

const yaml = generateCagentYaml({
	agents: {
		orchestrator: { description: 'Team coordinator' },
		idea_validator: { description: 'Content validator' },
	},
	enabledMcp: ['perplexity', 'firecrawl', 'jina'],
	ragSources: ['brand_guidelines', 'platform_specs', 'competitors'],
});

// Write to file for easy inspection
const filePath = path.join(os.tmpdir(), 'generated-team.yaml');
fs.writeFileSync(filePath, yaml);

console.log(`Generated YAML saved to: ${filePath}`);
console.log(`Total length: ${yaml.length} characters`);
console.log(`Total lines: ${yaml.split('\n').length}`);
console.log('\nFirst 100 lines:');
console.log(yaml.split('\n').slice(0, 100).join('\n'));
