/**
 * Cagent YAML Generator Service
 *
 * Generates complete, validated cagent team configuration YAML with:
 * - 6 specialized agents (Orchestrator, Extraction, Editing, Captioning, Scheduling, IDEA-VALIDATOR)
 * - MCP (Model Context Protocol) toolset integration
 * - RAG (Retrieval-Augmented Generation) knowledge base configuration
 * - System prompts via add_prompt_files
 *
 * References:
 * - https://docs.docker.com/ai/cagent/reference/config/
 * - https://docs.docker.com/ai/cagent/reference/toolsets/
 * - https://docs.docker.com/ai/cagent/rag/
 */

import type {
	AgentConfig,
	AgentRole,
	CagentTeamYAML,
	MCPToolset,
	RAGConfig,
	RAGStrategy,
} from '../types/cagent-interfaces';

/**
 * Generate configuration input for cagent YAML generation
 */
export interface GenerateCagentYamlInput {
	/** Agent configurations keyed by role */
	agents: Partial<Record<AgentRole, Partial<AgentConfig>>>;
	/** Enabled MCP servers (e.g., ['perplexity', 'firecrawl', 'jina', 'cloudinary']) */
	enabledMcp?: string[];
	/** Enabled RAG sources (e.g., ['brand_guidelines', 'platform_specs', 'competitors']) */
	ragSources?: string[];
}

/**
 * Generate a complete cagent team YAML configuration string.
 *
 * Produces valid YAML 1.2 with:
 * - Proper indentation (2 spaces)
 * - MCP toolsets (Perplexity, Firecrawl, Jina, Cloudinary)
 * - RAG sources with chunked-embeddings strategy
 * - System prompts via add_prompt_files
 * - Model defaults (Sonnet for most agents, Haiku for scheduling)
 *
 * @param config Configuration input with agents, MCP options, and RAG sources
 * @returns Valid YAML string (not written to file; caller decides persistence)
 *
 * @example
 * ```ts
 * const yaml = generateCagentYaml({
 *   agents: {
 *     orchestrator: { description: 'Team coordinator' },
 *     idea_validator: { description: 'Content validator' }
 *   },
 *   enabledMcp: ['perplexity', 'firecrawl', 'jina'],
 *   ragSources: ['brand_guidelines', 'platform_specs', 'competitors']
 * });
 *
 * // yaml is a valid YAML string ready for file write
 * ```
 */
export function generateCagentYaml(config: GenerateCagentYamlInput): string {
	const {
		agents: agentConfigs = {},
		enabledMcp = [],
		ragSources = ['brand_guidelines', 'platform_specs', 'competitors'],
	} = config;

	// Normalize enabled MCP servers to lowercase
	const mcpEnabled = enabledMcp.map((m) => m.toLowerCase());

	// Helper to create indent
	const indent = (level: number): string => '  '.repeat(level);

	// ========== SECTION 1: Header & Metadata ==========
	let yaml = `#!/usr/bin/env cagent run

# Cagent Team Configuration
# Generated dynamically with support for:
# - 6 specialized agents
# - MCP toolsets (Perplexity, Firecrawl, Jina, Cloudinary)
# - Shared RAG knowledge bases
# - System prompts via add_prompt_files

`;

	// ========== SECTION 2: Models ==========
	yaml += generateModelsSection();

	// ========== SECTION 3: Agents ==========
	yaml += generateAgentsSection(agentConfigs, mcpEnabled);

	// ========== SECTION 4: Toolsets (Shared) ==========
	yaml += generateToolsetsSection(mcpEnabled);

	// ========== SECTION 5: RAG Configuration ==========
	if (ragSources && ragSources.length > 0) {
		yaml += generateRagSection(ragSources);
	}

	// ========== SECTION 6: Metadata ==========
	yaml += generateMetadataSection();

	return yaml;
}

/**
 * Generate the models section of the YAML configuration
 *
 * Defines reusable model configurations:
 * - Orchestrator: Claude Sonnet (reasoning & coordination)
 * - Standard: Claude Sonnet (content analysis, editing)
 * - Scheduling: Claude Haiku (tool-calling only)
 * - Embedding: OpenAI text-embedding-3-small (RAG indexing)
 */
