<script lang="ts">
	import type { ContextMenuProps } from '$lib/components/Grid/Grid.svelte';

	const { row, col, selectedCells, close, onCut, onCopy, onPaste, onRotate, onRemove }: ContextMenuProps = $props();

	function cut() {
		onCut?.(row, col, selectedCells);
	}

	function copy() {
		onCopy?.(row, col, selectedCells);
	}

	function paste() {
		onPaste?.(row, col, selectedCells);
	}

	function rotate() {
		onRotate?.(row, col, selectedCells);
	}

	function remove() {
		onRemove?.(row, col, selectedCells);
	}

	const actions = [
		{ label: 'Cut', run: cut },
		{ label: 'Copy', run: copy },
		{ label: 'Paste', run: paste },
		{ label: 'Rotate', run: rotate },
		{ label: 'Delete', run: remove }
	];
</script>

<div class="menu" role="menu">
	{#each actions as action (action.label)}
		<button
			type="button"
			role="menuitem"
			onclick={() => {
				action.run();
				close();
			}}
		>
			{action.label}
		</button>
	{/each}
</div>

<style>
	.menu {
		display: flex;
		flex-direction: column;
		min-width: 120px;
		padding: 4px;
		background: #ffffff;
		border: 1px solid #d4d4d8;
		border-radius: 6px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	}

	button {
		padding: 6px 10px;
		border: 0;
		border-radius: 4px;
		background: none;
		text-align: left;
		font: inherit;
		color: #18181b;
		cursor: pointer;
	}

	button:hover,
	button:focus-visible {
		background: #f4f4f5;
	}
</style>
