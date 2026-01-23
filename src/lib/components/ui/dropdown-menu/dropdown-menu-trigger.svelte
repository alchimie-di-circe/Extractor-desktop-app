<script lang="ts">
import type { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';

const {
	ref = $bindable(null),
	child,
	children,
	...restProps
}: DropdownMenuPrimitive.TriggerProps = $props();
</script>

<DropdownMenuPrimitive.Trigger bind:ref data-slot="dropdown-menu-trigger" {...restProps} {child} {children} />
