<script lang="ts">
import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';

let {
	ref = $bindable(null),
	child,
	children,
	...restProps
}: DropdownMenuPrimitive.TriggerProps = $props();
</script>

<DropdownMenuPrimitive.Trigger bind:ref data-slot="dropdown-menu-trigger" {...restProps} {child} {children} />
