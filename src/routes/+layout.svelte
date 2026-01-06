<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { AppSidebar } from '$lib/components/custom/index.js';

	let { children } = $props();
</script>

<Sidebar.Provider>
	<AppSidebar />
	<Sidebar.Inset>
		<header
			class="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4 transition-[width,height] ease-linear group-has-[data-collapsible='icon']/sidebar-wrapper:h-12"
		>
			<div class="flex items-center gap-2">
				<Sidebar.Trigger class="-ml-1" />
				<div class="h-4 w-px bg-border" aria-hidden="true"></div>
				<nav class="flex items-center gap-1 text-sm text-muted-foreground">
					<span class="font-medium text-foreground">Trae Extractor</span>
				</nav>
			</div>
		</header>
		<main class="flex flex-1 flex-col gap-4 p-4 pt-0">
			<slot />
		</main>
	</Sidebar.Inset>
</Sidebar.Provider>
