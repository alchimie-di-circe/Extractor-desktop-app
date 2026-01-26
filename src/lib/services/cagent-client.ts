/**
 * HTTP Client for Cagent sidecar API
 *
 * Provides type-safe access to sidecar endpoints:
 * - /health - health checks
 * - /agent/execute - agent execution
 * - /agent/stream - event streaming
 * - /shutdown - shutdown notification
 */

import type { Readable } from 'stream';

interface AgentRequest {
	agent_id: string;
	input: Record<string, unknown>;
	context?: Record<string, unknown>;
}

interface AgentResponse {
	result: Record<string, unknown>;
	execution_time: number;
	agent_id: string;
}

interface HealthResponse {
	status: string;
	version: string;
}

interface StreamEvent {
	event_type: string;
	data: Record<string, unknown>;
	timestamp: number;
}

export class CagentClient {
	private baseUrl: string;

	constructor(baseUrl: string = 'http://127.0.0.1:8765') {
		this.baseUrl = baseUrl;
	}

	/**
	 * Update base URL (useful when port changes)
	 */
	setBaseUrl(url: string): void {
		this.baseUrl = url;
	}

	/**
	 * Health check
	 */
	async health(): Promise<HealthResponse> {
		const response = await fetch(`${this.baseUrl}/health`);
		if (!response.ok) {
			throw new Error(`Health check failed: ${response.statusText}`);
		}
		return response.json();
	}

	/**
	 * Execute an agent synchronously
	 */
	async executeAgent(request: AgentRequest): Promise<AgentResponse> {
		const response = await fetch(`${this.baseUrl}/agent/execute`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(request),
		});

		if (!response.ok) {
			throw new Error(`Agent execution failed: ${response.statusText}`);
		}

		return response.json();
	}

	/**
	 * Stream events from an agent execution
	 *
	 * Usage:
	 * ```typescript
	 * const eventSource = client.streamAgentEvents(requestId);
	 * for await (const event of eventSource) {
	 *   console.log(event.event_type, event.data);
	 * }
	 * ```
	 */
	streamAgentEvents(requestId: string): EventSource {
		const eventSource = new EventSource(`${this.baseUrl}/agent/stream/${requestId}`);
		return eventSource;
	}

	/**
	 * Notify sidecar of shutdown
	 */
	async shutdown(): Promise<void> {
		try {
			await fetch(`${this.baseUrl}/shutdown`, { method: 'POST' });
		} catch (error) {
			console.warn('Shutdown notification failed:', error);
			// Non-fatal, just log and continue
		}
	}

	/**
	 * Parse SSE stream events
	 */
	parseEventSource(
		eventSource: EventSource,
		onEvent: (event: StreamEvent) => void,
		onError?: (error: Error) => void,
		onClose?: () => void,
	): void {
		eventSource.addEventListener('thinking', (e) => {
			onEvent({
				event_type: 'thinking',
				data: JSON.parse((e as MessageEvent).data),
				timestamp: Date.now(),
			});
		});

		eventSource.addEventListener('tool_call', (e) => {
			onEvent({
				event_type: 'tool_call',
				data: JSON.parse((e as MessageEvent).data),
				timestamp: Date.now(),
			});
		});

		eventSource.addEventListener('result', (e) => {
			onEvent({
				event_type: 'result',
				data: JSON.parse((e as MessageEvent).data),
				timestamp: Date.now(),
			});
			eventSource.close();
			onClose?.();
		});

		eventSource.addEventListener('error', (e) => {
			const message = (e as MessageEvent).data || 'Unknown error';
			const error = new Error(`Agent error: ${message}`);
			onError?.(error);
			eventSource.close();
		});

		eventSource.addEventListener('keepalive', () => {
			// Keepalive, no action needed
		});

		eventSource.onerror = (error) => {
			onError?.(new Error('EventSource connection error'));
			eventSource.close();
		};
	}
}

// Export singleton instance
export const cagentClient = new CagentClient();
