<script lang="ts">
import {
	AlertCircle,
	CheckCircle2,
	ChevronDown,
	ChevronUp,
	Copy,
	Database,
	RotateCw,
	Save,
	Settings,
	Zap,
} from '@lucide/svelte';
import { onMount } from 'svelte';
import { toast } from 'svelte-sonner';
import { Badge } from '$lib/components/ui/badge/index.js';
import { Button } from '$lib/components/ui/button/index.js';
import * as Card from '$lib/components/ui/card/index.js';
import { Input } from '$lib/components/ui/input/index.js';
import { Label } from '$lib/components/ui/label/index.js';
import * as Select from '$lib/components/ui/select/index.js';
import { Separator } from '$lib/components/ui/separator/index.js';
import * as Tabs from '$lib/components/ui/tabs/index.js';

import { AgentRole } from '../../../lib/types/cagent-interfaces';

// ========== State Management (Svelte 5 Runes) ==========
let agentConfigs = $state<
	Record<string, { enabled: boolean; model: string; systemPrompt: string }>
>({
	orchestrator: { enabled: true, model: 'anthropic/claude-sonnet-4-5', systemPrompt: '' },
	extraction: { enabled: true, model: 'anthropic/claude-sonnet-4-5', systemPrompt: '' },
	creative_planner: { enabled: true, model: 'anthropic/claude-sonnet-4-5', systemPrompt: '' },
	creative_worker: { enabled: true, model: 'anthropic/claude-haiku-4-5', systemPrompt: '' },
	captioning: { enabled: true, model: 'anthropic/claude-sonnet-4-5', systemPrompt: '' },
	scheduling: { enabled: true, model: 'anthropic/claude-haiku-4-5', systemPrompt: '' },
	idea_validator: { enabled: true, model: 'anthropic/claude-sonnet-4-5', systemPrompt: '' },
});

let enabledMcp = $state<Set<string>>(
	new Set(['perplexity', 'firecrawl', 'jina', 'cloudinary', 'shotstack']),
);
let enabledRag = $state<Set<string>>(
	new Set(['brand_guidelines', 'platform_specs', 'competitors', 'mcp_tools_knowledge']),
);

let isLoading = $state(false);
let expandedAgents = $state<Set<string>>(new Set());
let generationResult = $state<{ yaml: string; filePath: string; dirsCreated: string[] } | null>(
	null,
);
let sidecarReloadStatus = $state<{
	isWatching: boolean;
	lastReload: number | null;
	reloadCount: number;
	isReloading: boolean;
	sidecarPid: number | null;
} | null>(null);
let reloadMessage = $state<string>('');
let isReloadingManually = $state(false);

// ========== Derived State ==========
const isDirty = $derived(
	Object.values(agentConfigs).some((config) => config.enabled) ||
		enabledMcp.size > 0 ||
		enabledRag.size > 0,
);

const isValid = $derived.by(() => {
	const hasEnabledAgent = Object.values(agentConfigs).some((config) => config.enabled);
	const allEnabledAgentsHaveModel = Object.entries(agentConfigs).every(
		([_, config]) => !config.enabled || config.model.trim() !== '',
	);
	return hasEnabledAgent && allEnabledAgentsHaveModel;
});

