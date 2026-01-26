<script lang="ts">
import { Dialog as DialogPrimitive } from 'bits-ui';

let {
	ref = $bindable(null),
	child,
	children,
	...restProps
}: DialogPrimitive.CloseProps = $props();
</script>

<DialogPrimitive.Close bind:ref data-slot="dialog-close" {...restProps} {child} {children} />
