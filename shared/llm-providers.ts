/**
 * Static data for LLM providers and their available models
 * Shared between main process and renderer
 * 
 * Updated: January 2026
 * Reference: .taskmaster/docs/cagent-team.md
 */

import type { LLMProviderInfo, LLMProviderId, AgentRole } from "./types";

export const LLM_PROVIDERS: Record<LLMProviderId, LLMProviderInfo> = {
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude models - Excellent for reasoning and analysis",
    website: "https://console.anthropic.com",
    apiKeyPrefix: "sk-ant-",
    apiKeyPlaceholder: "sk-ant-api03-...",
    models: [
      {
        id: "claude-opus-4.5",
        name: "Claude Opus 4.5",
        description: "Most capable model, best for complex reasoning",
        contextWindow: 200000,
      },
      {
        id: "claude-sonnet-4.5",
        name: "Claude Sonnet 4.5",
        description: "Best balance of intelligence and speed",
        contextWindow: 200000,
        recommended: true,
      },
      {
        id: "claude-haiku-4.5",
        name: "Claude Haiku 4.5",
        description: "Fastest model, great for simple tasks",
        contextWindow: 200000,
      },
      {
        id: "claude-opus-4.1",
        name: "Claude Opus 4.1",
        description: "Previous flagship, still excellent",
        contextWindow: 200000,
      },
    ],
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    description: "GPT models - Versatile and widely used",
    website: "https://platform.openai.com",
    apiKeyPrefix: "sk-",
    apiKeyPlaceholder: "sk-proj-...",
    models: [
      {
        id: "gpt-5.2",
        name: "GPT-5.2",
        description: "Latest flagship, fastest inference",
        contextWindow: 256000,
        recommended: true,
      },
      {
        id: "gpt-5.2-mini",
        name: "GPT-5.2 Mini",
        description: "Fast and cost-effective",
        contextWindow: 128000,
      },
      {
        id: "gpt-4o",
        name: "GPT-4o",
        description: "Multimodal model with vision",
        contextWindow: 128000,
      },
      {
        id: "gpt-4o-mini",
        name: "GPT-4o Mini",
        description: "Economical multimodal option",
        contextWindow: 128000,
      },
    ],
  },
  google: {
    id: "google",
    name: "Google AI",
    description: "Gemini models - Multimodal AI from Google",
    website: "https://aistudio.google.com",
    apiKeyPrefix: "AIza",
    apiKeyPlaceholder: "AIzaSy...",
    models: [
      {
        id: "gemini-3-pro",
        name: "Gemini 3 Pro",
        description: "Most capable Gemini model",
        contextWindow: 2000000,
        recommended: true,
      },
      {
        id: "gemini-3-flash",
        name: "Gemini 3 Flash",
        description: "Fast model for agentic workflows",
        contextWindow: 1000000,
      },
      {
        id: "gemini-3-flash-image",
        name: "Gemini 3 Flash Image",
        description: "Optimized for image understanding",
        contextWindow: 1000000,
      },
      {
        id: "gemini-2.5-pro",
        name: "Gemini 2.5 Pro",
        description: "Previous generation, still excellent",
        contextWindow: 2000000,
      },
    ],
  },
  perplexity: {
    id: "perplexity",
    name: "Perplexity",
    description: "Online models - Best for research with real-time web access",
    website: "https://www.perplexity.ai",
    apiKeyPrefix: "pplx-",
    apiKeyPlaceholder: "pplx-...",
    models: [
      {
        id: "sonar-pro",
        name: "Sonar Pro",
        description: "Most capable with web search",
        contextWindow: 200000,
        recommended: true,
      },
      {
        id: "sonar",
        name: "Sonar",
        description: "Fast with web search",
        contextWindow: 127000,
      },
      {
        id: "sonar-reasoning-pro",
        name: "Sonar Reasoning Pro",
        description: "Advanced reasoning with search",
        contextWindow: 127000,
      },
      {
        id: "sonar-reasoning",
        name: "Sonar Reasoning",
        description: "Reasoning capabilities with search",
        contextWindow: 127000,
      },
    ],
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    description: "Unified API - Access 200+ models with a single API key",
    website: "https://openrouter.ai",
    apiKeyPrefix: "sk-or-",
    apiKeyPlaceholder: "sk-or-v1-...",
    models: [
      // Anthropic via OpenRouter
      {
        id: "anthropic/claude-opus-4.5",
        name: "Claude Opus 4.5",
        description: "Anthropic's most capable model",
        contextWindow: 200000,
      },
      {
        id: "anthropic/claude-sonnet-4.5",
        name: "Claude Sonnet 4.5",
        description: "Best balance of quality and speed",
        contextWindow: 200000,
        recommended: true,
      },
      {
        id: "anthropic/claude-haiku-4.5",
        name: "Claude Haiku 4.5",
        description: "Fast and economical",
        contextWindow: 200000,
      },
      {
        id: "anthropic/claude-opus-4.1",
        name: "Claude Opus 4.1",
        description: "Previous flagship model",
        contextWindow: 200000,
      },
      // Google via OpenRouter
      {
        id: "google/gemini-3-pro",
        name: "Gemini 3 Pro",
        description: "Google's most capable model",
        contextWindow: 2000000,
      },
      {
        id: "google/gemini-3-flash",
        name: "Gemini 3 Flash",
        description: "Fast, great for agents",
        contextWindow: 1000000,
      },
      {
        id: "google/gemini-3-flash:free",
        name: "Gemini 3 Flash (Free)",
        description: "Free tier - rate limited",
        contextWindow: 1000000,
      },
      {
        id: "google/gemini-3-flash-image",
        name: "Gemini 3 Flash Image",
        description: "Optimized for vision tasks",
        contextWindow: 1000000,
      },
      // OpenAI via OpenRouter
      {
        id: "openai/gpt-5.2",
        name: "GPT-5.2",
        description: "OpenAI's latest flagship",
        contextWindow: 256000,
      },
      {
        id: "openai/gpt-5.2-mini",
        name: "GPT-5.2 Mini",
        description: "Fast and affordable",
        contextWindow: 128000,
      },
      {
        id: "openai/gpt-4o",
        name: "GPT-4o",
        description: "Multimodal with vision",
        contextWindow: 128000,
      },
      {
        id: "openai/gpt-4o-mini",
        name: "GPT-4o Mini",
        description: "Cost-effective multimodal",
        contextWindow: 128000,
      },
      // Outsiders / Open Source
      {
        id: "deepseek/deepseek-v3.2-speciale",
        name: "DeepSeek V3.2 Speciale",
        description: "Open weights, GPT-5 level quality",
        contextWindow: 128000,
      },
      {
        id: "deepseek/deepseek-v3.2",
        name: "DeepSeek V3.2",
        description: "Excellent cost/quality ratio",
        contextWindow: 128000,
      },
      {
        id: "moonshot/kimi-k2-thinking",
        name: "Kimi K2 Thinking",
        description: "Latest Moonshot reasoning model",
        contextWindow: 200000,
      },
      {
        id: "minimax/minimax-2.1",
        name: "MiniMax 2.1",
        description: "Great for content generation",
        contextWindow: 200000,
      },
      {
        id: "x-ai/grok-code-fast-1",
        name: "Grok Code Fast 1",
        description: "xAI's fast coding model",
        contextWindow: 131072,
      },
      {
        id: "qwen/qwen3-235b",
        name: "Qwen3 235B",
        description: "Alibaba's largest model",
        contextWindow: 131072,
      },
      {
        id: "meta-llama/llama-4-maverick",
        name: "Llama 4 Maverick",
        description: "Meta's latest open model",
        contextWindow: 131072,
      },
      {
        id: "mistralai/mistral-large-2",
        name: "Mistral Large 2",
        description: "Mistral's flagship model",
        contextWindow: 128000,
      },
    ],
  },
};