// ========== Agent Metadata ==========
const agents: Array<{
	id: string;
	role: AgentRole;
	label: string;
	description: string;
	defaultModel: string;
}> = [
	{
		id: 'orchestrator',
		role: AgentRole.ORCHESTRATOR,
		label: 'Orchestrator',
		description: 'Coordina workflow e delega task tra gli agent',
		defaultModel: 'anthropic/claude-sonnet-4-5',
	},
	{
		id: 'extraction',
		role: AgentRole.EXTRACTION,
		label: 'Extraction',
		description: 'Estrae foto da Apple Photos e analizza metadata',
		defaultModel: 'anthropic/claude-sonnet-4-5',
	},
	{
		id: 'creative_planner',
		role: AgentRole.CREATIVE_PLANNER,
		label: 'Creative Planner',
		description: 'Pianifica workflow di editing per immagini e video',
		defaultModel: 'anthropic/claude-sonnet-4-5',
	},
	{
		id: 'creative_worker',
		role: AgentRole.CREATIVE_WORKER,
		label: 'Creative Worker',
		description: 'Esegue piani di editing via Cloudinary e Shotstack',
		defaultModel: 'anthropic/claude-haiku-4-5',
	},
	{
		id: 'captioning',
		role: AgentRole.CAPTIONING,
		label: 'Captioning',
		description: 'Genera caption per social con brand voice',
		defaultModel: 'anthropic/claude-sonnet-4-5',
	},
	{
		id: 'scheduling',
		role: AgentRole.SCHEDULING,
		label: 'Scheduling',
		description: 'Programma pubblicazioni su social media',
		defaultModel: 'anthropic/claude-haiku-4-5',
	},
	{
		id: 'idea_validator',
		role: AgentRole.IDEA_VALIDATOR,
		label: 'IDEA Validator',
		description: 'Valida idee contenuto, analizza trend, propone alternative',
		defaultModel: 'anthropic/claude-sonnet-4-5',
	},
];

const mcpTools = [
	{
		id: 'perplexity',
		label: 'Perplexity',
		description: 'Web research with citations and reasoning',
		enabled: true,
	},
	{
		id: 'firecrawl',
		label: 'Firecrawl',
		description: 'Web scraping and extraction',
		enabled: true,
	},
	{
		id: 'jina',
		label: 'Jina AI',
		description: 'URL reading and web search',
		enabled: true,
	},
	{
		id: 'cloudinary',
		label: 'Cloudinary',
		description: 'Image and asset management',
		enabled: false,
	},
	{
		id: 'shotstack',
		label: 'Shotstack',
		description: 'Video production and timeline rendering',
		enabled: false,
	},
];

const ragSources = [
	{
		id: 'brand_guidelines',
		label: 'Brand Guidelines',
		description: 'Brand voice, values, visual guidelines',
		enabled: true,
	},
	{
		id: 'platform_specs',
		label: 'Platform Specs',
		description: 'Platform dimensions, formats, best practices',
		enabled: true,
	},
	{
		id: 'competitors',
		label: 'Competitors',
		description: 'Competitor analysis and benchmarking',
		enabled: true,
	},
	{
		id: 'mcp_tools_knowledge',
		label: 'MCP Tools Knowledge',
		description: 'MCP tools specifications and usage patterns',
		enabled: false,
	},
];

