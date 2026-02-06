<script lang="ts">
import { Accordion as AccordionPrimitive } from 'bits-ui';

let {
	ref = $bindable(null),
	value = $bindable(),
	...restProps
} = $props() as AccordionPrimitive.RootProps;
</script>

<AccordionPrimitive.Root
	bind:ref
	bind:value={value as never}
	data-slot="accordion"
	{...restProps}
/>
