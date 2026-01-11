<script lang="ts">
	import {
		Check,
		X,
		Loader2,
		Eye,
		EyeOff,
		ExternalLink,
		RefreshCw
	} from '@lucide/svelte';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';

	import type {
		LLMProviderId,
		LLMProviderInfo,
		LLMConnectionStatus
	} from '../../../../shared/types';
	import { validateApiKeyFormat } from '../../../../shared/llm-providers';
	import { llmProviders } from '$lib/stores/llm-providers.svelte.js';

	// Props
	interface Props {
		provider: LLMProviderInfo;
		onTestConnection?: (
			providerId: LLMProviderId,
			apiKey: string,
			model: string
		) => Promise<void>;
		onSaveApiKey?: (providerId: LLMProviderId, apiKey: string) => Promise<void>;
		onDeleteApiKey?: (providerId: LLMProviderId) => Promise<boolean>;
	}

	let { provider, onTestConnection, onSaveApiKey, onDeleteApiKey }: Props = $props();

	// Local state using Svelte 5 runes
	let apiKeyInput = $state('');
	let showApiKey = $state(false);
	let selectedModelId = $state(
		llmProviders.providers[provider.id]?.selectedModel ??
			provider.models.find((m) => m.recommended)?.id ??
			provider.models[0]?.id ??
			''
	);
	let isSaving = $state(false);
	let isDeleting = $state(false);

	// Get reactive state from store
	let providerState = $derived(llmProviders.providers[provider.id]);
	let connectionStatus = $derived(providerState?.connectionStatus ?? 'idle');
	let hasApiKey = $derived(providerState?.hasApiKey ?? false);
	let errorMessage = $derived(providerState?.errorMessage);

	// Derived: validation
	let isApiKeyValid = $derived(
		apiKeyInput.length > 0 && validateApiKeyFormat(provider.id, apiKeyInput)
	);
	let canTest = $derived(
		(hasApiKey || isApiKeyValid) &&
			selectedModelId &&
			connectionStatus !== 'testing'
	);
	let canSave = $derived(isApiKeyValid && !isSaving);

	// Get selected model info
	let selectedModel = $derived(
		provider.models.find((m) => m.id === selectedModelId)
	);

	// Handle model selection change
	function handleModelChange(value: string | undefined) {
		if (value) {
			selectedModelId = value;
			llmProviders.setSelectedModel(provider.id, value);
		}
	}

	// Test connection
	async function handleTestConnection() {
		const keyToTest = apiKeyInput || undefined;
		if (onTestConnection && selectedModelId) {
			llmProviders.setConnectionStatus(provider.id, 'testing');
			try {
				await onTestConnection(provider.id, keyToTest ?? '', selectedModelId);
			} catch (error) {
				const message =
					error instanceof Error ? error.message : 'Connection test failed';
				llmProviders.setConnectionStatus(provider.id, 'error', message);
			}
		}
	}

	// Save API key
	async function handleSaveApiKey() {
		if (!isApiKeyValid || !onSaveApiKey) return;

		isSaving = true;
		try {
			await onSaveApiKey(provider.id, apiKeyInput);
			llmProviders.setHasApiKey(provider.id, true);
			apiKeyInput = ''; // Clear input after successful save
		} catch (error) {
			console.error('Failed to save API key:', error);
			llmProviders.setConnectionStatus(
				provider.id,
				'error',
				'Errore salvataggio API key'
			);
		} finally {
			isSaving = false;
		}
	}

	// Delete API key
	async function handleDeleteApiKey() {
		if (!onDeleteApiKey) return;

		isDeleting = true;
		try {
			const success = await onDeleteApiKey(provider.id);
			if (success) {
				llmProviders.setHasApiKey(provider.id, false);
				llmProviders.setConnectionStatus(provider.id, 'idle');
			}
		} catch (error) {
			console.error('Failed to delete API key:', error);
			llmProviders.setConnectionStatus(
				provider.id,
				'error',
				'Errore eliminazione API key'
			);
		} finally {
			isDeleting = false;
		}
	}

	// Status badge color
	function getStatusBadgeVariant(
		status: LLMConnectionStatus
	): 'default' | 'secondary' | 'destructive' | 'outline' {
		switch (status) {
			case 'success':
				return 'default';
			case 'error':
				return 'destructive';
			case 'testing':
				return 'secondary';
			default:
				return 'outline';
		}
	}
</script>

