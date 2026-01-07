<script lang="ts">
	import { Pencil, Type, ImageIcon, Palette } from '@lucide/svelte';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
</script>

<svelte:head>
	<title>Modifica - Trae Extractor</title>
</svelte:head>

<div class="flex flex-col gap-6 py-4">
	<!-- Header -->
	<div class="flex flex-col gap-2">
		<h1 class="text-3xl font-bold tracking-tight flex items-center gap-2">
			<Pencil class="size-8" />
			Modifica Contenuti
		</h1>
		<p class="text-muted-foreground">
			Modifica e personalizza i contenuti estratti prima della pubblicazione.
		</p>
	</div>

	<!-- Empty State -->
	<Card.Root class="flex flex-col items-center justify-center py-12">
		<Card.Header class="text-center">
			<div class="mx-auto mb-4 rounded-full bg-muted p-4">
				<Pencil class="size-8 text-muted-foreground" />
			</div>
			<Card.Title>Nessun contenuto da modificare</Card.Title>
			<Card.Description class="max-w-sm">
				Prima di poter modificare i contenuti, devi estrarre del testo o delle immagini
				da uno screenshot nella sezione Estrai.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<Button href="/extract">
				Vai all'estrazione
			</Button>
		</Card.Content>
	</Card.Root>

	<!-- Editing Features -->
	<div class="grid gap-4 md:grid-cols-3">
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<Type class="size-5" />
					Editor di Testo
				</Card.Title>
			</Card.Header>
			<Card.Content>
				<p class="text-sm text-muted-foreground">
					Modifica il testo estratto, correggi errori e adatta il contenuto al tuo brand.
				</p>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<ImageIcon class="size-5" />
					Gestione Immagini
				</Card.Title>
			</Card.Header>
			<Card.Content>
				<p class="text-sm text-muted-foreground">
					Ritaglia, ridimensiona e ottimizza le immagini estratte per ogni piattaforma social.
				</p>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<Palette class="size-5" />
					Stile del Brand
				</Card.Title>
			</Card.Header>
			<Card.Content>
				<p class="text-sm text-muted-foreground">
					Applica automaticamente i colori e lo stile del tuo brand ai contenuti.
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
				<li>Editor WYSIWYG avanzato</li>
				<li>Riscrittura AI con diversi toni</li>
				<li>Preview in tempo reale per ogni piattaforma</li>
				<li>Template predefiniti per diversi tipi di post</li>
				<li>Suggerimenti hashtag e emoji</li>
				<li>Controllo grammaticale e ortografico</li>
			</ul>
		</Card.Content>
	</Card.Root>
</div>
