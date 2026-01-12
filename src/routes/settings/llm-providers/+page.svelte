<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import {
		Brain,
		ArrowLeft,
		Settings2,
		Bot,
		ImageDown,
		Pencil,
		MessageSquareText,
		CalendarClock,
		Wand2
	} from '@lucide/svelte';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';

	import { LLMProviderCard } from '$lib/components/custom/index.js';
	import {
		llmProviders,
		LLM_PROVIDERS,
		getAllProviderIds,
		getAllAgentRoles,
		DEFAULT_AGENT_MODELS
	} from '$lib/stores/llm-providers.svelte.js';
	import type { LLMProviderId, AgentRole } from '../../../../shared/types';

	// Tab state
	let activeTab = $state<LLMProviderId>('openrouter');

	// Get all provider IDs for tabs
	const providerIds = getAllProviderIds();
	const agentRoles = getAllAgentRoles();

	// Agent role labels and icons
	// Reference: .taskmaster/docs/cagent-team.md
	const agentLabels: Record<
		AgentRole,
		{ label: string; description: string; icon: typeof Bot }
	> = {
		orchestrator: {
			label: 'Orchestrator',
			description: 'Coordina workflow e gestisce handoff tra agent',
			icon: Bot
		},
		extraction: {
			label: 'Extraction',
			description: 'Estrae foto da Apple Photos, analizza metadata',
			icon: ImageDown
		},
		editing: {
			label: 'Editing',
			description: 'Elabora media: background removal, upscale, crop',
			icon: Pencil
		},
		captioning: {
			label: 'Captioning',
			description: 'Genera caption per social con brand voice',
			icon: MessageSquareText
		},
		scheduling: {
			label: 'Scheduling',
			description: 'Programma pubblicazioni su social media',
			icon: CalendarClock
		}
	};

	// Initialize store on mount
	onMount(async () => {
		await llmProviders.initFromStorage();
		if (llmProviders.initError) {
			toast.error('Impossibile caricare le configurazioni LLM', {
				description: 'Riprova o verifica i permessi del keychain.'
			});
			llmProviders.clearInitError();
		}
	});

	// Handle test connection
	async function handleTestConnection(
		providerId: LLMProviderId,
		apiKey: string,
		model: string
	): Promise<void> {
		const providerName = LLM_PROVIDERS[providerId].name;
		try {
			const result = await window.electronAPI.llm.testConnection(
				providerId,
				apiKey,
				model
			);
			if (result.success) {
				llmProviders.setConnectionStatus(providerId, 'success');
				toast.success(`Connessione a ${providerName} riuscita`, {
					description: `Latenza: ${result.latencyMs}ms`
				});
			} else {
				console.error('Test connessione fallito:', result.error);
				llmProviders.setConnectionStatus(
					providerId,
					'error',
					'Test connessione fallito'
				);
				toast.error(`Connessione a ${providerName} fallita`, {
					description: 'Verifica la chiave API e la rete, poi riprova.'
				});
			}
		} catch (error) {
			console.error('Errore connessione:', error);
			llmProviders.setConnectionStatus(
				providerId,
				'error',
				'Errore di connessione'
			);
			toast.error(`Errore connessione ${providerName}`, {
				description: 'Impossibile completare il test, riprova.'
			});
		}
	}

	// Handle save API key
	async function handleSaveApiKey(
		providerId: LLMProviderId,
		apiKey: string
	): Promise<void> {
		const providerName = LLM_PROVIDERS[providerId].name;
		const result = await window.electronAPI.llm.saveApiKey(providerId, apiKey);
		if (!result.success) {
			console.error('Salvataggio API key fallito:', result.error);
			toast.error(`Salvataggio ${providerName} fallito`, {
				description: 'Impossibile salvare la chiave, riprova.'
			});
			throw new Error('Salvataggio API key fallito');
		}
		toast.success(`API key ${providerName} salvata`, {
			description: 'Credenziali memorizzate in modo sicuro nel keychain'
		});
	}

	// Handle delete API key
	async function handleDeleteApiKey(providerId: LLMProviderId): Promise<boolean> {
		const providerName = LLM_PROVIDERS[providerId].name;
		const result = await window.electronAPI.llm.deleteApiKey(providerId);
		if (!result.success) {
			console.error('Eliminazione API key fallita:', result.error);
			toast.error(`Eliminazione ${providerName} fallita`, {
				description: 'Impossibile eliminare la chiave, riprova.'
			});
			return false;
		}
		toast.success(`API key ${providerName} eliminata`, {
			description: 'Credenziali rimosse dal keychain'
		});
		return true;
	}

	// Handle agent role change
	async function handleRoleChange(
		role: AgentRole,
		value: string | undefined
	): Promise<void> {
		const roleLabel = agentLabels[role].label;
		try {
			if (!value) {
				await llmProviders.setModelRole(role, null, null);
				toast.info(`${roleLabel} Agent: modello rimosso`);
				return;
			}

			// Parse value: "providerId:modelId"
			if (!value.includes(':')) {
				toast.error('Formato valore non valido');
				return;
			}
			const [providerId, ...modelParts] = value.split(':') as [LLMProviderId, ...string[]];
			const modelId = modelParts.join(':'); // Handle model IDs with colons (e.g., "google/gemini-3-flash:free")
			if (!modelId) {
				toast.error('Modello non specificato');
				return;
			}
			const saved = await llmProviders.setModelRole(role, providerId, modelId);
			if (!saved) {
				toast.error(`Errore configurazione ${roleLabel} Agent`, {
					description: 'Impossibile salvare la configurazione.'
				});
				return;
			}

			const providerName = LLM_PROVIDERS[providerId].name;
			const modelName =
				LLM_PROVIDERS[providerId].models.find((m) => m.id === modelId)?.name ??
				modelId;
			toast.success(`${roleLabel} Agent configurato`, {
				description: `${providerName} - ${modelName}`
			});
		} catch (error) {
			console.error(`Failed to configure ${roleLabel} Agent:`, error);
			toast.error(`Errore configurazione ${roleLabel} Agent`, {
				description: 'Impossibile salvare la configurazione.'
			});
		}
	}

	// Auto-configure all agents with recommended models
	async function handleAutoConfig(providerId: LLMProviderId): Promise<void> {
		const providerName = LLM_PROVIDERS[providerId].name;
		try {
			const saved = await llmProviders.autoConfigureAgentRoles(providerId);
			if (!saved) {
				toast.error('Errore configurazione automatica', {
					description: 'Impossibile salvare la configurazione.'
				});
				return;
			}
			toast.success(`Tutti gli agent configurati con ${providerName}`, {
				description: 'Modelli consigliati assegnati automaticamente'
			});
		} catch (error) {
			console.error('Failed to auto-configure agents:', error);
			toast.error('Errore configurazione automatica', {
				description: 'Impossibile salvare la configurazione.'
			});
		}
	}

	// Get current role value
	function getRoleValue(role: AgentRole): string | undefined {
		const config = llmProviders.modelRoles[role];
		if (!config.providerId || !config.model) return undefined;
		return `${config.providerId}:${config.model}`;
	}

	// Get configured providers with their models for role selection
	function getConfiguredModelsForSelect() {
		const options: Array<{
			value: string;
			label: string;
			provider: string;
		}> = [];

		for (const providerId of providerIds) {
			const state = llmProviders.providers[providerId];
			if (state?.hasApiKey) {
				const provider = LLM_PROVIDERS[providerId];
				for (const model of provider.models) {
					options.push({
						value: `${providerId}:${model.id}`,
						label: model.name,
						provider: provider.name
					});
				}
			}
		}

		return options;
	}

	// Get first configured provider for auto-config button
	function getFirstConfiguredProvider(): LLMProviderId | null {
		for (const providerId of providerIds) {
			const state = llmProviders.providers[providerId];
			if (state?.hasApiKey && state?.connectionStatus === 'success') {
				return providerId;
			}
		}
		return null;
	}

	// Reactive: configured models
	let configuredModels = $derived(getConfiguredModelsForSelect());
	let firstConfiguredProvider = $derived(getFirstConfiguredProvider());
