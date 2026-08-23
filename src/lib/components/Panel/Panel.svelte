<script lang="ts">
	import type { Snippet } from "svelte";


    interface Props {
        scrollable?: boolean;
		children?: () => Snippet;
    }

    const { children, scrollable = false }: Props = $props();
</script>

<div class="panel">
	<div
		class="panel-scroll"
		class:scrollable
		class:static={!scrollable}
	>
		<div class="panel-scroll-inner">
			{@render children?.()}
		</div>
	</div>
</div>

<style>
	.panel {
		display: flex;
		flex-direction: column;

		min-width: 0;
		min-height: 0;

		overflow: hidden;

		background: rgba(24, 24, 27, 0.88);
		backdrop-filter: blur(12px);
		border: 1px solid rgba(255, 255, 255, 0.08);
		box-shadow: 0 18px 40px rgba(0, 0, 0, 0.28);
	}

	.panel-scroll {
		display: grid;
		gap: 0.75rem;

		flex: 1;

		min-width: 0;
		min-height: 0;

		margin: 0;
	}

	.scrollable {
		overflow: auto;
		padding: 0.95rem;
	}

	.static {
		overflow: hidden;
		padding: 0;
	}

	.panel-scroll-inner {
		min-width: 0;
		min-height: 0;

		padding: 0.8rem;
	}
</style>