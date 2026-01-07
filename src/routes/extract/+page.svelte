<script lang="ts">
	import { Image, Upload, Wand2 } from '@lucide/svelte';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
</script>

<svelte:head>
	<title>Estrai - Trae Extractor</title>
</svelte:head>

<div class="flex flex-col gap-6 py-4">
	<!-- Header -->
	<div class="flex flex-col gap-2">
		<h1 class="text-3xl font-bold tracking-tight flex items-center gap-2">
			<Image class="size-8" />
			Estrai Contenuti
		</h1>
		<p class="text-muted-foreground">
			Carica uno screenshot per estrarre automaticamente testi e immagini.
		</p>
	</div>

	<!-- Upload Area -->
	<Card.Root class="border-dashed">
		<Card.Content class="flex flex-col items-center justify-center py-12">
			<div class="mx-auto mb-4 rounded-full bg-muted p-4">
				<Upload class="size-8 text-muted-foreground" />
			</div>
			<h3 class="mb-2 text-lg font-semibold">Carica uno screenshot</h3>
			<p class="mb-4 max-w-sm text-center text-sm text-muted-foreground">
				Trascina un'immagine qui oppure clicca per selezionare un file dal tuo computer.
				Formati supportati: PNG, JPG, WEBP
			</p>
			<Button>
				<Upload class="mr-2 size-4" />
				Seleziona immagine
			</Button>
		</Card.Content>
	</Card.Root>

	<!-- Extraction Options -->
	<div class="grid gap-4 md:grid-cols-2">
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<Wand2 class="size-5" />
					Estrazione AI
				</Card.Title>
				<Card.Description>
					Usa l'intelligenza artificiale per estrarre e strutturare i contenuti
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<ul class="list-inside list-disc space-y-2 text-sm text-muted-foreground">
					<li>Riconoscimento automatico del testo (OCR)</li>
					<li>Estrazione di elementi grafici</li>
					<li>Identificazione della struttura del layout</li>
					<li>Suggerimenti per la riscrittura</li>
				</ul>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>Provider LLM</Card.Title>
				<Card.Description>
					Configura il provider AI nelle impostazioni per abilitare l'estrazione
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<p class="text-sm text-muted-foreground">
					Questa funzionalità richiede la configurazione di un provider LLM (OpenAI, Anthropic, o altro)
					nella sezione Impostazioni.
				</p>
			</Card.Content>
			<Card.Footer>
				<Button variant="outline" href="/settings">
					Vai alle Impostazioni
				</Button>
			</Card.Footer>
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
				<li>Batch processing di più screenshot</li>
				<li>Estrazione da URL di pagine web</li>
				<li>Supporto per PDF e documenti</li>
				<li>Cronologia delle estrazioni</li>
				<li>Template di estrazione personalizzati</li>
			</ul>
		</Card.Content>
	</Card.Root>
</div>
