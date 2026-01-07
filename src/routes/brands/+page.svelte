<script lang="ts">
	import { Folder, Plus } from '@lucide/svelte';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
</script>

<svelte:head>
	<title>Brand - Trae Extractor</title>
</svelte:head>

<div class="flex flex-col gap-6 py-4">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div class="flex flex-col gap-2">
			<h1 class="text-3xl font-bold tracking-tight flex items-center gap-2">
				<Folder class="size-8" />
				Gestione Brand
			</h1>
			<p class="text-muted-foreground">
				Configura i brand e le loro identità visive per la generazione di contenuti.
			</p>
		</div>
		<Button>
			<Plus class="mr-2 size-4" />
			Nuovo Brand
		</Button>
	</div>

	<!-- Empty State -->
	<Card.Root class="flex flex-col items-center justify-center py-12">
		<Card.Header class="text-center">
			<div class="mx-auto mb-4 rounded-full bg-muted p-4">
				<Folder class="size-8 text-muted-foreground" />
			</div>
			<Card.Title>Nessun brand configurato</Card.Title>
			<Card.Description class="max-w-sm">
				Inizia creando il tuo primo brand. Potrai configurare colori, font, tono di voce e altre
				preferenze per la generazione di contenuti.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<Button>
				<Plus class="mr-2 size-4" />
				Crea il primo brand
			</Button>
		</Card.Content>
	</Card.Root>

	<!-- Future Features -->
	<Card.Root>
		<Card.Header>
			<Card.Title>Funzionalità in arrivo</Card.Title>
			<Card.Description>Queste funzionalità saranno disponibili nelle prossime versioni</Card.Description>
		</Card.Header>
		<Card.Content>
			<ul class="list-inside list-disc space-y-2 text-sm text-muted-foreground">
				<li>Configurazione colori e palette del brand</li>
				<li>Upload del logo e assets grafici</li>
				<li>Definizione del tono di voce</li>
				<li>Template personalizzati per ogni piattaforma social</li>
				<li>Gestione multi-brand</li>
			</ul>
		</Card.Content>
	</Card.Root>
</div>
