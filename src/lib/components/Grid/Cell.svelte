<script lang="ts">
    interface Props {
        image?: string | null;
        rotation?: number;
        fillColour?: string;
        size: number;
    }

    const {
        image = null,
        rotation = 0,
        fillColour = "#4f46e5",
        size,
    }: Props = $props();
</script>

<div
    class="cell"
    style={`
        width: ${size}px;
        height: ${size}px;
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
}

img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    pointer-events: none;
}
</style>