<script lang="ts">
    interface Props {
        onUpdate: () => void;
        autoUpdate?: boolean;
    }

    let {
        onUpdate,
        autoUpdate = $bindable(false)
    }: Props = $props();

    function handleAutoUpdateChange(event: Event) {
        if ((event.currentTarget as HTMLInputElement).checked) {
            onUpdate();
        }
    }
</script>

<div class="update-controls">
    <button type="button" class="update-button" onclick={onUpdate}>Update</button>

    <label class="update-toggle">
        <span>Auto update</span>
        <span class="checkbox-control">
            <input
                type="checkbox"
                bind:checked={autoUpdate}
                onchange={handleAutoUpdateChange}
            />
            <svg class="checkbox-icon" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M3.25 8.5L6.5 11.75 12.75 5.5" />
            </svg>
        </span>
    </label>
</div>

<style>
    .update-controls {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        margin-bottom: 0.85rem;
    }

    .update-button {
        border: 1px solid rgba(255, 255, 255, 0.12);
        background: rgba(15, 23, 42, 0.55);
        color: #e2e8f0;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
        padding: 0.42rem 0.72rem;
        transition:
            border-color 140ms ease,
            transform 140ms ease,
            box-shadow 140ms ease;
    }

    .update-button:hover,
    .update-button:focus-visible {
        outline: none;
        border-color: rgba(96, 165, 250, 0.7);
        box-shadow: 0 10px 22px rgba(0, 0, 0, 0.18);
        transform: translateY(-1px);
    }

    .update-toggle {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.82rem;
        font-weight: 600;
        color: #cbd5e1;
    }

    .checkbox-control {
        justify-self: center;
        position: relative;
        width: 1.35rem;
        height: 1.35rem;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(11, 11, 15, 0.92);
        display: grid;
        place-items: center;
        box-sizing: border-box;
        cursor: pointer;
        transition:
            border-color 140ms ease,
            background-color 140ms ease,
            box-shadow 140ms ease,
            transform 140ms ease;
    }

    .checkbox-control input[type='checkbox'] {
        position: absolute;
        inset: 0;
        margin: 0;
        opacity: 0;
        cursor: pointer;
    }

    .checkbox-icon {
        width: 0.9rem;
        height: 0.9rem;
        color: #cbd5e1;
        fill: none;
        stroke: currentColor;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
        opacity: 0;
        transform: scale(0.92);
        transition:
            opacity 140ms ease,
            transform 140ms ease,
            color 140ms ease;
    }

    .checkbox-control input[type='checkbox']:checked + .checkbox-icon {
        opacity: 1;
        color: #e5e7eb;
        transform: scale(1);
    }

    .checkbox-control:has(input[type='checkbox']:checked) {
        background: rgba(15, 23, 42, 0.96);
    }

    .checkbox-control:hover,
    .checkbox-control:focus-within {
        outline: none;
        border-color: rgba(255, 255, 255, 0.16);
        box-shadow: 0 10px 22px rgba(0, 0, 0, 0.14);
        transform: translateY(-1px);
    }
</style>
