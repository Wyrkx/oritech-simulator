<script lang="ts">
    interface Props {
        image?: string | null;
        rotation?: number;
        fillColour?: string;
        accentColour?: string | null;
        size: number;
    }

    const {
        image = null,
        rotation = 0,
        fillColour = "#4f46e5",
        accentColour = null,
        size,
    }: Props = $props();
</script>

<div
    class="cell"
    class:accented={accentColour}
    style={`
        width: ${size}px;
        height: ${size}px;
        ${accentColour ? `--accent: ${accentColour};` : ""}
        ${
            !image
                ? `
                background: ${fillColour};
                `
                : ""
        }
    `}
>
    {#if image}
        <img
            src={image}
            alt=""
            draggable="false"
            style={`transform: rotate(${rotation}deg);`}
        />
    {/if}
</div>

<style>
.cell {
    display: flex;
    justify-content: center;
    align-items: center;
    user-select: none;
    box-sizing: border-box;
    position: relative;
}

.cell.accented {
    box-shadow: inset 0 0 0 2px var(--accent);
}

.cell.accented::after {
    content: "";
    position: absolute;
    inset: 0;
    background: var(--accent);
    opacity: 0.35;
    pointer-events: none;
}

img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    pointer-events: none;
}
</style>