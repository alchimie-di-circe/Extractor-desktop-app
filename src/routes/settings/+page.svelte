<script lang="ts">
	import { Settings, Key, Brain, Palette, Globe, Bell } from '@lucide/svelte';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';

	const llmProviders = [
		{ id: 'openai', name: 'OpenAI', description: 'GPT-4, GPT-4o, GPT-3.5 Turbo', configured: false },
		{ id: 'anthropic', name: 'Anthropic', description: 'Claude 3.5 Sonnet, Claude 3 Opus', configured: false },
		{ id: 'google', name: 'Google AI', description: 'Gemini Pro, Gemini Ultra', configured: false },
		{ id: 'openrouter', name: 'OpenRouter', description: 'Accesso a più modelli', configured: false }
	];
</script>

<svelte:head>
	<title>Impostazioni - Trae Extractor</title>
</svelte:head>

<div class="flex flex-col gap-6 py-4">
	<!-- Header -->
	<div class="flex flex-col gap-2">
		<h1 class="text-3xl font-bold tracking-tight flex items-center gap-2">
			<Settings class="size-8" />
			Impostazioni
		</h1>
		<p class="text-muted-foreground">
			Configura le preferenze dell'applicazione, i provider AI e le integrazioni.
		</p>
	</div>

	<!-- Settings Tabs -->
	<Tabs.Root value="llm" class="w-full">
		<Tabs.List class="grid w-full grid-cols-4">
			<Tabs.Trigger value="llm" class="gap-2">
				<Brain class="size-4" />
				<span class="hidden sm:inline">Provider LLM</span>
			</Tabs.Trigger>
			<Tabs.Trigger value="api" class="gap-2">
				<Key class="size-4" />
				<span class="hidden sm:inline">API Keys</span>
			</Tabs.Trigger>
			<Tabs.Trigger value="appearance" class="gap-2">
				<Palette class="size-4" />
				<span class="hidden sm:inline">Aspetto</span>
			</Tabs.Trigger>
			<Tabs.Trigger value="preferences" class="gap-2">
				<Globe class="size-4" />
				<span class="hidden sm:inline">Preferenze</span>
			</Tabs.Trigger>
		</Tabs.List>

		<!-- LLM Providers Tab -->
		<Tabs.Content value="llm" class="mt-6">
			<Card.Root>
				<Card.Header>
					<Card.Title>Provider LLM</Card.Title>
					<Card.Description>
						Configura i provider di intelligenza artificiale per l'estrazione e la generazione di contenuti.
					</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-4">
					{#each llmProviders as provider}
						<div class="flex items-center justify-between rounded-lg border p-4">
							<div class="space-y-1">
								<p class="font-medium">{provider.name}</p>
								<p class="text-sm text-muted-foreground">{provider.description}</p>
							</div>
							<Button variant="outline" size="sm">
								{provider.configured ? 'Configurato' : 'Configura'}
							</Button>
						</div>
					{/each}
				</Card.Content>
			</Card.Root>
		</Tabs.Content>

		<!-- API Keys Tab -->
		<Tabs.Content value="api" class="mt-6">
			<Card.Root>
				<Card.Header>
					<Card.Title>API Keys</Card.Title>
					<Card.Description>
						Inserisci le tue chiavi API per i vari servizi. Le chiavi sono memorizzate in modo sicuro localmente.
					</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-6">
					<div class="space-y-2">
						<Label for="openai-key">OpenAI API Key</Label>
						<Input id="openai-key" type="password" placeholder="sk-..." />
						<p class="text-xs text-muted-foreground">
							Ottieni la tua API key da <a href="https://platform.openai.com" target="_blank" class="underline">platform.openai.com</a>
						</p>
					</div>

					<Separator />

					<div class="space-y-2">
						<Label for="anthropic-key">Anthropic API Key</Label>
						<Input id="anthropic-key" type="password" placeholder="sk-ant-..." />
						<p class="text-xs text-muted-foreground">
							Ottieni la tua API key da <a href="https://console.anthropic.com" target="_blank" class="underline">console.anthropic.com</a>
						</p>
					</div>

					<Separator />

					<div class="space-y-2">
						<Label for="google-key">Google AI API Key</Label>
						<Input id="google-key" type="password" placeholder="AIza..." />
						<p class="text-xs text-muted-foreground">
							Ottieni la tua API key da <a href="https://aistudio.google.com" target="_blank" class="underline">aistudio.google.com</a>
						</p>
					</div>
				</Card.Content>
				<Card.Footer>
					<Button>Salva API Keys</Button>
				</Card.Footer>
			</Card.Root>
		</Tabs.Content>

		<!-- Appearance Tab -->

		<Tabs.Content value="appearance" class="mt-6">
			<Card.Root>
				<Card.Header>
					<Card.Title>Aspetto</Card.Title>
					<Card.Description>
						Personalizza l'aspetto dell'applicazione.
					</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-4">
					<div class="flex items-center justify-between">
						<div class="space-y-1">
							<p class="font-medium">Tema</p>
							<p class="text-sm text-muted-foreground">
								Scegli tra tema chiaro, scuro o automatico in base al sistema.
							</p>
						</div>
						<p class="text-sm text-muted-foreground">
							Usa il selettore tema nella sidebar
						</p>
					</div>

					<Separator />

					<div class="flex items-center justify-between">
						<div class="space-y-1">
							<p class="font-medium">Lingua interfaccia</p>
							<p class="text-sm text-muted-foreground">
								Seleziona la lingua dell'interfaccia utente.
							</p>
						</div>
						<Button variant="outline" size="sm" disabled>Italiano</Button>
					</div>

					<Separator />

					<div class="flex items-center justify-between">
						<div class="space-y-1">
							<p class="font-medium">Sidebar compatta</p>
							<p class="text-sm text-muted-foreground">
								Mostra solo le icone nella sidebar.
							</p>
						</div>
						<Button variant="outline" size="sm" disabled>Prossimamente</Button>
					</div>
				</Card.Content>
			</Card.Root>
		</Tabs.Content>

		<!-- Preferences Tab -->
		<Tabs.Content value="preferences" class="mt-6">
			<Card.Root>
				<Card.Header>
					<Card.Title>Preferenze Generali</Card.Title>
					<Card.Description>
						Configura le preferenze generali dell'applicazione.
					</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-4">
					<div class="flex items-center justify-between">
						<div class="space-y-1">
							<p class="font-medium">Salvataggio automatico</p>
							<p class="text-sm text-muted-foreground">
								Salva automaticamente le modifiche mentre lavori.
							</p>
						</div>
						<Button variant="outline" size="sm" disabled>Prossimamente</Button>
					</div>

					<Separator />

					<div class="flex items-center justify-between">
						<div class="space-y-1">
							<p class="font-medium">Notifiche</p>
							<p class="text-sm text-muted-foreground">
								Ricevi notifiche per pubblicazioni programmate e aggiornamenti.
							</p>
						</div>
						<Button variant="outline" size="sm" disabled>Prossimamente</Button>
					</div>

					<Separator />

					<div class="flex items-center justify-between">
						<div class="space-y-1">
							<p class="font-medium">Dati e Privacy</p>
							<p class="text-sm text-muted-foreground">
								Gestisci i tuoi dati e le impostazioni di privacy.
							</p>
						</div>
						<Button variant="outline" size="sm" disabled>Prossimamente</Button>
					</div>

					<Separator />

					<div class="flex items-center justify-between">
						<div class="space-y-1">
							<p class="font-medium">Esporta dati</p>
							<p class="text-sm text-muted-foreground">
								Scarica tutti i tuoi dati in formato JSON.
							</p>
						</div>
						<Button variant="outline" size="sm" disabled>Prossimamente</Button>
					</div>
				</Card.Content>
			</Card.Root>

			<!-- About Section -->
			<Card.Root class="mt-4">
				<Card.Header>
					<Card.Title>Informazioni</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-2 text-sm text-muted-foreground">
					<p><strong>Versione:</strong> 0.0.1 (Development)</p>
					<p><strong>Electron:</strong> 36.8.3</p>
					<p><strong>SvelteKit:</strong> 2.x</p>
					<p><strong>Svelte:</strong> 5.x</p>
				</Card.Content>
			</Card.Root>
		</Tabs.Content>
	</Tabs.Root>
</div>
