/**
 * Manual verification script to inspect generated YAML output
 * Run with: npx vitest run src/lib/services/__tests__/cagent-generator.verification.ts
 */

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
import * as fs from 'fs';

fs.writeFileSync('/tmp/generated-team.yaml', yaml);

console.log('Generated YAML saved to: /tmp/generated-team.yaml');
console.log(`Total length: ${yaml.length} characters`);
console.log(`Total lines: ${yaml.split('\n').length}`);
console.log('\nFirst 100 lines:');
console.log(yaml.split('\n').slice(0, 100).join('\n'));
