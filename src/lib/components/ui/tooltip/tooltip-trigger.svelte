<script lang="ts">
import type { Tooltip as TooltipPrimitive } from 'bits-ui';

const {
	ref = $bindable(null),
	child,
	children,
	...restProps
}: TooltipPrimitive.TriggerProps = $props();
</script>

<TooltipPrimitive.Trigger bind:ref data-slot="tooltip-trigger" {...restProps} {child} {children} />
