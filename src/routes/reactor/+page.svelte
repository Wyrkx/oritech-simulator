<script lang="ts">
	import type { BlockOption, BlockType, HeatStats, ReactorConfig } from './reactor';

	import Panel from '$lib/components/Panel/Panel.svelte';
	import PanelSection from '$lib/components/Panel/Section.svelte';
	import Grid from '$lib/components/Grid/Grid.svelte';
	import UpdateControls from '$lib/components/UpdateControls.svelte';
	import ContextMenu from './ContextMenu.svelte';

	import { blockOptions, reactorPresets } from './config';
	import { Reactor } from './reactor';
	import { getKey } from '$lib/utils';
	import { fly } from 'svelte/transition';

	type Preset = (typeof reactorPresets)[number];
	type PresetId = Preset['id'];

	let activePreset = $state<string>(reactorPresets[0].id);
	let reactorConfig = $state(reactorPresets[0].config);
	let boardWidth = $state(8);
	let boardHeight = $state(8);
	let reactorLayers = $state(1);
	let selectedBlock = $state<BlockOption>(blockOptions[0]);

	let grid: Grid;
	// svelte-ignore state_referenced_locally
	let reactor: Reactor = new Reactor(boardHeight, boardWidth, reactorLayers, reactorConfig);

	let autoUpdate = $state({
		staticStats: true,
		heatSimulation: false,
		blocks: false
	});
	let staticStats = $state(reactor.getStaticStats());
	let heatStats = $state<HeatStats>({ safe: true, ticksUntilExplosion: 0, maxHeat: 0 });
	let simulationTicks = $state(100000);
	let isHeatSimulating = $state(false);
	let heatSimulationRequestId = 0;
	let heatSimulationWorker: Worker | null = null;

	// Config related functions
	function applyPreset(preset: Preset) {
		activePreset = preset.id;
		reactorConfig = Object.assign(reactorConfig, {...preset.config});
	}

	function selectPreset(presetId: PresetId) {
		const preset = reactorPresets.find((entry) => entry.id === presetId) ?? reactorPresets[2];
		applyPreset(preset);

		update();
	}

	function updateConfigField<K extends keyof ReactorConfig>(field: K, value: ReactorConfig[K]) {
		const currentConfig = reactorConfig;
		if (activePreset !== 'custom') {
			selectPreset('custom');
		}
		reactorConfig = Object.assign(reactorConfig, { ...currentConfig, [field]: value });

		update();
	}

	// Grid related functions
	function clearBoard() {
		grid.clear();
		reactor.clearBlocks();
		updateStaticStats();
		void updateHeatStats();
	}

	function onCellSelect(row: number, col: number) {
		grid.setCellImage(row, col, selectedBlock.image);
		reactor.setBlock(col, row, selectedBlock.id);
		update();
	}

	// Context menu related functions
	type ClipboardCell = { row: number; col: number; blockType: BlockType };
	// blockType only has meaning while outOfBounds is true: it's the rotate action's own
	// way of remembering a cell's content while it's rotated off the board, since the
	// board itself (Reactor) refuses to store anything outside its bounds.
	type SelectedCell = { row: number; col: number; origin?: boolean; outOfBounds?: boolean; blockType?: BlockType };
	let clipboard = $state<{ anchor: { row: number; col: number }; cells: ClipboardCell[] } | null>(null);
	let editNotice = $state<string | null>(null);
	let editNoticeTimeoutId: ReturnType<typeof setTimeout> | undefined;

	function showEditNotice(message: string) {
		editNotice = message;
		clearTimeout(editNoticeTimeoutId);
		editNoticeTimeoutId = setTimeout(() => {
			editNotice = null;
		}, 2500);
	}

	// Builds the clipboard from the current selection; shared by copy and cut.
	function copyCellsToClipboard(row: number, col: number, selectedCells: SelectedCell[]): boolean {
		const isRightClickedCellSelected = selectedCells.some(
			(cell) => cell.row === row && cell.col === col && !cell.outOfBounds
		);
		if (!isRightClickedCellSelected) {
			return false;
		}

		clipboard = {
			anchor: { row, col },
			cells: selectedCells
				.filter((cell) => !cell.outOfBounds)
				.map((cell) => ({
					row: cell.row,
					col: cell.col,
					blockType: reactor.blocks.get(getKey(cell.col, cell.row)) ?? 'empty'
				}))
		};
		return true;
	}

	function copySelection(row: number, col: number, selectedCells: SelectedCell[]) {
		if (!copyCellsToClipboard(row, col, selectedCells)) {
			showEditNotice('Right-click a selected cell to copy.');
		}
	}

	function cutSelection(row: number, col: number, selectedCells: SelectedCell[]) {
		if (!copyCellsToClipboard(row, col, selectedCells)) {
			showEditNotice('Right-click a selected cell to cut.');
			return;
		}

		for (const cell of selectedCells) {
			if (cell.outOfBounds) continue;
			grid.clearCell(cell.row, cell.col);
			reactor.setBlock(cell.col, cell.row, 'empty');
		}

		update();
	}

	function pasteSelection(row: number, col: number) {
		if (!clipboard) {
			showEditNotice('Nothing to paste. Copy a selection first.');
			return;
		}

		const { anchor, cells } = clipboard;
		const pastedCells: SelectedCell[] = [];

		for (const cell of cells) {
			const targetRow = row + (cell.row - anchor.row);
			const targetCol = col + (cell.col - anchor.col);
			if (targetRow < 0 || targetRow >= boardHeight || targetCol < 0 || targetCol >= boardWidth) {
				continue;
			}

			const image = blockOptions.find((option) => option.id === cell.blockType)?.image ?? null;
			grid.setCellImage(targetRow, targetCol, image);
			reactor.setBlock(targetCol, targetRow, cell.blockType);

			pastedCells.push({
				row: targetRow,
				col: targetCol,
				origin: targetRow === row && targetCol === col
			});
		}

		grid.selectCells(pastedCells);
		update();
	}

	function rotateSelection(originRow: number, originCol: number, selectedCells: SelectedCell[]) {
		// Clockwise rotation around the origin: a cell "above" origin ends up "right" of
		// it, "right" ends up "below", and so on, i.e. (dRow, dCol) -> (dCol, -dRow).
		const rotatedCells: SelectedCell[] = selectedCells.map((cell) => {
			const dRow = cell.row - originRow;
			const dCol = cell.col - originCol;
			const newRow = originRow + dCol;
			const newCol = originCol - dRow;
			const outOfBounds = newRow < 0 || newRow >= boardHeight || newCol < 0 || newCol >= boardWidth;

			// A cell already off the board has no real data to read back from the
			// reactor, so carry forward whatever it remembered from going out of bounds.
			const blockType = cell.outOfBounds
				? cell.blockType ?? 'empty'
				: reactor.blocks.get(getKey(cell.col, cell.row)) ?? 'empty';

			return {
				row: newRow,
				col: newCol,
				origin: cell.row === originRow && cell.col === originCol,
				outOfBounds,
				blockType
			};
		});

		// Clear every old in-bounds position first, then write every new in-bounds
		// position, so cells that swap places don't clobber each other based on order.
		for (const cell of selectedCells) {
			if (cell.outOfBounds) continue;
			grid.clearCell(cell.row, cell.col);
			reactor.setBlock(cell.col, cell.row, 'empty');
		}

		for (const cell of rotatedCells) {
			if (cell.outOfBounds) continue;
			const image = blockOptions.find((option) => option.id === cell.blockType)?.image ?? null;
			grid.setCellImage(cell.row, cell.col, image);
			reactor.setBlock(cell.col, cell.row, cell.blockType ?? 'empty');
		}

		grid.selectCells(rotatedCells);
		update();
	}

	$effect(() => {
		reactor.height = boardHeight;
		reactor.width = boardWidth;
		reactor.layers = reactorLayers;
	});

	// Info related functions
	function updateStaticStats() {
		staticStats = reactor.getStaticStats();
	}

	function cancelHeatSimulation() {
		heatSimulationWorker?.terminate();
		heatSimulationWorker = null;
		isHeatSimulating = false;
	}

	async function updateHeatStats() {
		if (isHeatSimulating) {
			cancelHeatSimulation();
		}

		isHeatSimulating = true;
		heatSimulationRequestId += 1;
		const requestId = heatSimulationRequestId;

		const worker = new Worker(new URL('./heat.worker.ts', import.meta.url), { type: 'module' });
		heatSimulationWorker = worker;

		const payload = {
			id: requestId,
			ticks: simulationTicks,
			reactorData: $state.snapshot(reactor.getData())
		};

		try {
			const stats = await new Promise<HeatStats>((resolve, reject) => {
				const onMessage = (event: MessageEvent<{ id: number; stats: HeatStats }>) => {
					if (event.data.id !== requestId) {
						return;
					}
					cleanup();
					resolve(event.data.stats);
				};

				const onError = (event: ErrorEvent) => {
					cleanup();
					reject(event.error ?? new Error(event.message));
				};

				const cleanup = () => {
					worker.removeEventListener('message', onMessage);
					worker.removeEventListener('error', onError);
				};

				worker.addEventListener('message', onMessage);
				worker.addEventListener('error', onError);
				worker.postMessage(payload);
			});

			if (requestId === heatSimulationRequestId) {
				heatStats = stats;
			}
		} catch (error) {
			if (requestId === heatSimulationRequestId) {
				console.error('Heat simulation failed', error);
			}
		} finally {
			if (heatSimulationWorker === worker) {
				heatSimulationWorker = null;
			}
			worker.terminate();
			if (requestId === heatSimulationRequestId) {
				isHeatSimulating = false;
			}
		}
	}

	function update() {
		if (autoUpdate.staticStats) {
			updateStaticStats();
		}
		if (autoUpdate.heatSimulation) {
			void updateHeatStats();
		}
	}
