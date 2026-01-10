/**
 * LLM Connector Service
 *
 * Handles connection testing for various LLM providers.
 * This service makes actual API calls to verify credentials work.
 */

import type { LLMProviderId, LLMConnectionResult } from "../shared/types";

/**
 * Provider API endpoints for connection testing
 */
const PROVIDER_ENDPOINTS: Record<LLMProviderId, string> = {
  anthropic: "https://api.anthropic.com/v1/messages",
  openai: "https://api.openai.com/v1/chat/completions",
  google: "https://generativelanguage.googleapis.com/v1beta/models",
  perplexity: "https://api.perplexity.ai/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
};

/**
 * Test connection to Anthropic API
 */
async function testAnthropic(
  apiKey: string,
  model: string
): Promise<LLMConnectionResult> {
  const startTime = Date.now();

  try {
    const response = await fetch(PROVIDER_ENDPOINTS.anthropic, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1,
        messages: [{ role: "user", content: "Hi" }],
      }),
    });

    const latencyMs = Date.now() - startTime;

    if (response.ok) {
      return {
        success: true,
        providerId: "anthropic",
        model,
        latencyMs,
      };
    }

    const errorData = await response.json().catch(() => ({}));
    return mapApiError("anthropic", model, response.status, errorData);
  } catch (err) {
    return {
      success: false,
      providerId: "anthropic",
      model,
      error: {
        code: "NETWORK_ERROR",
        message: err instanceof Error ? err.message : "Network request failed",
      },
    };
  }
}

/**
 * Test connection to OpenAI API
 */
async function testOpenAI(
  apiKey: string,
  model: string
): Promise<LLMConnectionResult> {
  const startTime = Date.now();

  try {
    const response = await fetch(PROVIDER_ENDPOINTS.openai, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 1,
        messages: [{ role: "user", content: "Hi" }],
      }),
    });

    const latencyMs = Date.now() - startTime;

    if (response.ok) {
      return {
        success: true,
        providerId: "openai",
        model,
        latencyMs,
      };
    }

    const errorData = await response.json().catch(() => ({}));
    return mapApiError("openai", model, response.status, errorData);
  } catch (err) {
    return {
      success: false,
      providerId: "openai",
      model,
      error: {
        code: "NETWORK_ERROR",
        message: err instanceof Error ? err.message : "Network request failed",
      },
    };
  }
}

/**
 * Test connection to Google AI API
 */
async function testGoogle(
  apiKey: string,
  model: string
): Promise<LLMConnectionResult> {
  const startTime = Date.now();

  try {
    // Google uses query param for API key and different endpoint structure
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Hi" }] }],
        generationConfig: { maxOutputTokens: 1 },
      }),
    });

    const latencyMs = Date.now() - startTime;

    if (response.ok) {
      return {
        success: true,
        providerId: "google",
        model,
        latencyMs,
      };
    }

    const errorData = await response.json().catch(() => ({}));
    return mapApiError("google", model, response.status, errorData);
  } catch (err) {
    return {
      success: false,
      providerId: "google",
      model,
      error: {
        code: "NETWORK_ERROR",
        message: err instanceof Error ? err.message : "Network request failed",
      },
    };
  }
}

/**
 * Test connection to Perplexity API
 */
async function testPerplexity(
  apiKey: string,
  model: string
): Promise<LLMConnectionResult> {
  const startTime = Date.now();

  try {
    const response = await fetch(PROVIDER_ENDPOINTS.perplexity, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 1,
        messages: [{ role: "user", content: "Hi" }],
      }),
    });

    const latencyMs = Date.now() - startTime;

    if (response.ok) {
      return {
        success: true,
        providerId: "perplexity",
        model,
        latencyMs,
      };
    }

    const errorData = await response.json().catch(() => ({}));
    return mapApiError("perplexity", model, response.status, errorData);
  } catch (err) {
    return {
      success: false,
      providerId: "perplexity",
      model,
      error: {
        code: "NETWORK_ERROR",
        message: err instanceof Error ? err.message : "Network request failed",
      },
    };
  }
}

/**
 * Test connection to OpenRouter API
 * OpenRouter uses OpenAI-compatible API format
 */
async function testOpenRouter(
  apiKey: string,
  model: string
): Promise<LLMConnectionResult> {
  const startTime = Date.now();

  try {
    const response = await fetch(PROVIDER_ENDPOINTS.openrouter, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://trae-extractor.local", // Required by OpenRouter
        "X-Title": "Trae Extractor", // Optional but recommended
      },
      body: JSON.stringify({
        model,
        max_tokens: 1,
        messages: [{ role: "user", content: "Hi" }],
      }),
    });

    const latencyMs = Date.now() - startTime;

    if (response.ok) {
      return {
        success: true,
        providerId: "openrouter",
        model,
        latencyMs,
      };
    }

    const errorData = await response.json().catch(() => ({}));
    return mapApiError("openrouter", model, response.status, errorData);
  } catch (err) {
    return {
      success: false,
      providerId: "openrouter",
      model,
      error: {
        code: "NETWORK_ERROR",
        message: err instanceof Error ? err.message : "Network request failed",
      },
    };
  }
}

/**
 * Map HTTP status codes and API errors to our error types
 */
function mapApiError(
  providerId: LLMProviderId,
  model: string,
  status: number,
  errorData: unknown
): LLMConnectionResult {
  // Extract error message from various API response formats
  let message = "Unknown error";
  if (typeof errorData === "object" && errorData !== null) {
    const data = errorData as Record<string, unknown>;
    if (typeof data.error === "object" && data.error !== null) {
      const err = data.error as Record<string, unknown>;
      message = String(err.message || err.msg || "Unknown error");
    } else if (typeof data.message === "string") {
      message = data.message;
    } else if (typeof data.error === "string") {
      message = data.error;
    }
  }

  if (status === 401 || status === 403) {
    return {
      success: false,
      providerId,
      model,
      error: {
        code: "INVALID_API_KEY",
        message: message || "Invalid or expired API key",
      },
    };
  }

  if (status === 429) {
    return {
      success: false,
      providerId,
      model,
      error: {
        code: "RATE_LIMIT",
        message: message || "Rate limit exceeded",
      },
    };
  }

  if (status === 404) {
    return {
      success: false,
      providerId,
      model,
      error: {
        code: "MODEL_NOT_FOUND",
        message: message || `Model "${model}" not found`,
      },
    };
  }

  return {
    success: false,
    providerId,
    model,
    error: {
      code: "UNKNOWN",
      message: message || `API returned status ${status}`,
    },
  };
}

/**
 * Test connection to an LLM provider
 *
 * @param providerId - The provider to test
 * @param apiKey - The API key to use
 * @param model - The model to test with
 * @returns Connection result with success status and optional latency
 */
export async function testLLMConnection(
  providerId: LLMProviderId,
  apiKey: string,
  model: string
): Promise<LLMConnectionResult> {
  switch (providerId) {
    case "anthropic":
      return testAnthropic(apiKey, model);
    case "openai":
      return testOpenAI(apiKey, model);
    case "google":
      return testGoogle(apiKey, model);
    case "perplexity":
      return testPerplexity(apiKey, model);
    case "openrouter":
      return testOpenRouter(apiKey, model);
    default:
      return {
        success: false,
        providerId,
        model,
        error: {
          code: "UNKNOWN",
          message: `Unknown provider: ${providerId}`,
        },
      };
  }
}
