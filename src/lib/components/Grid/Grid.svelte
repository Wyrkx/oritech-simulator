<script lang="ts">
    import Cell from "./Cell.svelte";
    import { tick, type Component } from "svelte";
    import { SvelteMap } from "svelte/reactivity";
    import { getKey } from "$lib/utils";

    export type CellAction = (row: number, col: number, selectedCells: { row: number; col: number }[]) => void;

    export interface ContextMenuProps {
        row: number;
        col: number;
        selectedCells: { row: number; col: number; origin?: boolean; outOfBounds?: boolean }[];
        close: () => void;
        onCut?: CellAction;
        onCopy?: CellAction;
        onPaste?: CellAction;
        onRotate?: CellAction;
        onRemove?: CellAction;
    }

    interface Props {
        width: number;
        height: number;
        customCellSelect: (row:number, col:number) => void;
        draggable?: boolean;
        enableSelect?: boolean;
        selectedCells?: { row: number; col: number; origin?: boolean; outOfBounds?: boolean }[];
        fillColour?: string;
        selectColour?: string;
        contextColour?: string;
        image?: string | null;
        contextMenu?: Component<ContextMenuProps>;
        onCut?: CellAction;
        onCopy?: CellAction;
        onPaste?: CellAction;
        onRotate?: CellAction;
        onRemove?: CellAction;
    }

    let {
        width = 8,
        height = 8,
        customCellSelect = () => {},
        draggable = false,
        enableSelect = false,
        selectedCells = $bindable([]),
        fillColour = "#4f46e5",
        selectColour = '#f59e0b',
        contextColour = '#38bdf8',
        image = null,
        contextMenu = undefined,
        onCut = undefined,
        onCopy = undefined,
        onPaste = undefined,
        onRotate = undefined,
        onRemove = undefined,
    }: Props = $props();

    export interface CellData {
        image: string | null;
        rotation: number;
        fillColour: string;
        accentColour: string | null;
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
            fillColour: fillColour,
            accentColour: null
        };
    }

    function getCellData(row: number, col: number): CellData {
        const key = getKey(row, col);
        return cells.get(key) ?? defaultCellData;
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

    export function setCellFillColour(row:number, col:number, accent:string) {
        updateCellData(row, col, { fillColour: accent });
    }

    export function setCellAccentColour(row:number, col:number, accent:string|null) {
        updateCellData(row, col, { accentColour: accent });
    }

    export function clearCell(row:number, col:number) {
        updateCellData(row, col, { image: null, rotation: 0 });
    }

    export function clear() {
        resetCells();
    }

    export function selectCells(cells: { row: number; col: number; origin?: boolean; outOfBounds?: boolean }[]) {
        selectedCells = cells;
    }

    // ---------- Interaction ----------

    const selectedKeys = $derived(new Set(selectedCells.map((cell) => getKey(cell.row, cell.col))));

    // Decided by the first cell of a drag: add to/remove from selectedCells (ctrl-drag),
    // or "clear" when a drag starts on a selection and should only clear it, never place
    let dragMode: "add" | "remove" | "clear" | null = null;

    function addSelected(r: number, c: number) {
        if (selectedKeys.has(getKey(r, c))) return;
        selectedCells = [...selectedCells, { row: r, col: c }];
    }

    function removeSelected(r: number, c: number) {
        if (!selectedKeys.has(getKey(r, c))) return;
        selectedCells = selectedCells.filter((cell) => cell.row !== r || cell.col !== c);
    }

    function clearSelection() {
        if (selectedCells.length > 0) selectedCells = [];
    }

    // The right-clicked cell is tracked as a special "origin" entry in selectedCells
    // (see openContextMenu), not here — menu only needs the popup's screen position.
    let menu = $state<{ x: number; y: number } | null>(null);
    const originCell = $derived(selectedCells.find((cell) => cell.origin) ?? null);
    let menuPos = $state({ x: 0, y: 0 });
    let menuEl = $state<HTMLDivElement>();
    const MENU_MARGIN = 4;

    function closeMenu() {
        menu = null;
    }

    // Moves the node to <body>: an ancestor with backdrop-filter (Panel) would
    // otherwise become the containing block for `position: fixed` and offset/clip the menu
    function portal(node: HTMLElement) {
        document.body.appendChild(node);
        return {
            destroy() {
                node.remove();
            },
        };
    }

    function openContextMenu(e: MouseEvent, r: number, c: number) {
        if (!contextMenu) return;
        e.preventDefault();
        dragMode = null;
        if (!selectedKeys.has(getKey(r, c))) {
            selectedCells = [{ row: r, col: c, origin: true }];
        } else {
            // Preserve any other data callers have attached to each cell (e.g. rotate's
            // outOfBounds tracking) — only the origin flag changes here.
            selectedCells = selectedCells.map((cell) => ({
                ...cell,
                origin: cell.row === r && cell.col === c
            }));
        }
        menuPos = { x: e.clientX, y: e.clientY };
        menu = { x: e.clientX, y: e.clientY };
    }

    // Keeps the menu inside the viewport once its size is known
    $effect(() => {
        if (!menu || !menuEl) return;
        const { width, height } = menuEl.getBoundingClientRect();
        menuPos = {
            x: Math.max(0, Math.min(menu.x, window.innerWidth - width - MENU_MARGIN)),
            y: Math.max(0, Math.min(menu.y, window.innerHeight - height - MENU_MARGIN)),
        };
    });

    const selecting = (e: MouseEvent) => enableSelect && e.ctrlKey;

    function mouseDown(e: MouseEvent, r: number, c: number) {
        if (e.button !== 0) return;
        if (selecting(e)) {
            dragMode = selectedKeys.has(getKey(r, c)) ? "remove" : "add";
            if (dragMode === "add") addSelected(r, c);
            else removeSelected(r, c);
            return;
        }
        if (!draggable) return;
        if (selectedCells.length > 0) {
            dragMode = "clear";
            clearSelection();
            return;
        }
        customCellSelect(r, c);
    }

    function mouseEnter(e: MouseEvent, r: number, c: number) {
        if (!(e.buttons & 1)) {
            dragMode = null;
            return;
        }
        if (dragMode === "add") addSelected(r, c);
        else if (dragMode === "remove") removeSelected(r, c);
        else if (dragMode === "clear") return;
        else if (draggable) customCellSelect(r, c);
    }

    function click(e: MouseEvent, r: number, c: number) {
        if (selecting(e)) {
            // Selection is already handled on mousedown
            return;
        }
        if (selectedCells.length > 0) {
            clearSelection();
            return;
        }
        customCellSelect(r, c);
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

<svelte:window
    onmouseup={() => (dragMode = null)}
    onmousedown={(e) => {
        if (menu && !menuEl?.contains(e.target as Node)) closeMenu();
    }}
    onkeydown={(e) => {
        if (e.key === "Escape") closeMenu();
    }}
    onblur={closeMenu}
    onresize={closeMenu}
/>

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
                    onmouseenter={draggable || enableSelect ? (event) => mouseEnter(event, r, c) : undefined}
                    onmousedown={draggable || enableSelect ? (event) => mouseDown(event, r, c) : undefined}
                    onclick={!draggable ? (event) => click(event, r, c) : undefined}
                    oncontextmenu={(event) => openContextMenu(event, r, c)}
                >
                    <Cell
                        image={cell.image}
                        rotation={cell.rotation}
                        fillColour={cell.fillColour}
                        accentColour={
                            originCell && originCell.row === r && originCell.col === c
                                ? contextColour
                                : selectedKeys.has(getKey(r, c))
                                    ? selectColour
                                    : cell.accentColour
                        }
                        size={cellSize}
                    />
                </button>
            {/each}
        {/each}
    </div>
</div>

{#if menu && contextMenu && originCell}
    {@const Menu = contextMenu}
    <div
        class="context-menu"
        bind:this={menuEl}
        use:portal
        style={`left: ${menuPos.x}px; top: ${menuPos.y}px;`}
    >
        <Menu row={originCell.row} col={originCell.col} {selectedCells} close={closeMenu} {onCut} {onCopy} {onPaste} {onRotate} {onRemove} />
    </div>
{/if}

<style>
    .context-menu {
        position: fixed;
        z-index: 1000;
    }
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