function generateModelsSection(): string {
	return `models:
  orchestrator:
    provider: anthropic
    model: claude-sonnet-4-5
    max_tokens: 8192
    temperature: 0.7
    description: Orchestrator model for complex reasoning and task coordination

  standard:
    provider: anthropic
    model: claude-sonnet-4-5
    max_tokens: 8192
    temperature: 0.7
    description: Standard model for content analysis and editing

  scheduling:
    provider: anthropic
    model: claude-haiku-4-5
    max_tokens: 4096
    temperature: 0.5
    description: Lightweight model for scheduling and simple tool-calling

  embedding:
    provider: openai
    model: text-embedding-3-small
    description: Embedding model for RAG indexing

`;
}

/**
 * Generate the agents section of the YAML configuration
 *
 * Creates 6 specialized agents:
 * - ORCHESTRATOR: Coordinates workflow
 * - EXTRACTION: Extracts content from media
 * - EDITING: Performs editing operations
 * - CAPTIONING: Generates captions
 * - SCHEDULING: Plans publication
 * - IDEA_VALIDATOR: Validates ideas and analyzes trends
 */
function generateAgentsSection(
	agentConfigs: Partial<Record<AgentRole, Partial<AgentConfig>>>,
	mcpEnabled: string[],
): string {
	let yaml = `agents:
`;

	const roles = [
		'orchestrator',
		'extraction',
		'editing',
		'captioning',
		'scheduling',
		'idea_validator',
	];

	for (const roleName of roles) {
		const userConfig = agentConfigs[roleName as AgentRole];
		yaml += generateAgentYaml(roleName as AgentRole, userConfig, mcpEnabled);
	}

	return yaml;
}

/**
 * Generate a single agent configuration
 */
function generateAgentYaml(
	role: AgentRole,
	userConfig?: Partial<AgentConfig>,
	mcpEnabled?: string[],
): string {
	const indent1 = '  ';
	const indent2 = '    ';
	const indent3 = '      ';
	const indent4 = '        ';

	// Determine model based on role
	const model = role === 'scheduling' ? 'scheduling' : 'standard';
	if (role === 'orchestrator') {
		// orchestrator uses orchestrator model
	}

	// Base agent configuration
	let agentYaml = `${indent1}${role}:
`;

	// Model
	const modelRef =
		role === 'orchestrator' ? 'orchestrator' : role === 'scheduling' ? 'scheduling' : 'standard';
	agentYaml += `${indent2}model: ${modelRef}\n`;

	// Description
	const description = getAgentDescription(role);
	agentYaml += `${indent2}description: "${description}"\n`;

	// Instruction
	const instruction = getAgentInstruction(role);
	if (instruction) {
		agentYaml += `${indent2}instruction: |\n`;
		for (const line of instruction.split('\n')) {
			agentYaml += `${indent3}${line}\n`;
		}
	}

	// Add prompt files (for idea_validator specifically)
	const promptFiles = getAgentPromptFiles(role);
	if (promptFiles && promptFiles.length > 0) {
		agentYaml += `${indent2}add_prompt_files:\n`;
		for (const file of promptFiles) {
			agentYaml += `${indent3}- ${file}\n`;
		}
	}

	// RAG sources
	const ragSources = getAgentRagSources(role);
	if (ragSources && ragSources.length > 0) {
		agentYaml += `${indent2}rag:\n`;
		for (const source of ragSources) {
			agentYaml += `${indent3}- ${source}\n`;
		}
	}

	// Sub-agents (only for orchestrator)
	if (role === 'orchestrator') {
		agentYaml += `${indent2}sub_agents:\n`;
		const subAgents = ['extraction', 'editing', 'captioning', 'scheduling', 'idea_validator'];
		for (const subAgent of subAgents) {
			agentYaml += `${indent3}- ${subAgent}\n`;
		}
	}

	// Toolsets
	const toolsets = getAgentToolsets(role, mcpEnabled || []);
	if (toolsets && toolsets.length > 0) {
		agentYaml += `${indent2}toolsets:\n`;
		for (const toolset of toolsets) {
			agentYaml += generateToolsetYaml(toolset, 3);
		}
	}

	agentYaml += `\n`;
	return agentYaml;
}

/**
 * Generate YAML for a single toolset
 */
