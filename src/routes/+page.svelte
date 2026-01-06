<script lang="ts">
	import { House, Image, Pencil, Send, Folder, ArrowRight } from '@lucide/svelte';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';

	const quickActions = [
		{
			title: 'Gestisci Brand',
			description: 'Configura i brand e le loro identità visive',
			icon: Folder,
			href: '/brands',
			color: 'text-blue-500'
		},
		{
			title: 'Estrai Contenuti',
			description: 'Estrai testi e immagini da screenshot',
			icon: Image,
			href: '/extract',
			color: 'text-green-500'
		},
		{
			title: 'Modifica',
			description: 'Modifica e personalizza i contenuti estratti',
			icon: Pencil,
			href: '/edit',
			color: 'text-orange-500'
		},
		{
			title: 'Pubblica',
			description: 'Pubblica sui social media',
			icon: Send,
			href: '/publish',
			color: 'text-purple-500'
		}
	];

	const stats = [
		{ label: 'Estrazioni oggi', value: '0' },
		{ label: 'Brand configurati', value: '0' },
		{ label: 'Post pubblicati', value: '0' }
	];
</script>

<svelte:head>
	<title>Dashboard - Trae Extractor</title>
</svelte:head>

<div class="flex flex-col gap-6 py-4">
	<!-- Header -->
	<div class="flex flex-col gap-2">
		<h1 class="text-3xl font-bold tracking-tight flex items-center gap-2">
			<House class="size-8" />
			Dashboard
		</h1>
		<p class="text-muted-foreground">
			Benvenuto in Trae Extractor. Estrai contenuti dagli screenshot e pubblicali sui social.
		</p>
	</div>

	<!-- Stats -->
	<div class="grid gap-4 md:grid-cols-3">
		{#each stats as stat}
			<Card.Root>
				<Card.Header class="pb-2">
					<Card.Description>{stat.label}</Card.Description>
				</Card.Header>
				<Card.Content>
					<div class="text-2xl font-bold">{stat.value}</div>
				</Card.Content>
			</Card.Root>
		{/each}
	</div>

	<!-- Quick Actions -->
	<div class="flex flex-col gap-4">
		<h2 class="text-xl font-semibold">Azioni rapide</h2>
		<div class="grid gap-4 md:grid-cols-2">
			{#each quickActions as action}
				<Card.Root class="transition-colors hover:bg-muted/50">
					<a href={action.href} class="block">
						<Card.Header>
							<div class="flex items-center gap-3">
								<div class="rounded-lg bg-muted p-2">
									<action.icon class="size-5 {action.color}" />
								</div>
								<div class="flex-1">
									<Card.Title class="text-base">{action.title}</Card.Title>
									<Card.Description>{action.description}</Card.Description>
								</div>
								<ArrowRight class="size-4 text-muted-foreground" />
							</div>
						</Card.Header>
					</a>
				</Card.Root>
			{/each}
		</div>
	</div>

	<!-- Getting Started -->
	<Card.Root>
		<Card.Header>
			<Card.Title>Come iniziare</Card.Title>
			<Card.Description>Segui questi passaggi per iniziare ad usare Trae Extractor</Card.Description>
		</Card.Header>
		<Card.Content>
			<ol class="list-inside list-decimal space-y-2 text-sm text-muted-foreground">
				<li>Configura almeno un brand nella sezione <strong>Brand</strong></li>
				<li>Vai in <strong>Estrai</strong> e carica uno screenshot</li>
				<li>Modifica il contenuto estratto nella sezione <strong>Modifica</strong></li>
				<li>Pubblica sui tuoi social dalla sezione <strong>Pubblica</strong></li>
			</ol>
		</Card.Content>
		<Card.Footer>
			<Button href="/brands">
				Inizia configurando un brand
				<ArrowRight class="ml-2 size-4" />
			</Button>
		</Card.Footer>
	</Card.Root>
</div>