</script>

<svelte:head>
	<title>Oritech Reactor Simulator</title>
</svelte:head>

<div class="page-shell">
	<div class="workspace">
		<!-- Config Panel -->
		<Panel scrollable={true}>
			<!-- Config Section -->
			<PanelSection heading="Config" collapsible={true}>
				<label class="field">
					<span>Choose a preset</span>
					<select class="preset-select" value={activePreset} onchange={(event) => selectPreset((event.currentTarget as HTMLSelectElement).value as PresetId)}>
						{#each reactorPresets as preset (preset.id)}
							<option value={preset.id}>{preset.name}</option>
						{/each}
					</select>
				</label>

				<div class="config-grid">
					<label class="field field-inline">
						<span>Safe Mode</span>
						<span class="checkbox-control">
							<input
								checked={reactorConfig.safeMode}
								type="checkbox"
								onchange={(event) => updateConfigField('safeMode', (event.currentTarget as HTMLInputElement).checked)}
							/>
							<svg class="checkbox-icon" viewBox="0 0 16 16" aria-hidden="true">
								<path d="M3.25 8.5L6.5 11.75 12.75 5.5" />
							</svg>
						</span>
					</label>

					<label class="field">
						<span>Safe Mode Cooldown</span>
						<input
							min="0"
							type="number"
							value={reactorConfig.safeModeCooldown}
							onchange={(event) => updateConfigField('safeModeCooldown', (event.currentTarget as HTMLInputElement).valueAsNumber)}
						/>
					</label>

					<label class="field">
						<span>Max Size</span>
						<input
							min="2"
							type="number"
							value={reactorConfig.maxSize}
							onchange={(event) => updateConfigField('maxSize', (event.currentTarget as HTMLInputElement).valueAsNumber)}
						/>
					</label>

					<label class="field">
						<span>Max Energy Stored</span>
						<input
							min="0"
							type="number"
							value={reactorConfig.reactorMaxEnergyStored}
							onchange={(event) => updateConfigField('reactorMaxEnergyStored', (event.currentTarget as HTMLInputElement).valueAsNumber)}
						/>
					</label>

					<label class="field">
						<span>Max Energy Output</span>
						<input
							min="0"
							type="number"
							value={reactorConfig.reactorMaxEnergyOutput}
							onchange={(event) => updateConfigField('reactorMaxEnergyOutput', (event.currentTarget as HTMLInputElement).valueAsNumber)}
						/>
					</label>

					<label class="field">
						<span>RF per pulse</span>
						<input
							min="0"
							type="number"
							value={reactorConfig.rfPerPulse}
							onchange={(event) => updateConfigField('rfPerPulse', (event.currentTarget as HTMLInputElement).valueAsNumber)}
						/>
					</label>

					<label class="field">
						<span>Absorber Rate</span>
						<input
							min="0"
							type="number"
							value={reactorConfig.absorberRate}
							onchange={(event) => updateConfigField('absorberRate', (event.currentTarget as HTMLInputElement).valueAsNumber)}
						/>
					</label>

					<label class="field">
						<span>Vent Base Rate</span>
						<input
							min="0"
							type="number"
							value={reactorConfig.ventBaseRate}
							onchange={(event) => updateConfigField('ventBaseRate', (event.currentTarget as HTMLInputElement).valueAsNumber)}
						/>
					</label>

					<label class="field">
						<span>Vent Relative Rate</span>
						<input
							min="0"
							type="number"
							value={reactorConfig.ventRelativeRate}
							onchange={(event) => updateConfigField('ventRelativeRate', (event.currentTarget as HTMLInputElement).valueAsNumber)}
						/>
					</label>

					<label class="field">
						<span>Max Heat</span>
						<input
							min="0"
							type="number"
							value={reactorConfig.maxHeat}
							onchange={(event) => updateConfigField('maxHeat', (event.currentTarget as HTMLInputElement).valueAsNumber)}
						/>
					</label>

					<label class="field">
						<span>Max Unstable Ticks</span>
						<input
							min="0"
							type="number"
							value={reactorConfig.maxUnstableTicks}
							onchange={(event) => updateConfigField('maxUnstableTicks', (event.currentTarget as HTMLInputElement).valueAsNumber)}
						/>
					</label>
				</div>
			</PanelSection>

			<!-- Grid Section -->
			<PanelSection heading="Size Settings" collapsible={true}>
					<label class="field">
						<span>Width</span>
						<input bind:value={boardWidth} min="2" max={reactorConfig.maxSize - 2} type="range" />
						<strong><input
							type="number"
							bind:value={boardWidth}
							min="1"
							style="width: 4em;"
						/> column(s)</strong>
					</label>

					<label class="field">
						<span>Height</span>
						<input bind:value={boardHeight} min="2" max={reactorConfig.maxSize - 2} type="range" />
						<strong><input
							type="number"
							bind:value={boardHeight}
							min="1"
							style="width: 4em;"
						/> row(s)</strong>
					</label>

					<label class="field">
						<span>Layers</span>
						<input bind:value={reactorLayers} min="1" max={reactorConfig.maxSize - 2} type="range" />
						<strong><input
							type="number"
							bind:value={reactorLayers}
							min="1"
							style="width: 4em;"
						/> layer(s)</strong>
					</label>
			</PanelSection>

			<!-- Edit Section -->
			<PanelSection heading="Edit" collapsible={false}>
				<div class="block-selector">
					{#each blockOptions as option (option.id)}
						<button
							type="button"
							class:active={selectedBlock.id == option.id}
							class="block-option"
							onclick={() => (selectedBlock = option)}
						>
							{#if option.image}
								<img src={option.image} alt={option.label} />
							{:else}
								<span class="empty-swatch" aria-hidden="true"></span>
							{/if}
							<span>{option.label}</span>
						</button>
					{/each}
				</div>
				<div class="section-actions">
					<button type="button" class="text-button" onclick={clearBoard}>Clear board</button>
				</div>
			</PanelSection>
		</Panel>
		
		<!-- Grid -->
		<Panel>
			<Grid
				width={boardWidth}
				height={boardHeight}
				draggable={true}
				customCellSelect={onCellSelect}
				enableSelect={true}
				contextMenu={ContextMenu}
				onCut={cutSelection}
				onCopy={copySelection}
				onPaste={pasteSelection}
				onRotate={rotateSelection}
				fillColour='#000000'
				bind:this={grid}
			/>
		</Panel>

		<!-- Output -->
		<Panel>
			<!-- Input/Output -->
			<PanelSection heading="Input/Output" collapsible={true}>
				<UpdateControls
					onUpdate={updateStaticStats}
					bind:autoUpdate={autoUpdate.staticStats}
				/>

				<div class="field">
					<span>Power Generated</span>
					<strong>{staticStats.powerGenerated} RF/t</strong>
				</div>

				<div class="field">
					<span>Fuel Consumption</span>
					<strong>{staticStats.fuelConsumption} units/t</strong>
				</div>

				<div class="field">
					<span>Coolant Consumption</span>
					<strong>{staticStats.coolantConsumption} units/t</strong>
				</div>
			</PanelSection>

			<!-- Simulation -->
			 <PanelSection heading="Heat" collapsible={true}>
				<UpdateControls
					onUpdate={updateHeatStats}
					bind:autoUpdate={autoUpdate.heatSimulation}
				/>

				<label class="field">
					<span>Simulation ticks</span>
					<input
						type="number"
						min="1"
						bind:value={simulationTicks}
					/>
				</label>

				<div class="field simulation-status">
					<strong
						class:status-safe={heatStats.safe}
						class:status-danger={!heatStats.safe}
					>
						{heatStats.safe ? 'SAFE' : 'DANGER'}
					</strong>
				</div>
				<div class="field">
					<span>Max Heat</span>
					<strong>{heatStats.maxHeat} °C</strong>
				</div>
				<div class="field">
					<span>Ticks before Explosion</span>
					<strong>{heatStats.ticksUntilExplosion} ticks</strong>
				</div>

			 </PanelSection>
		</Panel>
	</div>
	{#if editNotice}
		<div class="notice-popup" role="alert" transition:fly={{ y: -16, duration: 180 }}>
			{editNotice}
		</div>
	{/if}
	{#if isHeatSimulating}
		<div class="loading-overlay" role="alert" aria-live="assertive" aria-busy="true">
			<div class="loading-card">
				<strong>Simulating heat...</strong>
				<button type="button" class="cancel-button" onclick={cancelHeatSimulation}>Cancel</button>
			</div>
		</div>
	{/if}
</div>

<style>
	:global(body) {
		margin: 0;
		background:
			radial-gradient(circle at top, rgba(255, 255, 255, 0.04), transparent 42%),
			linear-gradient(180deg, #18181b 0%, #101012 100%);
		color: #e5e7eb;
	}

	.page-shell {
		height: 100dvh;
		min-height: 100vh;
		padding: 0.9rem 1rem 1rem;
		margin: 0 auto;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		gap: 0.75rem;
		box-sizing: border-box;
		overflow: hidden;
	}

	.workspace {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 100vh) minmax(0, 1fr);
		gap: 0.9rem;
		align-items: stretch;
		height: 100%;
		width: 100%;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
	}

	.loading-overlay {
		position: fixed;
		inset: 0;
		display: grid;
		place-items: center;
		background: rgba(10, 10, 12, 0.72);
		backdrop-filter: blur(2px);
		z-index: 1000;
	}

	.loading-card {
		display: grid;
		gap: 0.65rem;
		padding: 1rem 1.1rem;
		min-width: min(22rem, 90vw);
		border: 1px solid rgba(255, 255, 255, 0.12);
		background: rgba(15, 23, 42, 0.95);
		box-shadow: 0 14px 34px rgba(0, 0, 0, 0.35);
	}

	.cancel-button {
		justify-self: start;
		border: 1px solid rgba(239, 68, 68, 0.52);
		background: rgba(127, 29, 29, 0.56);
		color: #fee2e2;
		font: inherit;
		font-weight: 700;
		padding: 0.45rem 0.72rem;
		cursor: pointer;
	}

	.block-selector {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
		gap: 0.55rem;
		margin-bottom: 0.8rem;
	}

	.block-option {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.6rem;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(15, 23, 42, 0.55);
		color: #e2e8f0;
		cursor: pointer;
		font: inherit;
		text-align: left;
	}

	.block-option.active {
		border-color: rgba(96, 165, 250, 0.8);
		background: rgba(30, 41, 59, 0.9);
	}

	.block-option img,
	.empty-swatch {
		width: 1.5rem;
		height: 1.5rem;
		flex-shrink: 0;
		display: inline-block;
	}

	.block-option img {
		object-fit: contain;
	}

	.empty-swatch {
		background: #4f46e5;
		border: 1px solid rgba(255, 255, 255, 0.15);
		box-sizing: border-box;
	}

	.notice-popup {
		position: fixed;
		top: 1rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 1100;
		padding: 0.6rem 1rem;
		border: 1px solid rgba(239, 68, 68, 0.52);
		background: rgba(127, 29, 29, 0.92);
		color: #fee2e2;
		font-size: 0.85rem;
		font-weight: 700;
		box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
	}

	.section-actions {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.text-button {
		border: 0;
		background: transparent;
		color: #cbd5e1;
		font-weight: 700;
		cursor: pointer;
		padding: 0;
	}

	.field {
		display: grid;
		gap: 0.35rem;
		margin-bottom: 0.7rem;
	}

	.field span {
		font-size: 0.82rem;
		font-weight: 600;
		color: #cbd5e1;
	}

	.field strong {
		font-size: 0.86rem;
		color: #f3f4f6;
	}

	.simulation-status {
		margin-top: 0.35rem;
	}

	.simulation-status strong {
		display: inline-block;
		font-size: 1.5rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		line-height: 1.2;
	}

	.status-safe {
		color: #22c55e;
	}

	.status-danger {
		color: #ef4444;
	}

	.field input[type='range'] {
		width: 100%;
	}

	.field input[type='number'] {
		width: 100%;
		border: 1px solid rgba(255, 255, 255, 0.06);
		background: rgba(11, 11, 15, 0.92);
		color: #f3f4f6;
		border-radius: 0;
		padding: 0.68rem 0.8rem;
		font: inherit;
		box-sizing: border-box;
	}

	.field input[type='number'] {
		appearance: textfield;
		-moz-appearance: textfield;
	}

	.field input[type='number']::-webkit-outer-spin-button,
	.field input[type='number']::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	.field input[type='number']:focus-visible,
	.field input[type='checkbox']:focus-visible {
		outline: none;
		border-color: rgba(255, 255, 255, 0.12);
		box-shadow: 0 10px 22px rgba(0, 0, 0, 0.14);
	}

	.field-inline {
		grid-template-columns: 1fr auto;
		align-items: center;
		column-gap: 0.6rem;
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

	.config-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.55rem;
	}

	.preset-select {
		width: 100%;
		border: 1px solid rgba(255, 255, 255, 0.06);
		background: rgba(11, 11, 15, 0.92);
		color: #f3f4f6;
		border-radius: 0 !important;
		padding: 0.78rem 2.4rem 0.78rem 0.85rem;
		font: inherit;
		cursor: pointer;
		appearance: none;
		-webkit-appearance: none;
		background-image:
			linear-gradient(45deg, transparent 50%, #cbd5e1 50%),
			linear-gradient(135deg, #cbd5e1 50%, transparent 50%);
		background-position:
			calc(100% - 1.1rem) 50%,
			calc(100% - 0.8rem) 50%;
		background-size: 0.38rem 0.38rem, 0.38rem 0.38rem;
		background-repeat: no-repeat;
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
		transition:
			border-color 140ms ease,
			box-shadow 140ms ease,
			transform 140ms ease;
	}

	.preset-select:hover,
	.preset-select:focus-visible {
		outline: none;
		border-color: rgba(255, 255, 255, 0.12);
		box-shadow: 0 10px 22px rgba(0, 0, 0, 0.14);
		transform: translateY(-1px);
	}
</style>