function generateToolsetYaml(toolset: MCPToolset, indentLevel: number): string {
	const indent = '  '.repeat(indentLevel);
	const nextIndent = '  '.repeat(indentLevel + 1);
	const nextNextIndent = '  '.repeat(indentLevel + 2);

	let yaml = `${indent}- type: ${toolset.type}\n`;

	if (toolset.command) {
		yaml += `${nextIndent}command: ${toolset.command}\n`;
	}

	if (toolset.args && toolset.args.length > 0) {
		yaml += `${nextIndent}args:\n`;
		for (const arg of toolset.args) {
			yaml += `${nextNextIndent}- "${arg}"\n`;
		}
	}

	if (toolset.remote) {
		yaml += `${nextIndent}remote:\n`;
		yaml += `${nextNextIndent}url: ${toolset.remote.url}\n`;
		yaml += `${nextNextIndent}transport_type: ${toolset.remote.transport_type}\n`;
		if (toolset.remote.headers) {
			yaml += `${nextNextIndent}headers:\n`;
			for (const [key, value] of Object.entries(toolset.remote.headers)) {
				yaml += `${nextNextIndent}  ${key}: ${value}\n`;
			}
		}
	}

	if (toolset.env && Object.keys(toolset.env).length > 0) {
		yaml += `${nextIndent}env:\n`;
		for (const [key, value] of Object.entries(toolset.env)) {
			yaml += `${nextNextIndent}${key}: ${value}\n`;
		}
	}

	if (toolset.ref) {
		yaml += `${nextIndent}ref: ${toolset.ref}\n`;
	}

	if (toolset.path) {
		yaml += `${nextIndent}path: ${toolset.path}\n`;
	}

	if (toolset.shared !== undefined) {
		yaml += `${nextIndent}shared: ${toolset.shared}\n`;
	}

	if (toolset.tools && toolset.tools.length > 0) {
		yaml += `${nextIndent}tools:\n`;
		for (const tool of toolset.tools) {
			yaml += `${nextNextIndent}- ${tool}\n`;
		}
	}

	return yaml;
}

/**
 * Generate shared toolsets section
 * Note: Individual agent toolsets are defined per-agent in generateAgentYaml
 */
function generateToolsetsSection(mcpEnabled: string[]): string {
	// Shared toolsets for all agents
	const yaml = `toolsets:
  # Always include: thinking and memory
  - type: think
  - type: memory

`;

	return yaml;
}

/**
 * Generate RAG configuration section
 *
 * Creates RAG sources with:
 * - brand_guidelines (from ./knowledge/brand/guidelines.md)
 * - platform_specs (from ./knowledge/brand/platforms.md)
 * - competitors (from ./knowledge/brand/competitors.md)
 *
 * Uses chunked-embeddings strategy with OpenAI embedding model
 */
function generateRagSection(ragSources: string[]): string {
	let yaml = `rag:
`;

	const ragConfigs: Record<string, { docs: string[]; description: string }> = {
		brand_guidelines: {
			docs: ['./python/knowledge/brand/guidelines.md'],
			description: 'Brand identity, voice, values, visual guidelines',
		},
		platform_specs: {
			docs: ['./python/knowledge/brand/platforms.md'],
			description: 'Platform-specific content specifications and best practices',
		},
		competitors: {
			docs: ['./python/knowledge/brand/competitors.md'],
			description: 'Competitor analysis and market intelligence',
		},
	};

	for (const sourceName of ragSources) {
		const config = ragConfigs[sourceName];
		if (!config) continue;

		yaml += `  ${sourceName}:
    # ${config.description}
    docs:\n`;
		for (const doc of config.docs) {
			yaml += `      - "${doc}"\n`;
		}

		yaml += `    strategies:
      - type: chunked-embeddings
        embedding_model: embedding
        vector_dimensions: 1536
        database: ./python/rag/${sourceName}.db
        limit: 10
        threshold: 0.5
        chunking:
          size: 1000
          overlap: 100
          respect_word_boundaries: true
    results:
      limit: 5
      deduplicate: true

`;
	}

	return yaml;
}

/**
 * Generate metadata section
 */
