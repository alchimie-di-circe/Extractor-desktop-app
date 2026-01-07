<script lang="ts">
	import { Send, Share2, Calendar, Clock } from '@lucide/svelte';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';

	const platforms = [
		{ name: 'Instagram', status: 'coming-soon', color: 'bg-gradient-to-r from-purple-500 to-pink-500' },
		{ name: 'Facebook', status: 'coming-soon', color: 'bg-blue-600' },
		{ name: 'Twitter/X', status: 'coming-soon', color: 'bg-black dark:bg-white dark:text-black' },
		{ name: 'LinkedIn', status: 'coming-soon', color: 'bg-blue-700' },
		{ name: 'TikTok', status: 'coming-soon', color: 'bg-black dark:bg-white dark:text-black' },
		{ name: 'Threads', status: 'coming-soon', color: 'bg-black dark:bg-white dark:text-black' }
	];
</script>

<svelte:head>
	<title>Pubblica - Trae Extractor</title>
</svelte:head>

<div class="flex flex-col gap-6 py-4">
	<!-- Header -->
	<div class="flex flex-col gap-2">
		<h1 class="text-3xl font-bold tracking-tight flex items-center gap-2">
			<Send class="size-8" />
			Pubblica Contenuti
		</h1>
		<p class="text-muted-foreground">
			Pubblica i tuoi contenuti su diverse piattaforme social media.
		</p>
	</div>

	<!-- Empty State -->
	<Card.Root class="flex flex-col items-center justify-center py-12">
		<Card.Header class="text-center">
			<div class="mx-auto mb-4 rounded-full bg-muted p-4">
				<Share2 class="size-8 text-muted-foreground" />
			</div>
			<Card.Title>Nessun contenuto pronto per la pubblicazione</Card.Title>
			<Card.Description class="max-w-sm">
				Prima di pubblicare, devi estrarre e modificare i contenuti da uno screenshot.
				Segui il flusso completo per preparare i tuoi post.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<Button href="/extract">
				Inizia l'estrazione
			</Button>
		</Card.Content>
	</Card.Root>

	<!-- Platforms Grid -->
	<div class="flex flex-col gap-4">
		<h2 class="text-xl font-semibold">Piattaforme supportate</h2>
		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{#each platforms as platform}
				<Card.Root class="relative overflow-hidden">
					<Card.Header>
						<div class="flex items-center justify-between">
							<Card.Title class="text-base">{platform.name}</Card.Title>
							<Badge variant="secondary">Prossimamente</Badge>
						</div>
					</Card.Header>
					<Card.Content>
						<div class="h-2 w-full rounded-full bg-muted">
							<div class="{platform.color} h-2 w-1/4 rounded-full opacity-50"></div>
						</div>
					</Card.Content>
				</Card.Root>
			{/each}
		</div>
	</div>

	<!-- Scheduling Features -->
	<div class="grid gap-4 md:grid-cols-2">
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<Calendar class="size-5" />
					Pianificazione Post
				</Card.Title>
				<Card.Description>
					Programma la pubblicazione dei tuoi contenuti
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<p class="text-sm text-muted-foreground">
					Pianifica in anticipo quando vuoi che i tuoi post vengano pubblicati.
					Imposta data e ora per ogni piattaforma.
				</p>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<Clock class="size-5" />
					Orari Migliori
				</Card.Title>
				<Card.Description>
					Suggerimenti basati sull'engagement
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<p class="text-sm text-muted-foreground">
					Ricevi suggerimenti sugli orari migliori per pubblicare in base
					al tuo pubblico e alla piattaforma scelta.
				</p>
			</Card.Content>
		</Card.Root>
	</div>

	<!-- Future Features -->
	<Card.Root>
		<Card.Header>
			<Card.Title>Funzionalità in arrivo</Card.Title>
			<Card.Description>Queste funzionalità saranno disponibili nelle prossime versioni</Card.Description>
		</Card.Header>
		<Card.Content>
			<ul class="list-inside list-disc space-y-2 text-sm text-muted-foreground">
				<li>Connessione OAuth con le piattaforme social</li>
				<li>Pubblicazione diretta su più piattaforme</li>
				<li>Calendario editoriale visuale</li>
				<li>Analisi delle performance dei post</li>
				<li>A/B testing dei contenuti</li>
				<li>Coda di pubblicazione automatica</li>
			</ul>
		</Card.Content>
	</Card.Root>
</div>
