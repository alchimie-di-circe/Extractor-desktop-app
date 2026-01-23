<script lang="ts">
import type { Dialog as SheetPrimitive } from 'bits-ui';

const {
	ref = $bindable(null),
	child,
	children,
	...restProps
}: SheetPrimitive.CloseProps = $props();
</script>

<SheetPrimitive.Close bind:ref data-slot="sheet-close" {...restProps} {child} {children} />
