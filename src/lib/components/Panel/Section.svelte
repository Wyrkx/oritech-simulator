<script lang="ts">
	import type { Snippet } from "svelte";


    interface Props {
        heading?: string;
        collapsible?: boolean;
        children?: () => Snippet;
    }

	const { children, heading, collapsible = false }: Props = $props();

    let isCollapsed = $state(false);

    export function toggleCollapsed() {
        isCollapsed = !isCollapsed;
    }
</script>

<div class="panel-section">
    <div class="section-heading">
        {#if heading}
            <p class="section-label">{heading}</p>
        {/if}
        {#if collapsible}
            <button
                type="button"
                class="section-toggle"
                onclick={toggleCollapsed}
                aria-expanded={!isCollapsed}
                aria-label={isCollapsed ? 'Expand section' : 'Collapse section'}
            >
                <span class:collapsed={isCollapsed} class="section-toggle-icon" aria-hidden="true"></span>
            </button>
        {/if}
    </div>
    {#if !isCollapsed}
        {@render children?.()}
    {/if}
</div>

<style>
    .panel-section {
        padding: 0.8rem;
        border-radius: 0;
        background: rgba(7, 7, 10, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .section-heading {
        display: flex;
        justify-content: space-between;
        gap: 0.75rem;
        align-items: center;
        margin-bottom: 0.65rem;
    }

    .section-label {
        padding: 0;
        letter-spacing: 0.14em;
        font-size: 0.72rem;
        font-weight: 700;
        color: #94a3b8;
        margin: 0 0 0.4rem;
    }

    .section-toggle {
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(11, 11, 15, 0.92);
        color: #cbd5e1;
        font: inherit;
        cursor: pointer;
        padding: 0;
        width: 1.9rem;
        height: 1.9rem;
        display: grid;
        place-items: center;
        box-sizing: border-box;
        flex: 0 0 auto;
        transition:
            border-color 140ms ease,
            background-color 140ms ease,
            transform 140ms ease,
            box-shadow 140ms ease;
    }

    .section-toggle:hover,
    .section-toggle:focus-visible {
        outline: none;
        border-color: rgba(255, 255, 255, 0.14);
        box-shadow: 0 10px 22px rgba(0, 0, 0, 0.14);
        transform: translateY(-1px);
    }

    .section-toggle-icon {
        width: 1rem;
        height: 1rem;
        display: block;
        background-color: currentColor;
        -webkit-mask: url('/caret-down.svg') center / contain no-repeat;
        mask: url('/caret-down.svg') center / contain no-repeat;
        transition: transform 140ms ease;
    }

    .section-toggle-icon.collapsed {
        transform: rotate(180deg);
    }

    @media (max-height: 900px) {
        .panel-section {
            padding: 0.7rem;
        }
    }
</style>