<Card.Root class="w-full">
	<Card.Header class="pb-4">
		<div class="flex items-start justify-between">
			<div class="space-y-1">
				<Card.Title class="flex items-center gap-2">
					{provider.name}
					{#if connectionStatus === 'success'}
						<Check class="size-4 text-green-500" />
					{:else if connectionStatus === 'error'}
						<X class="size-4 text-destructive" />
					{/if}
				</Card.Title>
				<Card.Description>
					{provider.description}
				</Card.Description>
			</div>
			<div class="flex items-center gap-2">
				<Badge variant={getStatusBadgeVariant(connectionStatus)}>
					{#if connectionStatus === 'testing'}
						<Loader2 class="mr-1 size-3 animate-spin" />
					{/if}
					{connectionStatus === 'idle'
						? 'Non configurato'
						: connectionStatus === 'testing'
							? 'Test in corso...'
							: connectionStatus === 'success'
								? 'Connesso'
								: 'Errore'}
				</Badge>
				<a
					href={provider.website}
					target="_blank"
					rel="noopener noreferrer"
					class="text-muted-foreground hover:text-foreground"
				>
					<ExternalLink class="size-4" />
				</a>
			</div>
		</div>
	</Card.Header>

	<Card.Content class="space-y-4">
		<!-- API Key Section -->
		<div class="space-y-2">
			<Label for={'api-key-' + provider.id}>API Key</Label>
			<div class="flex gap-2">
				<div class="relative flex-1">
					<Input
						id={'api-key-' + provider.id}
						type={showApiKey ? 'text' : 'password'}
						placeholder={hasApiKey
							? '••••••••••••••••'
							: provider.apiKeyPlaceholder}
						bind:value={apiKeyInput}
						disabled={connectionStatus === 'testing'}
						class="pr-10"
					/>
					<button
						type="button"
						onclick={() => (showApiKey = !showApiKey)}
						class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
					>
						{#if showApiKey}
							<EyeOff class="size-4" />
						{:else}
							<Eye class="size-4" />
						{/if}
					</button>
				</div>
				{#if hasApiKey && !apiKeyInput}
					<Button
						variant="destructive"
						size="sm"
						onclick={handleDeleteApiKey}
						disabled={isDeleting}
					>
						{#if isDeleting}
							<Loader2 class="size-4 animate-spin" />
						{:else}
							Rimuovi
						{/if}
					</Button>
				{:else if apiKeyInput}
					<Button
						variant="default"
						size="sm"
						onclick={handleSaveApiKey}
						disabled={!canSave}
					>
						{#if isSaving}
							<Loader2 class="size-4 animate-spin" />
						{:else}
							Salva
						{/if}
					</Button>
				{/if}
			</div>
			{#if apiKeyInput && !isApiKeyValid}
				<p class="text-xs text-destructive">
					Formato API key non valido. Deve iniziare con "{provider.apiKeyPrefix}"
				</p>
			{/if}
			<p class="text-xs text-muted-foreground">
				Ottieni la tua API key da
				<a
					href={provider.website}
					target="_blank"
					rel="noopener noreferrer"
					class="underline"
				>
					{provider.website.replace('https://', '')}
				</a>
			</p>
		</div>

		<!-- Model Selection -->
		<div class="space-y-2">
			<Label for="model-{provider.id}">Modello</Label>
			<Select.Root
				type="single"
				value={selectedModelId}
				onValueChange={handleModelChange}
			>
				<Select.Trigger id="model-{provider.id}" class="w-full">
					{selectedModel?.name ?? 'Seleziona un modello'}
				</Select.Trigger>
				<Select.Content>
					{#each provider.models as model (model.id)}
						<Select.Item value={model.id}>
							<div class="flex items-center gap-2">
								{model.name}
								{#if model.recommended}
									<Badge variant="secondary" class="text-xs">Consigliato</Badge>
								{/if}
							</div>
							{#if model.description}
								<p class="text-xs text-muted-foreground">{model.description}</p>
							{/if}
						</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
			{#if selectedModel?.contextWindow}
				<p class="text-xs text-muted-foreground">
					Context window: {selectedModel.contextWindow.toLocaleString()} tokens
				</p>
			{/if}
		</div>

		<!-- Error Message -->
		{#if errorMessage}
			<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
				{errorMessage}
			</div>
		{/if}
	</Card.Content>

	<Card.Footer class="flex justify-between">
		<p class="text-xs text-muted-foreground">
			{#if providerState?.lastTestedAt}
				Ultimo test:
				{new Date(providerState.lastTestedAt).toLocaleString('it-IT')}
			{:else}
				Mai testato
			{/if}
		</p>
		<Button
			variant="outline"
			size="sm"
			onclick={handleTestConnection}
			disabled={!canTest}
		>
			{#if connectionStatus === 'testing'}
				<Loader2 class="mr-2 size-4 animate-spin" />
				Test in corso...
			{:else}
				<RefreshCw class="mr-2 size-4" />
				Test connessione
			{/if}
		</Button>
	</Card.Footer>
</Card.Root>
