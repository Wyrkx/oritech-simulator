import type { HeatStats, ReactorData } from './reactor';
import { Reactor } from './reactor';

type HeatSimulationRequest = {
	id: number;
	ticks: number;
	reactorData: ReactorData;
};

type HeatSimulationResponse = {
	id: number;
	stats: HeatStats;
};

self.onmessage = (event: MessageEvent<HeatSimulationRequest>) => {
	const { id, ticks, reactorData } = event.data;
	const reactor = Reactor.createFromData(reactorData);

	const stats = reactor.simulateHeat(ticks);
	const response: HeatSimulationResponse = { id, stats };
	self.postMessage(response);
};
