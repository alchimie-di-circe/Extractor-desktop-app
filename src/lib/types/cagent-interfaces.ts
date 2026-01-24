/**
 * TypeScript Type Definitions for Cagent Framework
 *
 * Complete type system for cagent agent configuration, representing:
 * - Agent roles (6 specialized agents)
 * - MCP toolsets and their configurations
 * - RAG (Retrieval-Augmented Generation) configurations
 * - Agent configurations with all official fields
 * - Complete team YAML structure
 *
 * References:
 * - https://docs.docker.com/ai/cagent/reference/config/
 * - https://docs.docker.com/ai/cagent/reference/toolsets/
 * - https://docs.docker.com/ai/cagent/rag/
 */

/**
 * Enumeration of all supported agent roles in the TRAE ecosystem
 *
 * - ORCHESTRATOR: Coordinates workflow and delegates tasks
 * - EXTRACTION: Extracts content from media files
 * - EDITING: Performs editing and formatting operations
 * - CAPTIONING: Generates captions and descriptions
 * - SCHEDULING: Plans and schedules content publication
 * - IDEA_VALIDATOR: Validates ideas, analyzes trends, proposes alternatives
 */
export enum AgentRole {
	ORCHESTRATOR = 'orchestrator',
	EXTRACTION = 'extraction',
	EDITING = 'editing',
	CAPTIONING = 'captioning',
	SCHEDULING = 'scheduling',
	IDEA_VALIDATOR = 'idea_validator',
}

/**
 * MCP (Model Context Protocol) remote server configuration
 * Used for SSE or HTTP-based MCP connections
 */
export interface MCPRemoteConfig {
	/** Remote endpoint URL (e.g., https://mcp.jina.ai/v1) */
	url: string;
	/** Transport type: 'sse' (Server-Sent Events) or 'http' */
	transport_type: 'sse' | 'http';
	/** Optional HTTP headers for authentication */
	headers?: Record<string, string>;
}

/**
 * MCP (Model Context Protocol) Toolset Configuration
 * Represents tools available to agents (MCP, built-in, or Docker gateway)
 */
export interface MCPToolset {
	/** Toolset type */
	type:
		| 'mcp'
		| 'think'
		| 'memory'
		| 'filesystem'
		| 'shell'
		| 'todo'
		| 'fetch'
		| 'api'
		| 'script_shell';

	/** Command to execute (for local MCP servers or custom tools) */
	command?: string;

	/** Command arguments (array format) */
	args?: string[];

	/** Environment variables for the toolset */
	env?: Record<string, string>;

	/** Remote MCP server configuration (for SSE/HTTP-based servers) */
	remote?: MCPRemoteConfig;

	/** Docker MCP Gateway reference (e.g., 'docker:duckduckgo', 'docker:filesystem') */
	ref?: string;

	/** Specific tools to enable (whitelist). If omitted, all tools are available */
	tools?: string[];

	/** Additional usage instructions for the toolset */
	instruction?: string;

	/** Defer tool loading (true for all, array for specific tools) */
	defer?: boolean | string[];

	/** Output compression for JSON results (comma-delimited regex patterns) */
	toon?: string;

	/** Enable Code Mode for tool orchestration */
	code_mode_tools?: boolean;

	/** Database path (for memory toolset) */
	path?: string;

	/** Share todos across agents (for todo toolset) */
	shared?: boolean;
}

/**
 * RAG (Retrieval-Augmented Generation) Retrieval Strategy
 * Defines how documents are indexed and retrieved
 */
export interface RAGStrategy {
	/** Strategy type: semantic embeddings, keyword search, or LLM-enhanced semantic */
	type: 'chunked-embeddings' | 'semantic-embeddings' | 'bm25';

	/** Embedding model identifier (e.g., 'openai/text-embedding-3-small') */
	embedding_model?: string;

	/** Chat model for semantic summary generation (semantic-embeddings only) */
	chat_model?: string;

	/** Vector database path for storing embeddings */
	database: string;

	/** Number of dimensions in vector embeddings */
	vector_dimensions?: number;

	/** Similarity metric for embeddings: 'cosine', 'euclidean', etc. (default: 'cosine') */
	similarity_metric?: string;

	/** Similarity threshold for filtering results (0-1, default: 0.5) */
	threshold?: number;

	/** Maximum number of results to return from this strategy */
	limit?: number;

	/** Include AST metadata in semantic prompts (semantic-embeddings only) */
	ast_context?: boolean;

	/** Custom semantic prompt for chunk summarization */
	semantic_prompt?: string;

	/** BM25 k1 parameter (affects term frequency importance, default: 1.5) */
	k1?: number;

	/** BM25 b parameter (controls length normalization, default: 0.75) */
	b?: number;

	/** Chunking configuration */
	chunking?: {
		/** Chunk size in characters (Unicode code points) */
		size: number;
		/** Overlap between chunks in characters */
		overlap: number;
		/** Respect word boundaries when chunking */
		respect_word_boundaries?: boolean;
		/** Enable AST-based chunking for code (Go only currently) */
		code_aware?: boolean;
	};
}

/**
 * RAG Fusion strategy for combining multiple retrieval strategies
 */
export interface RAGFusion {
	/** Fusion algorithm: RRF (recommended), weighted, or max */
	strategy: 'rrf' | 'weighted' | 'max';

	/** RRF smoothing parameter (default: 60) */
	k?: number;

	/** Weights for weighted fusion (e.g., { 'chunked-embeddings': 0.7, 'bm25': 0.3 }) */
	weights?: Record<string, number>;
}

/**
 * RAG Result Post-processing Configuration
 */
export interface RAGResults {
	/** Fusion configuration for combining multiple strategies */
	fusion?: RAGFusion;

