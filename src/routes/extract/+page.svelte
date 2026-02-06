<script lang="ts">
import {
	Album as AlbumIcon,
	AlertCircle,
	Check,
	Image,
	Library,
	Upload,
	Wand2,
} from '@lucide/svelte';
import * as Accordion from '$lib/components/ui/accordion/index.js';
import { Button } from '$lib/components/ui/button/index.js';
import * as Card from '$lib/components/ui/card/index.js';
import { Progress } from '$lib/components/ui/progress/index.js';
import * as Tabs from '$lib/components/ui/tabs/index.js';

interface AlbumItem {
	id: string;
	name: string;
	count: number;
}

let activeTab = $state('upload');
let albums = $state<AlbumItem[]>([]);
let loadingAlbums = $state(false);
let albumError = $state<string | null>(null);
let exportProgress = $state(0);
let selectedAlbum = $state<string | null>(null);

async function loadAlbums() {
	loadingAlbums = true;
	albumError = null;
	try {
		const result = await window.electronAPI.osxphotos.listAlbums();
		if (result.success && result.data?.albums) {
			albums = result.data.albums;
		} else if (!result.success && 'error' in result) {
			albumError = result.error?.message || 'Failed to load albums';
		} else {
			albumError = 'Failed to load albums';
		}
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		if (errorMsg.includes('permission') || errorMsg.includes('Disk Access')) {
			albumError =
				'Full Disk Access not granted. Please enable in System Preferences > Security & Privacy > Full Disk Access';
		} else {
			albumError = `Failed to load albums: ${errorMsg}`;
		}
	} finally {
		loadingAlbums = false;
	}
}

$effect(() => {
	if (activeTab === 'photos' && albums.length === 0 && !loadingAlbums && !albumError) {
		loadAlbums();
	}
});
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
			Scegli una sorgente: carica un file oppure estrai dalla Libreria Foto
		</p>
	</div>

	<!-- Tabs: Upload vs Photos Library -->
	<Tabs.Root bind:value={activeTab}>
		<Tabs.List class="grid w-full max-w-sm grid-cols-2">
			<Tabs.Trigger value="upload" class="flex items-center gap-2">
				<Upload class="size-4" />
				Carica File
			</Tabs.Trigger>
			<Tabs.Trigger value="photos" class="flex items-center gap-2">
				<Library class="size-4" />
				Libreria Foto
			</Tabs.Trigger>
		</Tabs.List>

		<!-- Tab 1: Upload -->
		<Tabs.Content value="upload">
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
		</Tabs.Content>

		<!-- Tab 2: Photos Library -->
		<Tabs.Content value="photos">
			{#if albumError}
				<Card.Root class="border-red-200 bg-red-50">
					<Card.Content class="flex items-start gap-3 py-4">
						<AlertCircle class="size-5 text-red-600 flex-shrink-0 mt-0.5" />
						<div>
							<p class="font-semibold text-red-900">Accesso alla Libreria Foto negato</p>
							<p class="text-sm text-red-800 mt-1">{albumError}</p>
							<Button variant="outline" size="sm" class="mt-3" onclick={() => loadAlbums()}>
								Riprova
							</Button>
						</div>
					</Card.Content>
				</Card.Root>
			{:else if loadingAlbums}
				<Card.Root>
					<Card.Content class="py-8">
						<p class="text-center text-muted-foreground">Caricamento album...</p>
						<Progress value={50} class="mt-4 w-full" />
					</Card.Content>
				</Card.Root>
			{:else if albums.length === 0}
				<Card.Root>
					<Card.Content class="py-8">
						<p class="text-center text-muted-foreground">Nessun album trovato</p>
					</Card.Content>
				</Card.Root>
			{:else}
				<Card.Root>
					<Card.Header>
						<Card.Title class="flex items-center gap-2">
							<AlbumIcon class="size-5" />
							Album disponibili
						</Card.Title>
						<Card.Description>
							Seleziona un album per visualizzare le foto ({albums.length})
						</Card.Description>
					</Card.Header>
					<Card.Content>
						<Accordion.Root type="single">
							{#each albums as album, idx}
								<Accordion.Item value="album-{album.id}">
									<Accordion.Trigger class="flex items-center justify-between">
										<span>{album.name}</span>
										<span class="text-xs text-muted-foreground">
											{album.count} foto
										</span>
									</Accordion.Trigger>
									<Accordion.Content>
										<div class="flex flex-col gap-3">
											<p class="text-sm text-muted-foreground">
												Questo album contiene {album.count} foto.
											</p>
											<Button size="sm" onclick={() => (selectedAlbum = album.id)}>
												<Check class="mr-2 size-4" />
												Seleziona album
											</Button>
											{#if selectedAlbum === album.id}
												<!-- TODO: Connect export progress from IPC events -->
												<Progress value={exportProgress} class="w-full" />
											{/if}
										</div>
									</Accordion.Content>
								</Accordion.Item>
							{/each}
						</Accordion.Root>
					</Card.Content>
				</Card.Root>
			{/if}
		</Tabs.Content>
	</Tabs.Root>

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
