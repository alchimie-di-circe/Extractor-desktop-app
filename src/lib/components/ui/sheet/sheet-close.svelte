<script lang="ts">
import { Dialog as SheetPrimitive } from 'bits-ui';

let {
	ref = $bindable(null),
	child,
	children,
	...restProps
}: SheetPrimitive.CloseProps = $props();
</script>

<SheetPrimitive.Close bind:ref data-slot="sheet-close" {...restProps} {child} {children} />