	/** Remove duplicate results */
	deduplicate?: boolean;

	/** Include similarity scores in results */
	include_score?: boolean;

	/** Maximum number of final results to return */
	limit?: number;

	/** Reranking configuration */
	reranking?: {
		/** Reranker model identifier */
		model: string;
		/** Only rerank top K results (0 = all) */
		top_k?: number;
		/** Minimum score threshold after reranking */
		threshold?: number;
		/** Domain-specific reranking criteria and guidance */
		criteria?: string;
	};

	/** Return full document content instead of truncated chunks */
	return_full_content?: boolean;
}

/**
 * RAG (Retrieval-Augmented Generation) Configuration
 * Represents a knowledge base with retrieval strategies
 */
export interface RAGConfig {
	/** Name of the RAG source (for referencing in agents) */
	name: string;

	/** Document sources (file paths or glob patterns) */
	docs: string[];

	/** Retrieval strategies (can combine multiple for hybrid search) */
	strategies: RAGStrategy[];

	/** Result post-processing and fusion configuration */
	results?: RAGResults;

	/** Custom RAG tool configuration */
	tool?: {
		name?: string;
		description?: string;
		instruction?: string;
	};
}

/**
 * Agent Configuration
 * Represents a single cagent agent with its role, model, and toolsets
 */
export interface AgentConfig {
	/** Agent role/identity */
	role: AgentRole;

	/** Model identifier (e.g., 'anthropic/claude-sonnet-4-5', 'openai/gpt-5', 'dmr/ai/qwen3') */
	model: string;

	/** Brief description of agent's purpose */
	description: string;

	/** Detailed behavior instructions */
	instruction?: string;

	/** Paths to prompt files to include in context */
	add_prompt_files?: string[];

	/** References to RAG sources by name */
	rag?: string[];

	/** Toolsets available to this agent */
	toolsets?: MCPToolset[];

	/** Sub-agents for task delegation */
	sub_agents?: AgentRole[];

	/** Agents for conversation handoff */
	handoffs?: AgentRole[];

	/** Welcome message displayed on session start */
	welcome_message?: string;

	/** Include current date in agent context */
	add_date?: boolean;

	/** Include environment info (working directory, OS, Git) */
	add_environment_info?: boolean;

	/** Maximum agentic loop iterations */
	max_iterations?: number;

	/** Conversation history limit */
	num_history_items?: number;

	/** Enable Code Mode for tools */
	code_mode_tools?: boolean;

	/** Named prompts accessible via /command_name */
	commands?: Record<string, string>;

	/** JSON schema for structured output responses */
	structured_output?: {
		name: string;
		strict: boolean;
		schema: Record<string, unknown>;
	};
}

/**
 * Model Configuration
 * Defines model-specific settings and parameters
 */
export interface ModelConfig {
	/** Model provider: 'openai', 'anthropic', 'google', 'dmr', or custom */
	provider?: string;

	/** Model name/identifier */
	model: string;

	/** Temperature for response randomness (0.0-2.0) */
	temperature?: number;

	/** Maximum response length in tokens */
	max_tokens?: number;

	/** Nucleus sampling parameter (0.0-1.0) */
	top_p?: number;

	/** Frequency penalty for OpenAI models (-2.0 to 2.0) */
	frequency_penalty?: number;

	/** Presence penalty for OpenAI models (-2.0 to 2.0) */
	presence_penalty?: number;

	/** Custom API endpoint URL */
	base_url?: string;

	/** Enable parallel tool execution (default: true) */
	parallel_tool_calls?: boolean;

	/** Environment variable key for authentication token */
	token_key?: string;

	/** Track token usage */
	track_usage?: boolean;

	/** Reasoning effort budget (provider-specific) */
	thinking_budget?: string | number;

	/** Provider-specific options */
	provider_opts?: {
		runtime_flags?: string[] | string;
		speculative_draft_model?: string;
		speculative_num_tokens?: number;
		speculative_acceptance_rate?: number;
		interleaved_thinking?: boolean;
		[key: string]: unknown;
	};
}

/**
 * Metadata for agent or team documentation
 */
export interface CagentMetadata {
	/** Author name */
	author?: string;

	/** License (e.g., MIT, Apache-2.0) */
	license?: string;

	/** Usage documentation and description */
	readme?: string;
}

/**
 * Complete Cagent Team YAML Configuration
 * Root structure representing the entire multi-agent system
 */
export interface CagentTeamYAML {
	/** Configuration version */
	version: string;

	/** Agent definitions */
	agents: Record<string, AgentConfig>;

	/** Model configurations (reusable model definitions) */
	models?: Record<string, ModelConfig>;

	/** RAG (Retrieval-Augmented Generation) sources */
	rag?: Record<string, RAGConfig>;

	/** Shared toolsets (optional, can also be per-agent) */
	toolsets?: MCPToolset[];

	/** Metadata about the team/author */
	metadata?: CagentMetadata;
}

/**
 * Supported Provider Types
 */
export type ProviderType = 'openai' | 'anthropic' | 'google' | 'dmr';

/**
 * Supported Toolset Types
 */
export type ToolsetType =
	| 'mcp'
	| 'think'
	| 'memory'
	| 'filesystem'
	| 'shell'
	| 'todo'
	| 'fetch'
	| 'api'
	| 'script_shell';

/**
 * Supported RAG Strategy Types
 */
export type RAGStrategyType = 'chunked-embeddings' | 'semantic-embeddings' | 'bm25';

/**
 * Helper type for union of all numeric limits
 */
export type LimitValue = number | undefined;

/**
 * Helper type for model identifier strings
 */
export type ModelIdentifier = string;
