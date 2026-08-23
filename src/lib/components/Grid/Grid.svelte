<script lang="ts">
    import Cell from "./Cell.svelte";
    import { tick } from "svelte";
    import { SvelteMap } from "svelte/reactivity";
    import { getKey } from "../../../routes/minecraft/oritechreactor/utils";

    interface Props {
        width: number;
        height: number;
        onCellSelected: (row:number, col:number) => void;
        draggable?: boolean;
        fillColour?: string;
        image?: string | null;
    }
    const { 
        width = 8, 
        height = 8, 
        onCellSelected = () => {}, 
        draggable = false, 
        fillColour = "#4f46e5", 
        image = null 
    }: Props = $props();

    export interface CellData {
        image: string | null;
        rotation: number;
        fillColour: string;
    }

    let gridWrapper: HTMLDivElement;

    let cells = new SvelteMap<string, CellData>();
    let cellSize = $state(32);
    let lastGridSize = $state({ width: 0, height: 0 });
    let defaultCellData: CellData = createCellData();
    const GRID_GAP = 1;
    const GRID_BORDER = 1;

    function createCellData(): CellData {
        return {
            image: image,
            rotation: 0,
            fillColour: fillColour
        };
    }

    function getCellData(row: number, col: number): CellData {
        const key = getKey(row, col);
        return cells.get(key) ?? defaultCellData;
    }

    function getOrCreateCellData(row: number, col: number): CellData {
        const key = getKey(row, col);
        let cell = cells.get(key);

        if (!cell) {
            cell = createCellData();
            cells.set(key, cell);
        }

        return cell;
    }

    function updateCellData(row: number, col: number, updates: Partial<CellData>): CellData {
        const key = getKey(row, col);
        const current = cells.get(key) ?? createCellData();
        const next = { ...current, ...updates };
        cells.set(key, next);
        return next;
    }

    function resetCells() {
        cells.clear();
        lastGridSize = { width, height };
    }

    function resizeCells(nextWidth: number, nextHeight: number) {
        lastGridSize = { width: nextWidth, height: nextHeight };
    }

    $effect(() => {
        if (
            cells.size === 0 &&
            lastGridSize.width === 0 &&
            lastGridSize.height === 0
        ) {
            resetCells();
            return;
        }

        if (width !== lastGridSize.width || height !== lastGridSize.height) {
            resizeCells(width, height);
        }
    });

    // Handles changes to the container's actual size
    $effect(() => {
        if (!gridWrapper) return;

        const observer = new ResizeObserver(() => {
            updateCellSize();
        });

        observer.observe(gridWrapper);
        updateCellSize();

        return () => observer.disconnect();
    });

    // Handles changes to the number of rows/columns
    $effect(() => {
        tick().then(() => {
            updateCellSize();
        })
    });

    // Updates default cell data when the props change
    $effect(() => {
        defaultCellData = createCellData();
    });

    // ---------- Public API ----------

    export function setCellImage(row:number, col:number, image:string|null) {
        updateCellData(row, col, { image });
    }

    export function setCellRotation(row:number, col:number, rotation:number) {
        updateCellData(row, col, { rotation });
    }

    export function setCellAccent(row:number, col:number, accent:string) {
        updateCellData(row, col, { fillColour: accent });
    }

    export function clearCell(row:number, col:number) {
        updateCellData(row, col, { image: null, rotation: 0 });
    }

    export function clear() {
        resetCells();
    }

    // ---------- Interaction ----------

    function select(r:number, c:number) {
        onCellSelected(r,c);
    }

    function mouseEnter(e: MouseEvent, r:number, c:number) {
        if (e.buttons & 1)
            select(r, c);
    }

    function updateCellSize() {
        if (!gridWrapper) return;
        const totalHorizontalGap = Math.max(0, width - 1) * GRID_GAP;
        const totalVerticalGap = Math.max(0, height - 1) * GRID_GAP;
        const totalHorizontalBorder = GRID_BORDER * 2;
        const totalVerticalBorder = GRID_BORDER * 2;
        const usableWidth = Math.max(1, gridWrapper.clientWidth - totalHorizontalGap - totalHorizontalBorder);
        const usableHeight = Math.max(1, gridWrapper.clientHeight - totalVerticalGap - totalVerticalBorder);

        cellSize = gridWrapper
            ? Math.floor(
                  Math.min(
                      usableWidth / width,
                      usableHeight / height
                  )
              )
            : 32;
    }
</script>

<div bind:this={gridWrapper} class="grid-wrapper">
    <div
        class="grid"
        style={`
            grid-template-columns: repeat(${width}, ${cellSize}px);
            grid-template-rows: repeat(${height}, ${cellSize}px);
            gap: ${GRID_GAP}px;
        `}
    >
        {#each Array.from({ length: height }, (_, rowIndex) => rowIndex) as r (r)}
            {#each Array.from({ length: width }, (_, colIndex) => colIndex) as c (c)}
                {@const cell = getCellData(r, c)}
                <button
                    class="cell-wrapper"
                    onmouseenter={draggable ? (event) => mouseEnter(event, r,c) : undefined}
                    onmousedown={draggable ? () => select(r,c) : undefined}
                    onclick={!draggable ? () => select(r,c) : undefined}
                >
                    <Cell
                        image={cell.image}
                        rotation={cell.rotation}
                        fillColour={cell.fillColour}
                        size={cellSize}
                    />
                </button>
            {/each}
        {/each}
    </div>
</div>

<style>
    .grid-wrapper {
        width: 100%;
        height: 100%;
        min-width: 0;
        min-height: 0;

        overflow: hidden;

        display: flex;
        justify-content: center;
        align-items: center;
    }
    .grid{
        display:grid;
        background: #f4f4f5;
        border: 1px solid #f4f4f5;
        box-sizing: border-box;

        justify-content:center;
        align-content:center;
    }
    .cell-wrapper {
        padding: 0;
        margin: 0;
        border: 0;
        background: none;
        display: block;
    }
</style>