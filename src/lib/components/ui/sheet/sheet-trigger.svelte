<script lang="ts">
import type { Dialog as SheetPrimitive } from 'bits-ui';

const {
	ref = $bindable(null),
	child,
	children,
	...restProps
}: SheetPrimitive.TriggerProps = $props();
</script>

<SheetPrimitive.Trigger bind:ref data-slot="sheet-trigger" {...restProps} {child} {children} />
