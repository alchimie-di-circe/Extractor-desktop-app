<script lang="ts">
	import * as FormPrimitive from "formsnap";
	import { cn, type WithoutChild } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		errorClasses,
		children: childrenProp,
		...restProps
	}: WithoutChild<FormPrimitive.FieldErrorsProps> & {
		errorClasses?: string | undefined | null;
	} = $props();
</script>

<FormPrimitive.FieldErrors
	bind:ref
	class={cn("text-destructive text-sm font-medium", className)}
	{...restProps}
>
	{#snippet children({ errors, errorProps })}
		{#if childrenProp}
			{@render childrenProp({ errors, errorProps })}
		{:else}
			{#each errors as error, i (i)}
				<div {...errorProps} class={cn(errorProps.class, errorClasses)}>{error}</div>
			{/each}
		{/if}
	{/snippet}
</FormPrimitive.FieldErrors>