function generateMetadataSection(): string {
	return `metadata:
  author: TRAE Extractor Team
  license: Proprietary
  readme: |
    # TRAE Extractor - Cagent Team Configuration
    
    Multi-agent system for content extraction, editing, captioning, and validation.
    
    ## Agents
    - **Orchestrator**: Coordinates workflow and delegates tasks
    - **Extraction**: Extracts content from media files
    - **Editing**: Performs video/image editing operations
    - **Captioning**: Generates captions and descriptions
    - **Scheduling**: Plans and schedules content publication
    - **IDEA-VALIDATOR**: Validates ideas and analyzes trends
    
    ## MCP Tools
    - Perplexity: Research and semantic search
    - Firecrawl: Web scraping and content extraction
    - Jina: Web search and URL reading
    - Cloudinary: Asset management (when enabled)
    
    ## RAG Knowledge Bases
    - Brand Guidelines: Brand identity and voice
    - Platform Specs: Platform-specific content rules
    - Competitors: Market and competitor analysis
`;
}

/**
 * Get description for agent role
 */
function getAgentDescription(role: AgentRole): string {
	const descriptions: Record<AgentRole, string> = {
		orchestrator: 'Coordinates workflow and delegates tasks to specialists',
		extraction: 'Extracts content from media files',
		editing: 'Performs editing and formatting operations',
		captioning: 'Generates captions and descriptions',
		scheduling: 'Plans and schedules content publication',
		idea_validator: 'Validates ideas and analyzes content trends',
	};
	return descriptions[role] || '';
}

/**
 * Get instruction for agent role
 */
function getAgentInstruction(role: AgentRole): string {
	const instructions: Record<AgentRole, string> = {
		orchestrator: `You are the Orchestrator, coordinating the TRAE content workflow.

Your responsibilities:
- Understand user requests and break them into workflow steps
- Delegate extraction tasks to the Extraction specialist
- Delegate editing tasks to the Editing specialist
- Coordinate captioning with the Captioning specialist
- Consult IDEA-VALIDATOR for content strategy and validation
- Use RAG sources (brand guidelines, platform specs) to ensure consistency

Workflow:
1. Analyze user request for content type and requirements
2. Use RAG to understand brand guidelines and constraints
3. Delegate work to appropriate specialists
4. Ensure handoff between agents
5. Aggregate results and present to user

Always prioritize brand consistency and content quality.`,

		extraction: `You are the Extraction specialist in the TRAE workflow.

Your responsibilities:
- Extract content from media files (images, videos)
- Identify key elements: subjects, themes, colors, composition
- Analyze metadata and context
- Use Firecrawl and Jina for web-based content extraction
- Prepare structured data for downstream agents

Use these tools:
- Firecrawl: Web scraping and content extraction
- Jina: URL reading and semantic search
- Filesystem: Work with uploaded media

Provide clear, structured extraction results for editing and captioning.`,

		editing: `You are the Editing specialist in the TRAE workflow.

Your responsibilities:
- Perform video/image editing based on specifications
- Apply brand visual guidelines
- Optimize for platform requirements
- Create multiple format variations
- Maintain consistent quality across outputs

Use RAG sources for:
- Brand visual guidelines
- Platform-specific formatting requirements
- Editing best practices

Document all editing decisions and provide ready-to-publish assets.`,

		captioning: `You are the Captioning specialist in the TRAE workflow.

Your responsibilities:
- Generate captions and descriptions
- Write headlines, alt-text, SEO descriptions
- Tailor copy for different platforms
- Maintain brand voice
- Use RAG sources for tone and guidelines

Use Perplexity MCP for:
- Trend research on related topics
- Semantic analysis of content
- Hashtag and keyword research

Ensure all captions are on-brand and platform-optimized.`,

		scheduling: `You are the Scheduling specialist in the TRAE workflow.

Your responsibilities:
- Plan publication schedule
- Optimize posting times for maximum engagement
- Coordinate cross-platform distribution
- Track scheduling dependencies
- Provide publication calendars

Use data from:
- Platform specifications (RAG)
- Competitor analysis (RAG)
- Content performance history

Focus on strategic timing and platform-specific best practices.`,

		idea_validator: `You are the IDEA-VALIDATOR & FORMAT EXPERT in the TRAE workflow.

Your responsibilities:
- Validate content ideas and concepts
- Analyze market trends and opportunities
- Propose optimized alternatives
- Ensure ethical marketing practices
- Score content performance potential

Follow detailed instructions from:
- ./python/prompts/idea-validator/instruction.md (workflow and methodology)
- ./python/prompts/idea-validator/rules.md (behavioral guidelines)
- ./python/prompts/idea-validator/examples.md (practical examples)

Use MCP tools:
- Perplexity: Deep research with citations
- Firecrawl: Extract competitor content
- Jina: Web search and trend analysis

Always provide structured analysis with data-backed recommendations.`,
	};
	return instructions[role] || '';
}

