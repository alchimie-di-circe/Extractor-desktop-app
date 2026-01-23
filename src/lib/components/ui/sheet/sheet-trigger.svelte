<script lang="ts">
import { Dialog as SheetPrimitive } from 'bits-ui';

let {
	ref = $bindable(null),
	child,
	children,
	...restProps
}: SheetPrimitive.TriggerProps = $props();
</script>

<SheetPrimitive.Trigger bind:ref data-slot="sheet-trigger" {...restProps} {child} {children} />
