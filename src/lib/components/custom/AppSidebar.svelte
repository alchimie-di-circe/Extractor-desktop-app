<script lang="ts">
	import { page } from '$app/stores';
	import { House, Image, Pencil, Send, Settings, Folder } from '@lucide/svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { ThemeToggle } from '$lib/components/custom/index.js';

	// Navigation routes
	const routes = [
		{ path: '/', label: 'Dashboard', icon: House },
		{ path: '/brands', label: 'Brand', icon: Folder },
		{ path: '/extract', label: 'Estrai', icon: Image },
		{ path: '/edit', label: 'Modifica', icon: Pencil },
		{ path: '/publish', label: 'Pubblica', icon: Send },
		{ path: '/settings', label: 'Impostazioni', icon: Settings }
	];

	// Check if route is active (works with hash routing)
	function isActive(path: string): boolean {
		const currentPath = $page.url.pathname;
		if (path === '/') {
			return currentPath === '/' || currentPath === '';
		}
		return currentPath.startsWith(path);
	}
</script>

<Sidebar.Root collapsible="icon">
	<Sidebar.Header>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton size="lg" class="data-[state=open]:bg-sidebar-accent">
					<div
						class="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"
					>
						<Image class="size-4" />
					</div>
					<div class="grid flex-1 text-left text-sm leading-tight">
						<span class="truncate font-semibold">Trae Extractor</span>
						<span class="truncate text-xs text-muted-foreground">Content Extraction Tool</span>
					</div>
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Header>

	<Sidebar.Content>
		<Sidebar.Group>
			<Sidebar.GroupLabel>Navigazione</Sidebar.GroupLabel>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					{#each routes as route (route.path)}
						<Sidebar.MenuItem>
							<Sidebar.MenuButton isActive={isActive(route.path)} tooltipContent={route.label}>
								{#snippet child({ props })}
									<a href={route.path} {...props}>
										<route.icon class="size-4" />
										<span>{route.label}</span>
									</a>
								{/snippet}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					{/each}
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>
	</Sidebar.Content>

	<Sidebar.Footer>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<div class="flex items-center justify-between px-2 py-1.5">
					<span class="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden"
						>Tema</span
					>
					<ThemeToggle />
				</div>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Footer>

	<Sidebar.Rail />
</Sidebar.Root>