/**
 * Default model recommendations per agent role
 * See .taskmaster/docs/cagent-team.md for details
 */
export const DEFAULT_AGENT_MODELS: Record<LLMProviderId, Record<AgentRole, string>> = {
  anthropic: {
    orchestrator: "claude-opus-4.5",
    extraction: "claude-haiku-4.5",
    editing: "claude-sonnet-4.5",
    captioning: "claude-sonnet-4.5",
    scheduling: "claude-haiku-4.5",
  },
  openai: {
    orchestrator: "gpt-5.2",
    extraction: "gpt-4o-mini",
    editing: "gpt-4o",
    captioning: "gpt-5.2",
    scheduling: "gpt-4o-mini",
  },
  google: {
    orchestrator: "gemini-3-pro",
    extraction: "gemini-3-flash",
    editing: "gemini-3-pro",
    captioning: "gemini-3-pro",
    scheduling: "gemini-3-flash",
  },
  perplexity: {
    orchestrator: "sonar-pro",
    extraction: "sonar",
    editing: "sonar-pro",
    captioning: "sonar-reasoning-pro",
    scheduling: "sonar",
  },
  openrouter: {
    orchestrator: "anthropic/claude-opus-4.5",
    extraction: "google/gemini-3-flash",
    editing: "anthropic/claude-sonnet-4.5",
    captioning: "anthropic/claude-sonnet-4.5",
    scheduling: "openai/gpt-4o-mini",
  },
};

/**
 * Get provider info by ID
 */
export function getProviderInfo(providerId: LLMProviderId): LLMProviderInfo {
  return LLM_PROVIDERS[providerId];
}

/**
 * Get all provider IDs
 */
export function getAllProviderIds(): LLMProviderId[] {
  return Object.keys(LLM_PROVIDERS) as LLMProviderId[];
}

/**
 * Get recommended model for a provider (general recommendation)
 */
export function getRecommendedModel(providerId: LLMProviderId): string | null {
  const provider = LLM_PROVIDERS[providerId];
  const recommended = provider.models.find((m) => m.recommended);
  return recommended?.id ?? provider.models[0]?.id ?? null;
}

/**
 * Get recommended model for a specific agent role
 */
export function getRecommendedModelForAgent(
  providerId: LLMProviderId,
  agentRole: AgentRole
): string {
  return DEFAULT_AGENT_MODELS[providerId][agentRole];
}

/**
 * Validate API key format (basic check)
 */
export function validateApiKeyFormat(
  providerId: LLMProviderId,
  apiKey: string
): boolean {
  if (!apiKey || apiKey.length < 10) return false;

  const provider = LLM_PROVIDERS[providerId];
  // For OpenAI, check that it starts with 'sk-' but NOT 'sk-ant-' or 'sk-or-' (Anthropic/OpenRouter)
  if (providerId === "openai") {
    return apiKey.startsWith("sk-") && !apiKey.startsWith("sk-ant-") && !apiKey.startsWith("sk-or-");
  }
  return apiKey.startsWith(provider.apiKeyPrefix);
}

/**
 * Get all agent roles
 */
export function getAllAgentRoles(): AgentRole[] {
  return ["orchestrator", "extraction", "editing", "captioning", "scheduling"];
}