/**
 * Get prompt files for agent role (via add_prompt_files)
 */
function getAgentPromptFiles(role: AgentRole): string[] {
	const promptFiles: Record<AgentRole, string[]> = {
		orchestrator: [],
		extraction: [],
		editing: [],
		captioning: [],
		scheduling: [],
		idea_validator: [
			'./python/prompts/idea-validator/instruction.md',
			'./python/prompts/idea-validator/rules.md',
			'./python/prompts/idea-validator/examples.md',
		],
	};
	return promptFiles[role] || [];
}

/**
 * Get RAG sources for agent role
 */
function getAgentRagSources(role: AgentRole): string[] {
	const ragSources: Record<AgentRole, string[]> = {
		orchestrator: ['brand_guidelines', 'platform_specs'],
		extraction: [],
		editing: ['brand_guidelines', 'platform_specs'],
		captioning: ['brand_guidelines', 'platform_specs'],
		scheduling: ['brand_guidelines', 'platform_specs'],
		idea_validator: ['brand_guidelines', 'platform_specs', 'competitors'],
	};
	return ragSources[role] || [];
}

/**
 * Get toolsets for agent role
 *
 * Base toolsets (always included):
 * - think: Reasoning and planning
 * - memory: Persistent memory across sessions
 *
 * Role-specific MCP toolsets:
 * - Extraction/Editing: Firecrawl + Jina (web scraping)
 * - Captioning/IDEA-VALIDATOR: Perplexity (research)
 * - Conditional: Cloudinary (if enabled)
 */
function getAgentToolsets(role: AgentRole, mcpEnabled: string[]): MCPToolset[] {
	const toolsets: MCPToolset[] = [
		// Always include: Thinking
		{ type: 'think' },
		// Always include: Memory
		{ type: 'memory', path: `./memory/${role}.db` },
	];

	// Filesystem access for all agents
	toolsets.push({ type: 'filesystem' });

	// Shell access for editing and scheduling
	if (role === 'editing' || role === 'scheduling') {
		toolsets.push({ type: 'shell' });
	}

	// Role-specific MCP toolsets
	if (role === 'extraction' || role === 'editing') {
		// Firecrawl: Web scraping and content extraction
		if (mcpEnabled.includes('firecrawl')) {
			toolsets.push({
				type: 'mcp',
				command: 'npx',
				args: ['-y', 'firecrawl-mcp'],
				env: {
					FIRECRAWL_API_KEY: '${FIRECRAWL_API_KEY}',
				},
				instruction: 'Use Firecrawl for web scraping, content extraction, and URL mapping.',
			});
		}

		// Jina: Web search and URL reading
		if (mcpEnabled.includes('jina')) {
			toolsets.push({
				type: 'mcp',
				command: 'npx',
				args: [
					'mcp-remote',
					'https://mcp.jina.ai/v1',
					'--header',
					'Authorization: Bearer ${JINA_API_KEY}',
				],
				instruction: 'Use Jina for web search, URL reading, and semantic search.',
			});
		}
	}

	if (role === 'captioning' || role === 'idea_validator') {
		// Perplexity: Research with citations
		if (mcpEnabled.includes('perplexity')) {
			toolsets.push({
				type: 'mcp',
				command: 'npx',
				args: ['-y', '@perplexity-ai/mcp-server'],
				env: {
					PERPLEXITY_API_KEY: '${PERPLEXITY_API_KEY}',
				},
				instruction: 'Use Perplexity for deep research, trend analysis, and semantic reasoning.',
			});
		}
	}

	// Cloudinary: Asset management (conditional, only if enabled)
	if (mcpEnabled.includes('cloudinary') && (role === 'editing' || role === 'extraction')) {
		toolsets.push({
			type: 'mcp',
			command: 'npx',
			args: ['-y', '--package', '@cloudinary/asset-management-mcp', '--', 'mcp', 'start'],
			env: {
				CLOUDINARY_URL: '${CLOUDINARY_URL}',
			},
			instruction: 'Use Cloudinary for asset management, transformation, and storage.',
		});
	}

	return toolsets;
}
