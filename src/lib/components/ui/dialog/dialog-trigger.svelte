<script lang="ts">
import { Dialog as DialogPrimitive } from 'bits-ui';

let {
	ref = $bindable(null),
	child,
	children,
	...restProps
}: DialogPrimitive.TriggerProps = $props();
</script>

<DialogPrimitive.Trigger bind:ref data-slot="dialog-trigger" {...restProps} {child} {children} />
