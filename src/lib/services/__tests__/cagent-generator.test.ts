import { describe, expect, it } from 'vitest';
import { generateCagentYaml } from '../cagent-generator';

describe('generateCagentYaml', () => {
	it('should generate valid YAML with default configuration', () => {
		const yaml = generateCagentYaml({
			agents: {},
			enabledMcp: ['perplexity', 'firecrawl', 'jina'],
			ragSources: ['brand_guidelines', 'platform_specs', 'competitors'],
		});

		// Check basic YAML structure
		expect(yaml).toContain('models:');
		expect(yaml).toContain('agents:');
		expect(yaml).toContain('rag:');
		expect(yaml).toContain('toolsets:');
		expect(yaml).toContain('metadata:');

		// Check agent roles are present (7 agents in new architecture)
		expect(yaml).toContain('orchestrator:');
		expect(yaml).toContain('extraction:');
		expect(yaml).toContain('creative_planner:');
		expect(yaml).toContain('creative_worker:');
		expect(yaml).toContain('captioning:');
		expect(yaml).toContain('scheduling:');
		expect(yaml).toContain('idea_validator:');
	});

	it('should include MCP toolsets when enabled', () => {
		const yaml = generateCagentYaml({
			agents: {},
			enabledMcp: ['perplexity', 'firecrawl', 'jina', 'cloudinary', 'shotstack'],
			ragSources: ['brand_guidelines'],
		});

		// Check for MCP tool definitions
		expect(yaml).toContain('@perplexity-ai/mcp-server');
		expect(yaml).toContain('firecrawl-mcp');
		expect(yaml).toContain('mcp.jina.ai');
		expect(yaml).toContain('@cloudinary/asset-management-mcp');
		expect(yaml).toContain('mcp.pipedream.net'); // Shotstack via Pipedream
	});

	it('should include add_prompt_files for idea_validator', () => {
		const yaml = generateCagentYaml({
			agents: {},
			enabledMcp: ['perplexity'],
			ragSources: ['brand_guidelines'],
		});

		// Check for prompt files in idea_validator
		expect(yaml).toContain('idea_validator:');
		expect(yaml).toContain('add_prompt_files:');
		expect(yaml).toContain('./python/prompts/idea-validator/instruction.md');
		expect(yaml).toContain('./python/prompts/idea-validator/rules.md');
		expect(yaml).toContain('./python/prompts/idea-validator/examples.md');
	});

	it('should include RAG configuration for specified sources', () => {
		const yaml = generateCagentYaml({
			agents: {},
			enabledMcp: [],
			ragSources: ['brand_guidelines', 'platform_specs', 'competitors'],
		});

		// Check RAG sources
		expect(yaml).toContain('brand_guidelines:');
		expect(yaml).toContain('platform_specs:');
		expect(yaml).toContain('competitors:');

		// Check RAG strategy
		expect(yaml).toContain('chunked-embeddings');
		expect(yaml).toContain('vector_dimensions: 1536');
		expect(yaml).toContain('./python/rag/brand_guidelines.db');
	});

	it('should reference RAG sources in appropriate agents', () => {
		const yaml = generateCagentYaml({
			agents: {},
			enabledMcp: ['perplexity'],
			ragSources: ['brand_guidelines', 'platform_specs', 'competitors'],
		});

		// IDEA-VALIDATOR should reference all 3 RAG sources
		const ideaValidatorSection = yaml.substring(
			yaml.indexOf('idea_validator:'),
			yaml.indexOf('metadata:'),
		);
		expect(ideaValidatorSection).toContain('rag:');
		expect(ideaValidatorSection).toContain('brand_guidelines');
		expect(ideaValidatorSection).toContain('platform_specs');
		expect(ideaValidatorSection).toContain('competitors');
	});

	it('should include orchestrator with sub_agents', () => {
		const yaml = generateCagentYaml({
			agents: {},
			enabledMcp: [],
			ragSources: [],
		});

		// Orchestrator should have sub_agents
		const orchestratorSection = yaml.substring(
			yaml.indexOf('orchestrator:'),
			yaml.indexOf('extraction:'),
		);
		expect(orchestratorSection).toContain('sub_agents:');
		expect(orchestratorSection).toContain('extraction');
		expect(orchestratorSection).toContain('creative_planner');
		expect(orchestratorSection).toContain('creative_worker');
		expect(orchestratorSection).toContain('idea_validator');
	});

	it('should generate valid YAML header with shebang', () => {
		const yaml = generateCagentYaml({
			agents: {},
			enabledMcp: [],
			ragSources: [],
		});

		expect(yaml).toMatch(/^#!/);
		expect(yaml).toContain('cagent run');
	});

	it('should use correct models for different agents', () => {
		const yaml = generateCagentYaml({
			agents: {},
			enabledMcp: [],
			ragSources: [],
		});

		// Check model assignments
		const orchestratorSection = yaml.substring(
			yaml.indexOf('orchestrator:'),
			yaml.indexOf('extraction:'),
		);
		expect(orchestratorSection).toContain('model: orchestrator');

		const schedulingSection = yaml.substring(
			yaml.indexOf('scheduling:'),
			yaml.indexOf('idea_validator:'),
		);
		expect(schedulingSection).toContain('model: scheduling');
	});

	it('should return non-empty string', () => {
		const yaml = generateCagentYaml({
			agents: {},
			enabledMcp: [],
			ragSources: [],
		});

		expect(yaml.length).toBeGreaterThan(100);
		expect(typeof yaml).toBe('string');
	});

	it('should match cagent YAML specification structure', () => {
		const yaml = generateCagentYaml({
			agents: {},
			enabledMcp: ['perplexity', 'firecrawl', 'jina'],
			ragSources: ['brand_guidelines', 'platform_specs', 'competitors'],
		});

		// Check top-level sections exist in correct order
		const lines = yaml.split('\n');
		const modelIndex = lines.findIndex((l) => l.startsWith('models:'));
		const agentsIndex = lines.findIndex((l) => l.startsWith('agents:'));
		const toolsetsIndex = lines.findIndex((l) => l.startsWith('toolsets:'));
		const ragIndex = lines.findIndex((l) => l.startsWith('rag:'));
		const metadataIndex = lines.findIndex((l) => l.startsWith('metadata:'));

		// Sections should exist
		expect(modelIndex).toBeGreaterThan(-1);
		expect(agentsIndex).toBeGreaterThan(-1);
		expect(toolsetsIndex).toBeGreaterThan(-1);
		expect(ragIndex).toBeGreaterThan(-1);
		expect(metadataIndex).toBeGreaterThan(-1);

		// Order should be: models → agents → toolsets → rag → metadata
		expect(modelIndex).toBeLessThan(agentsIndex);
		expect(agentsIndex).toBeLessThan(toolsetsIndex);
		expect(toolsetsIndex).toBeLessThan(ragIndex);
		expect(ragIndex).toBeLessThan(metadataIndex);
	});

	it('should properly format agent toolsets with MCP configuration', () => {
		const yaml = generateCagentYaml({
			agents: {},
			enabledMcp: ['perplexity', 'firecrawl', 'jina'],
			ragSources: [],
		});

		// Check for proper MCP syntax in toolsets
		expect(yaml).toMatch(/^\s+-\s+type:\s+mcp$/m);
		expect(yaml).toMatch(/^\s+command:\s+npx$/m);
		expect(yaml).toMatch(/^\s+args:$/m);
		expect(yaml).toMatch(/^\s+-\s+"[^"]+"\s*$/m); // args are quoted strings

		// Check for environment variable patterns
		expect(yaml).toContain('FIRECRAWL_API_KEY');
		expect(yaml).toContain('PERPLEXITY_API_KEY');
		expect(yaml).toContain('JINA_API_KEY');
	});

	it('should include all required agent fields', () => {
		const yaml = generateCagentYaml({
			agents: {},
			enabledMcp: ['perplexity', 'firecrawl', 'jina'],
			ragSources: ['brand_guidelines', 'platform_specs', 'competitors'],
		});

		// Check that agents section exists
		expect(yaml).toContain('agents:');

		// Check for required fields in each agent (7 agents in new architecture)
		const roles = [
			'orchestrator',
			'extraction',
			'creative_planner',
			'creative_worker',
			'captioning',
			'scheduling',
			'idea_validator',
		];

		// Each role should be present
		for (const role of roles) {
			expect(yaml).toContain(`  ${role}:`);
		}

		// Extract just the agents section
		const agentsStart = yaml.indexOf('agents:');
		const agentsEnd = yaml.indexOf('toolsets:');
		const agentsSection = yaml.substring(agentsStart, agentsEnd);

		// Verify required fields appear in agents section
		expect(agentsSection).toContain('model:');
		expect(agentsSection).toContain('description:');

		// Orchestrator should have sub_agents
		expect(agentsSection).toContain('sub_agents:');
	});

	it('should generate valid YAML indentation (2 spaces)', () => {
		const yaml = generateCagentYaml({
			agents: {},
			enabledMcp: ['perplexity'],
			ragSources: ['brand_guidelines'],
		});

		const lines = yaml.split('\n');
		let inMultilineString = false;

		for (const line of lines) {
			// Skip empty lines and comments
			if (!line.trim() || line.trim().startsWith('#')) continue;

			// Track multiline strings
			if (line.includes(' |') || line.includes(' |-')) {
				inMultilineString = true;
				continue;
			}
			if (inMultilineString && !line.startsWith('    ')) {
				inMultilineString = false;
			}

			if (inMultilineString) continue;

			// Check indentation is multiple of 2 spaces
			const leadingSpaces = (line.match(/^ */)?.[0] || '').length;
			expect(leadingSpaces % 2).toBe(0);
		}
	});

	it('should include Firecrawl for extraction and creative_planner only', () => {
		const yaml = generateCagentYaml({
			agents: {},
			enabledMcp: ['firecrawl'],
			ragSources: [],
		});

		// Get agent section boundaries (7 agents in new architecture)
		const extractionStart = yaml.indexOf('extraction:');
		const creativePlannerStart = yaml.indexOf('creative_planner:');
		const creativeWorkerStart = yaml.indexOf('creative_worker:');
		const captioningStart = yaml.indexOf('captioning:');

		// Get section boundaries
		const extractionEnd = creativePlannerStart;
		const creativePlannerEnd = creativeWorkerStart;

		const extractionSection = yaml.substring(extractionStart, extractionEnd);
		const creativePlannerSection = yaml.substring(creativePlannerStart, creativePlannerEnd);

		expect(extractionSection).toContain('firecrawl-mcp');
		expect(creativePlannerSection).toContain('firecrawl-mcp');

		// Verify it's NOT in creative_worker (which uses Cloudinary/Shotstack instead)
		const creativeWorkerEnd = captioningStart;
		const creativeWorkerSection = yaml.substring(creativeWorkerStart, creativeWorkerEnd);
		expect(creativeWorkerSection).not.toContain('firecrawl-mcp');

		// Verify it's NOT in orchestrator
		const orchestratorStart = yaml.indexOf('orchestrator:');
		const orchestratorEnd = extractionStart;
		const orchestratorSection = yaml.substring(orchestratorStart, orchestratorEnd);
		expect(orchestratorSection).not.toContain('firecrawl-mcp');
	});

	it('should include Cloudinary and Shotstack for creative_worker only', () => {
		const yaml = generateCagentYaml({
			agents: {},
			enabledMcp: ['cloudinary', 'shotstack'],
			ragSources: [],
		});

		// Get creative_worker section boundaries
		const creativeWorkerStart = yaml.indexOf('creative_worker:');
		const captioningStart = yaml.indexOf('captioning:');
		const creativeWorkerEnd = captioningStart;

		const creativeWorkerSection = yaml.substring(creativeWorkerStart, creativeWorkerEnd);

		// Verify Cloudinary and Shotstack are in creative_worker
		expect(creativeWorkerSection).toContain('@cloudinary/asset-management-mcp');
		expect(creativeWorkerSection).toContain('mcp.pipedream.net');

		// Verify they're NOT in creative_planner
		const creativePlannerStart = yaml.indexOf('creative_planner:');
		const creativeWorkerStartIdx = yaml.indexOf('creative_worker:');
		const creativePlannerEnd = creativeWorkerStartIdx;
		const creativePlannerSection = yaml.substring(creativePlannerStart, creativePlannerEnd);

		expect(creativePlannerSection).not.toContain('@cloudinary/asset-management-mcp');
		expect(creativePlannerSection).not.toContain('mcp.pipedream.net');
	});
});
