import { redirect } from '@sveltejs/kit';

export function load() {
	// Immediate redirect to LLM providers page
	throw redirect(307, '/settings/llm-providers');
}
