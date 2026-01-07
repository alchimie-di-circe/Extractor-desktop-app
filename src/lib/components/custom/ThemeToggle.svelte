<script lang="ts">
	import { Sun, Moon, Monitor } from '@lucide/svelte';
	import { theme, type Theme } from '$lib/stores/theme.svelte.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';

	// Get reactive state
	let currentTheme: Theme;
	let resolvedTheme: 'light' | 'dark';
	$: currentTheme = theme.preference;
	$: resolvedTheme = theme.resolved;

	function handleThemeChange(newTheme: Theme) {
		theme.set(newTheme);
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="ghost" size="icon" class="size-9">
				{#if resolvedTheme === 'dark'}
					<Moon class="size-4" />
				{:else}
					<Sun class="size-4" />
				{/if}
				<span class="sr-only">Cambia tema</span>
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end">
		<DropdownMenu.Item
			onclick={() => handleThemeChange('light')}
			class="gap-2"
		>
			<Sun class="size-4" />
			<span>Chiaro</span>
			{#if currentTheme === 'light'}
				<span class="ml-auto text-xs text-muted-foreground">✓</span>
			{/if}
		</DropdownMenu.Item>
		<DropdownMenu.Item
			onclick={() => handleThemeChange('dark')}
			class="gap-2"
		>
			<Moon class="size-4" />
			<span>Scuro</span>
			{#if currentTheme === 'dark'}
				<span class="ml-auto text-xs text-muted-foreground">✓</span>
			{/if}
		</DropdownMenu.Item>
		<DropdownMenu.Item
			onclick={() => handleThemeChange('system')}
			class="gap-2"
		>
			<Monitor class="size-4" />
			<span>Sistema</span>
			{#if currentTheme === 'system'}
				<span class="ml-auto text-xs text-muted-foreground">✓</span>
			{/if}
		</DropdownMenu.Item>
	</DropdownMenu.Content>
</DropdownMenu.Root>
