import type { BlockType, HeatStats, ReactorConfig } from './reactor';
import { Reactor } from './reactor';
import { parseKey } from './utils';

type HeatSimulationRequest = {
	id: number;
	width: number;
	height: number;
	layers: number;
	ticks: number;
	config: ReactorConfig;
	blocks: Array<[string, BlockType]>;
};

type HeatSimulationResponse = {
	id: number;
	stats: HeatStats;
};

self.onmessage = (event: MessageEvent<HeatSimulationRequest>) => {
	const { id, width, height, layers, ticks, config, blocks } = event.data;
	const reactor = new Reactor(height, width, layers, config);

	for (const [key, blockType] of blocks) {
		const { x, y } = parseKey(key);
		reactor.setBlock(x, y, blockType);
	}

	const stats = reactor.simulateHeat(ticks);
	const response: HeatSimulationResponse = { id, stats };
	self.postMessage(response);
};