</script>

<svelte:head>
	<title>Provider LLM - Impostazioni - Trae Extractor</title>
</svelte:head>

<div class="flex flex-col gap-6 py-4">
	<!-- Header with back button -->
	<div class="flex items-center gap-4">
		<a href="/settings" class="text-muted-foreground hover:text-foreground">
			<ArrowLeft class="size-5" />
		</a>
		<div class="flex flex-col gap-1">
			<h1 class="text-2xl font-bold tracking-tight flex items-center gap-2">
				<Brain class="size-6" />
				Configurazione Provider LLM
			</h1>
			<p class="text-sm text-muted-foreground">
				Configura le API keys e assegna i modelli ai Cagent.
			</p>
		</div>
	</div>

	<!-- Provider Tabs -->
	{#if llmProviders.isLoading}
		<div class="space-y-4">
			<Skeleton class="h-10 w-full" />
			<Skeleton class="h-64 w-full" />
		</div>
	{:else}
		<Tabs.Root bind:value={activeTab} class="w-full">
			<Tabs.List class="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
				{#each providerIds as providerId (providerId)}
					{@const provider = LLM_PROVIDERS[providerId]}
					{@const state = llmProviders.providers[providerId]}
					<Tabs.Trigger value={providerId} class="gap-2">
						<span class="hidden sm:inline">{provider.name}</span>
						<span class="sm:hidden">{provider.name.slice(0, 3)}</span>
						{#if state?.connectionStatus === 'success'}
							<Badge variant="default" class="ml-1 size-2 rounded-full p-0" />
						{:else if state?.hasApiKey}
							<Badge variant="secondary" class="ml-1 size-2 rounded-full p-0" />
						{/if}
					</Tabs.Trigger>
				{/each}
			</Tabs.List>

			{#each providerIds as providerId (providerId)}
				<Tabs.Content value={providerId} class="mt-6">
					<LLMProviderCard
						provider={LLM_PROVIDERS[providerId]}
						onTestConnection={handleTestConnection}
						onSaveApiKey={handleSaveApiKey}
						onDeleteApiKey={handleDeleteApiKey}
					/>
				</Tabs.Content>
			{/each}
		</Tabs.Root>

		<Separator class="my-2" />

		<!-- Cagent Model Configuration -->
		<Card.Root>
			<Card.Header>
				<div class="flex items-center justify-between">
					<div>
						<Card.Title class="flex items-center gap-2">
							<Settings2 class="size-5" />
							Configurazione Cagent
						</Card.Title>
						<Card.Description>
							Assegna un modello LLM a ogni agent del team.
							{#if !llmProviders.hasValidOrchestratorProvider}
								<span class="text-destructive block mt-1">
									Configura almeno l'Orchestrator per iniziare.
								</span>
							{/if}
						</Card.Description>
					</div>
					{#if firstConfiguredProvider}
						<Button
							variant="outline"
							size="sm"
							onclick={() => handleAutoConfig(firstConfiguredProvider!)}
							class="gap-2"
						>
							<Wand2 class="size-4" />
							<span class="hidden sm:inline">Auto-configura</span>
						</Button>
					{/if}
				</div>
			</Card.Header>
			<Card.Content class="space-y-4">
				{#if configuredModels.length === 0}
					<p class="text-sm text-muted-foreground">
						Nessun provider configurato. Aggiungi almeno una API key sopra per
						assegnare i modelli agli agent.
					</p>
				{:else}
					<div class="grid gap-4">
						{#each agentRoles as role (role)}
							{@const info = agentLabels[role]}
							{@const AgentIcon = info.icon}
							<div
								class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg border bg-card"
							>
								<div class="flex items-center gap-3">
									<div
										class="flex size-10 items-center justify-center rounded-lg bg-primary/10"
									>
										<AgentIcon class="size-5 text-primary" />
									</div>
									<div>
										<p class="font-medium">{info.label} Agent</p>
										<p class="text-xs text-muted-foreground">
											{info.description}
										</p>
									</div>
								</div>
								<Select.Root
									type="single"
									value={getRoleValue(role)}
									onValueChange={(v) => handleRoleChange(role, v)}
								>
									<Select.Trigger class="w-full sm:w-72">
										{@const currentValue = getRoleValue(role)}
										{#if currentValue}
											{@const option = configuredModels.find(
												(o) => o.value === currentValue
											)}
											{#if option}
												<span class="truncate">
													<span class="text-muted-foreground">{option.provider}:</span>
													{option.label}
												</span>
											{:else}
												<span class="truncate text-muted-foreground">
													{currentValue.split(':').slice(1).join(':')}
												</span>
											{/if}
										{:else}
											<span class="text-muted-foreground">Seleziona modello</span>
										{/if}
									</Select.Trigger>
									<Select.Content>
										<Select.Item value="">Nessuno</Select.Item>
										{#each configuredModels as option (option.value)}
											<Select.Item value={option.value}>
												<span class="text-muted-foreground">{option.provider}:</span>
												{option.label}
											</Select.Item>
										{/each}
									</Select.Content>
								</Select.Root>
							</div>
						{/each}
					</div>
				{/if}
			</Card.Content>
			<Card.Footer class="flex justify-between">
				<p class="text-xs text-muted-foreground">
					{llmProviders.configuredAgentCount}/5 agent configurati
				</p>
				<p class="text-xs text-muted-foreground">
					Le preferenze vengono salvate automaticamente.
				</p>
			</Card.Footer>
		</Card.Root>
	{/if}
</div>