const modelOptions = [
	{ value: 'anthropic/claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
	{ value: 'anthropic/claude-opus-4-5', label: 'Claude Opus 4.5' },
	{ value: 'anthropic/claude-haiku-4-5', label: 'Claude Haiku 4.5' },
	{ value: 'openai/gpt-5', label: 'GPT-5' },
	{ value: 'openai/gpt-5-mini', label: 'GPT-5 Mini' },
	{ value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
	{ value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
	{ value: 'dmr/ai/qwen3', label: 'DMR: Qwen 3' },
];

// ========== UI Handlers ==========
function toggleAgent(agentId: string): void {
	agentConfigs[agentId].enabled = !agentConfigs[agentId].enabled;
}

function updateAgentModel(agentId: string, model: string): void {
	agentConfigs[agentId].model = model;
}

function toggleMcp(mcpId: string): void {
	const newSet = new Set(enabledMcp);
	if (newSet.has(mcpId)) {
		newSet.delete(mcpId);
	} else {
		newSet.add(mcpId);
	}
	enabledMcp = newSet;
}

function toggleRag(ragId: string): void {
	const newSet = new Set(enabledRag);
	if (newSet.has(ragId)) {
		newSet.delete(ragId);
	} else {
		newSet.add(ragId);
	}
	enabledRag = newSet;
}

function toggleAccordion(agentId: string): void {
	const newSet = new Set(expandedAgents);
	if (newSet.has(agentId)) {
		newSet.delete(agentId);
	} else {
		newSet.add(agentId);
	}
	expandedAgents = newSet;
}

function resetForm(): void {
	agentConfigs = {
		orchestrator: { enabled: true, model: 'anthropic/claude-sonnet-4-5', systemPrompt: '' },
		extraction: { enabled: true, model: 'anthropic/claude-sonnet-4-5', systemPrompt: '' },
		creative_planner: { enabled: true, model: 'anthropic/claude-sonnet-4-5', systemPrompt: '' },
		creative_worker: { enabled: true, model: 'anthropic/claude-haiku-4-5', systemPrompt: '' },
		captioning: { enabled: true, model: 'anthropic/claude-sonnet-4-5', systemPrompt: '' },
		scheduling: { enabled: true, model: 'anthropic/claude-haiku-4-5', systemPrompt: '' },
		idea_validator: { enabled: true, model: 'anthropic/claude-sonnet-4-5', systemPrompt: '' },
	};
	enabledMcp = new Set(['perplexity', 'firecrawl', 'jina', 'cloudinary', 'shotstack']);
	enabledRag = new Set([
		'brand_guidelines',
		'platform_specs',
		'competitors',
		'mcp_tools_knowledge',
	]);
	expandedAgents = new Set();
	generationResult = null;
}

async function handleGenerateYaml(): Promise<void> {
	// Validate form
	if (!isValid) {
		if (Object.values(agentConfigs).every((config) => !config.enabled)) {
			toast.error('Validation Error', {
				description: 'At least one agent must be enabled',
			});
		} else {
			toast.error('Validation Error', {
				description: 'All enabled agents must have a model selected',
			});
		}
		return;
	}

	isLoading = true;
	try {
		// Prepare configuration for IPC call
		const config = {
			agents: Object.entries(agentConfigs)
				.filter(([_, agentConfig]) => agentConfig.enabled)
				.reduce(
					(acc, [agentId, agentConfig]) => {
						acc[agentId] = {
							model: agentConfig.model,
							systemPrompt: agentConfig.systemPrompt || undefined,
						};
						return acc;
					},
					{} as Record<string, { model: string; systemPrompt?: string }>,
				),
			enabledMcp: Array.from(enabledMcp),
			ragSources: Array.from(enabledRag),
			autoCreateDirs: true,
		};

		// Call IPC
		const result = await window.electronAPI.cagent.generateYaml(config);

		if (!result.success) {
			toast.error('Generation Error', {
				description: result.error.message,
			});
			return;
		}

		// Store result
		generationResult = result.data;

		// Show success toast with copy option
		toast.success('team.yaml Generated Successfully!', {
			description: `Saved to: ${result.data.filePath}`,
			action: {
				label: 'Copy Path',
				onClick: () => {
					navigator.clipboard.writeText(result.data.filePath);
					toast.success('Path copied to clipboard');
				},
			},
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
		toast.error('Generation Failed', {
			description: errorMessage,
		});
	} finally {
		isLoading = false;
	}
}

function copyToClipboard(text: string, label: string): void {
	navigator.clipboard.writeText(text);
	toast.success(`${label} copied to clipboard`);
}

async function fetchSidecarReloadStatus(): Promise<void> {
	try {
		const status = await window.electronAPI.sidecar.getReloadStatus();
		sidecarReloadStatus = status;
	} catch (error) {
		console.error('Failed to fetch sidecar reload status:', error);
	}
}

async function handleForceReload(): Promise<void> {
	isReloadingManually = true;
	reloadMessage = 'Reloading sidecar...';
	try {
		const result = await window.electronAPI.sidecar.forceReload();
		if (result.success) {
			reloadMessage = 'Sidecar reloaded successfully!';
			await fetchSidecarReloadStatus();
			toast.success('Sidecar Reloaded', {
				description: 'The sidecar process has been reloaded with the latest team.yaml',
			});
		} else {
			const errorMessage = result.error?.message || result.error || 'Unknown error occurred';
			reloadMessage = `Reload failed: ${errorMessage}`;
			toast.error('Reload Failed', {
				description: errorMessage,
			});
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		reloadMessage = `Error: ${errorMessage}`;
		toast.error('Reload Error', {
			description: errorMessage,
		});
	} finally {
		isReloadingManually = false;
		// Clear message after 3 seconds
		setTimeout(() => {
			reloadMessage = '';
		}, 3000);
	}
}

onMount(() => {
	// Initialize expanded state
	expandedAgents = new Set(['orchestrator']);

	// Fetch initial sidecar reload status
	fetchSidecarReloadStatus();

	// Listen for reload events
	const unsubscribe = window.electronAPI?.sidecar?.onSidecarReloadEvent((event) => {
		console.log('[Sidecar Reload Event]', event);
		reloadMessage = event.message;

		// Refresh status after reload completes
		if (event.type === 'reload-completed' || event.type === 'reload-failed') {
			setTimeout(fetchSidecarReloadStatus, 500);

			if (event.type === 'reload-completed') {
				toast.success('Sidecar Reloaded', {
					description: 'The sidecar process has been reloaded successfully',
				});
			} else if (event.type === 'reload-failed') {
				toast.error('Reload Failed', {
					description: event.error || event.message,
				});
			}
		}

		// Clear message after 4 seconds
		setTimeout(() => {
			reloadMessage = '';
		}, 4000);
	});

	return () => {
		unsubscribe?.();
	};
});
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="space-y-2">
		<h1 class="text-3xl font-bold tracking-tight">Agent Configuration</h1>
		<p class="text-base text-muted-foreground">
			Configure your 6 specialized agents, MCP tools, and RAG sources
		</p>
	</div>

	<!-- Tabs Layout -->
	<Tabs.Root value="agents" class="w-full">
		<Tabs.List class="grid w-full grid-cols-4">
			<Tabs.Trigger value="agents">Agents</Tabs.Trigger>
			<Tabs.Trigger value="mcp" class="flex items-center gap-2">
				<Zap class="h-4 w-4" />
				MCP Tools
			</Tabs.Trigger>
			<Tabs.Trigger value="rag" class="flex items-center gap-2">
				<Database class="h-4 w-4" />
				RAG Sources
			</Tabs.Trigger>
			<Tabs.Trigger value="generation" class="flex items-center gap-2">
				<Save class="h-4 w-4" />
				Generation
			</Tabs.Trigger>
		</Tabs.List>

		<!-- AGENTS TAB -->
		<Tabs.Content value="agents" class="space-y-4">
			<p class="text-sm text-muted-foreground">
				Configure individual agents: enable/disable, select model, add custom instructions
			</p>

			<div class="space-y-3">
				{#each agents as agent (agent.id)}
					<Card.Root
						class={`transition-all ${agentConfigs[agent.id].enabled ? 'border-primary' : 'border-border'}`}
					>
						<Card.Header class="pb-3">
							<div class="flex items-center justify-between">
								<div class="flex-1">
									<div class="flex items-center gap-3">
										<!-- Enable/Disable Toggle -->
										<label class="flex items-center gap-2 cursor-pointer">
											<input
												type="checkbox"
												checked={agentConfigs[agent.id].enabled}
												onchange={() => toggleAgent(agent.id)}
												class="h-4 w-4 rounded border border-input bg-background"
											/>
											<span class="sr-only">Enable {agent.label}</span>
										</label>

										<div>
											<Card.Title class="text-base">{agent.label}</Card.Title>
											<p class="text-xs text-muted-foreground">{agent.description}</p>
										</div>
									</div>
								</div>

								<!-- Expand/Collapse Button -->
								<button
									type="button"
									onclick={() => toggleAccordion(agent.id)}
									class="p-1 hover:bg-accent rounded"
									aria-label="Toggle {agent.label} details"
								>
									{#if expandedAgents.has(agent.id)}
										<ChevronUp class="h-4 w-4" />
									{:else}
										<ChevronDown class="h-4 w-4" />
									{/if}
								</button>
							</div>
						</Card.Header>

						<!-- Expanded Details -->
						{#if expandedAgents.has(agent.id)}
							<Separator />
							<Card.Content class="pt-4 space-y-4">
								<!-- Model Selection -->
								<div class="space-y-2">
									<Label for="model-{agent.id}" class="text-sm font-medium">Model</Label>
									<Select.Root
										type="single"
										value={agentConfigs[agent.id].model}
										onValueChange={(v) => updateAgentModel(agent.id, v)}
									>
										<Select.Trigger id="model-{agent.id}">
											{#if agentConfigs[agent.id].model}
												<span>
													{modelOptions.find((opt) => opt.value === agentConfigs[agent.id].model)?.label}
												</span>
											{:else}
												<span class="text-muted-foreground">Select a model</span>
											{/if}
										</Select.Trigger>
										<Select.Content>
											{#each modelOptions as option}
												<Select.Item value={option.value}>{option.label}</Select.Item>
											{/each}
										</Select.Content>
									</Select.Root>
									{#if agentConfigs[agent.id].enabled && !agentConfigs[agent.id].model}
										<p class="text-xs text-destructive">Model is required</p>
									{/if}
								</div>

								<!-- System Prompt (Optional) -->
								<div class="space-y-2">
									<Label for="prompt-{agent.id}" class="text-sm font-medium">
										System Prompt <span class="text-xs text-muted-foreground">(optional)</span>
									</Label>
									<textarea
										id="prompt-{agent.id}"
										bind:value={agentConfigs[agent.id].systemPrompt}
										placeholder="Enter custom system prompt to override defaults..."
										class="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
										disabled={!agentConfigs[agent.id].enabled}
									></textarea>
									<p class="text-xs text-muted-foreground">
										Leave empty to use default prompts from config
									</p>
								</div>
							</Card.Content>
						{/if}
					</Card.Root>
				{/each}
			</div>

			<!-- Agent Status Summary -->
			<div class="rounded-lg bg-muted p-3">
				<div class="flex items-start gap-2 text-sm">
					<CheckCircle2 class="h-4 w-4 mt-0.5 flex-shrink-0 text-green-600" />
					<div>
						<p class="font-medium">
							{Object.values(agentConfigs).filter((a) => a.enabled).length} of 6 agents enabled
						</p>
						<p class="text-xs text-muted-foreground">
							All enabled agents have valid model assignments
						</p>
					</div>
				</div>
			</div>
		</Tabs.Content>

		<!-- MCP TOOLS TAB -->
		<Tabs.Content value="mcp" class="space-y-4">
			<p class="text-sm text-muted-foreground">
				Select MCP (Model Context Protocol) tools available to all agents
			</p>

			<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
				{#each mcpTools as tool (tool.id)}
					<Card.Root class="p-4">
						<div class="flex items-start gap-3">
							<input
								type="checkbox"
								id="mcp-{tool.id}"
								checked={enabledMcp.has(tool.id)}
								onchange={() => toggleMcp(tool.id)}
								class="h-4 w-4 rounded border border-input bg-background mt-1"
							/>
							<div class="flex-1 min-w-0">
								<label for="mcp-{tool.id}" class="cursor-pointer">
									<p class="text-sm font-medium leading-none">{tool.label}</p>
									<p class="text-xs text-muted-foreground mt-1">{tool.description}</p>
								</label>
							</div>
							{#if enabledMcp.has(tool.id)}
								<Badge variant="default" class="text-xs flex-shrink-0">Active</Badge>
							{/if}
						</div>
					</Card.Root>
				{/each}
			</div>

			<!-- MCP Status -->
			<div class="rounded-lg bg-muted p-3">
				<p class="text-sm font-medium">
					{enabledMcp.size} of {mcpTools.length} tools enabled
				</p>
				{#if enabledMcp.size > 0}
					<p class="text-xs text-muted-foreground mt-1">
						{Array.from(enabledMcp)
							.map((id) => mcpTools.find((t) => t.id === id)?.label)
							.join(', ')}
					</p>
				{/if}
			</div>
		</Tabs.Content>

		<!-- RAG SOURCES TAB -->
		<Tabs.Content value="rag" class="space-y-4">
			<p class="text-sm text-muted-foreground">
				Select RAG (Retrieval-Augmented Generation) knowledge sources
			</p>

			<div class="space-y-3">
				{#each ragSources as source (source.id)}
					<Card.Root class="p-4">
						<div class="flex items-start gap-3">
							<input
								type="checkbox"
								id="rag-{source.id}"
								checked={enabledRag.has(source.id)}
								onchange={() => toggleRag(source.id)}
								class="h-4 w-4 rounded border border-input bg-background mt-1"
							/>
							<div class="flex-1 min-w-0">
								<label for="rag-{source.id}" class="cursor-pointer">
									<p class="text-sm font-medium leading-none">{source.label}</p>
									<p class="text-xs text-muted-foreground mt-1">{source.description}</p>
								</label>
							</div>
							{#if enabledRag.has(source.id)}
								<Badge variant="default" class="text-xs flex-shrink-0">Active</Badge>
							{/if}
						</div>
					</Card.Root>
				{/each}
			</div>

			<!-- RAG Status -->
			<div class="rounded-lg bg-muted p-3">
				<p class="text-sm font-medium">
					{enabledRag.size} of {ragSources.length} sources enabled
				</p>
				{#if enabledRag.size > 0}
					<p class="text-xs text-muted-foreground mt-1">
						{Array.from(enabledRag)
							.map((id) => ragSources.find((s) => s.id === id)?.label)
							.join(', ')}
					</p>
				{/if}
			</div>
		</Tabs.Content>

		<!-- GENERATION TAB -->
		<Tabs.Content value="generation" class="space-y-4">
			<p class="text-sm text-muted-foreground">
				Generate and save the team.yaml configuration file
			</p>

			<!-- Sidecar Reload Status -->
			{#if sidecarReloadStatus}
				<div class="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<div
								class={`h-2.5 w-2.5 rounded-full ${
									sidecarReloadStatus.isReloading
										? 'animate-pulse bg-yellow-500'
										: sidecarReloadStatus.isWatching
											? 'bg-green-500'
											: 'bg-gray-500'
								}`}
							></div>
							<p class="text-sm font-medium">
								{#if sidecarReloadStatus.isReloading}
									Sidecar Reloading...
								{:else if sidecarReloadStatus.isWatching}
									Hot-Reload Active
								{:else}
									Hot-Reload Inactive
								{/if}
							</p>
						</div>
						<Badge variant={sidecarReloadStatus.isWatching ? 'default' : 'outline'} class="text-xs">
							{#if sidecarReloadStatus.lastReload}
								Reloaded {new Date(sidecarReloadStatus.lastReload).toLocaleTimeString()}
							{:else}
								Never reloaded
							{/if}
						</Badge>
					</div>

					{#if sidecarReloadStatus.sidecarPid}
						<p class="text-xs text-muted-foreground">
							Sidecar PID: <code class="bg-background rounded px-1">{sidecarReloadStatus.sidecarPid}</code>
							• Reloads: <code class="bg-background rounded px-1">{sidecarReloadStatus.reloadCount}</code>
						</p>
					{/if}

					{#if reloadMessage}
						<div class="flex items-start gap-2 rounded bg-background p-2.5">
							<div class="mt-0.5 h-4 w-4 flex-shrink-0">
								{#if isReloadingManually || sidecarReloadStatus.isReloading}
									<div class="animate-spin text-blue-500">↻</div>
								{/if}
							</div>
							<p class="text-xs text-muted-foreground flex-1">{reloadMessage}</p>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Actions -->
			<div class="flex gap-2">
				<Button
					onclick={handleGenerateYaml}
					disabled={!isValid || isLoading}
					class="gap-2"
					size="lg"
				>
					{#if isLoading}
						<div class="animate-spin">⚙️</div>
						<span>Generating...</span>
					{:else}
						<Save class="h-4 w-4" />
						<span>Generate & Save team.yaml</span>
					{/if}
				</Button>

				<Button
					onclick={handleForceReload}
					disabled={isReloadingManually || !sidecarReloadStatus?.isWatching}
					variant="outline"
					size="lg"
					class="gap-2"
					title="Manually trigger a sidecar reload"
				>
					{#if isReloadingManually}
						<div class="animate-spin">⚙️</div>
						<span>Reloading...</span>
					{:else}
						<RotateCw class="h-4 w-4" />
						<span>Force Reload Sidecar</span>
					{/if}
				</Button>

				<Button variant="outline" onclick={resetForm} disabled={isLoading} size="lg">
					Reset Form
				</Button>
			</div>

			<!-- Validation Status -->
			{#if !isValid}
				<div class="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
					<div class="flex items-start gap-2 text-sm">
						<AlertCircle class="h-4 w-4 mt-0.5 flex-shrink-0 text-destructive" />
						<div>
							<p class="font-medium text-destructive">Validation Issues</p>
							<ul class="text-xs text-destructive mt-1 space-y-1">
								{#if Object.values(agentConfigs).every((a) => !a.enabled)}
									<li>• At least one agent must be enabled</li>
								{/if}
								{#each Object.entries(agentConfigs) as [agentId, agentConfig]}
									{#if agentConfig.enabled && !agentConfig.model}
										<li>• {agentId}: Model field is required</li>
									{/if}
								{/each}
							</ul>
						</div>
					</div>
				</div>
			{:else}
				<div class="rounded-lg bg-green-50 border border-green-200 p-3 dark:bg-green-950/20 dark:border-green-900/50">
					<div class="flex items-start gap-2 text-sm">
						<CheckCircle2 class="h-4 w-4 mt-0.5 flex-shrink-0 text-green-600" />
						<div>
							<p class="font-medium text-green-900 dark:text-green-200">Configuration Valid</p>
							<p class="text-xs text-green-700 dark:text-green-300 mt-1">
								Ready to generate team.yaml with {Object.values(agentConfigs).filter((a) => a.enabled).length}
								agents, {enabledMcp.size} MCP tools, and {enabledRag.size} RAG sources
							</p>
						</div>
					</div>
				</div>
			{/if}

			<!-- Generation Result -->
			{#if generationResult}
				<div class="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
					<div class="flex items-center gap-2">
						<CheckCircle2 class="h-5 w-5 text-green-600" />
						<p class="font-semibold text-green-900 dark:text-green-200">Generation Complete</p>
					</div>

					<!-- File Path -->
					<div class="space-y-2">
						<Label class="text-xs font-medium">Output File</Label>
						<div class="flex items-center gap-2">
							<code class="text-xs bg-background border border-border rounded px-2 py-1 flex-1 overflow-auto">
								{generationResult.filePath}
							</code>
							<Button
								size="sm"
								variant="ghost"
								onclick={() => copyToClipboard(generationResult!.filePath, 'File path')}
								class="flex-shrink-0"
							>
								<Copy class="h-3 w-3" />
							</Button>
						</div>
					</div>

					<!-- Created Directories -->
					{#if generationResult.dirsCreated && generationResult.dirsCreated.length > 0}
						<div class="space-y-2">
							<Label class="text-xs font-medium">Created Directories</Label>
							<div class="space-y-1 text-xs">
								{#each generationResult.dirsCreated as dir}
									<div class="flex items-center gap-2 text-muted-foreground">
										<span>→</span>
										<code class="bg-background border border-border rounded px-1.5 py-0.5 flex-1">
											{dir}
										</code>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<!-- YAML Preview (if available) -->
					{#if generationResult.yaml}
						<div class="space-y-2">
							<Label class="text-xs font-medium">Generated YAML (Preview)</Label>
							<pre
								class="text-xs bg-background border border-border rounded p-3 overflow-auto max-h-48 text-muted-foreground"
							><code>{generationResult.yaml.substring(0, 300)}...</code></pre>
							<Button
								size="sm"
								variant="outline"
								onclick={() => copyToClipboard(generationResult!.yaml, 'YAML content')}
								class="w-full"
							>
								<Copy class="h-3 w-3 mr-1" />
								Copy Full YAML
							</Button>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Configuration Summary -->
			{#if isDirty}
				<div class="grid grid-cols-3 gap-3 rounded-lg bg-muted p-4">
					<div class="text-center">
						<p class="text-sm font-semibold">
							{Object.values(agentConfigs).filter((a) => a.enabled).length}
						</p>
						<p class="text-xs text-muted-foreground">Agents</p>
					</div>
					<div class="text-center">
						<p class="text-sm font-semibold">{enabledMcp.size}</p>
						<p class="text-xs text-muted-foreground">MCP Tools</p>
					</div>
					<div class="text-center">
						<p class="text-sm font-semibold">{enabledRag.size}</p>
						<p class="text-xs text-muted-foreground">RAG Sources</p>
					</div>
				</div>
			{/if}
		</Tabs.Content>
	</Tabs.Root>
</div>
