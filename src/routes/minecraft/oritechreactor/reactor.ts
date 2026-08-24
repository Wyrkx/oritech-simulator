import { getKey, JavaHashMapOrder, JavaHashSetOrder, parseKey, Vector2i } from "./utils";

export type ReactorConfig = {
	safeMode: boolean;
	safeModeCooldown: number;
	maxSize: number;
	reactorMaxEnergyStored: number;
	reactorMaxEnergyOutput: number;
	rfPerPulse: number;
	absorberRate: number;
	ventBaseRate: number;
	ventRelativeRate: number;
	maxHeat: number;
	maxUnstableTicks: number;
};

export type BlockType = 'empty' | 'rod1' | 'rod2' | 'rod4' | 'pipe' | 'reflector' | 'vent' | 'absorber'

export type BlockOption = {
    id: BlockType;
    label: string;
    image: string | null;
}

export type StaticStats = {
    powerGenerated: number;
    fuelConsumption: number;
    coolantConsumption: number;
}

export type HeatStats = {
    safe: boolean;
    ticksUntilExplosion: number;
    maxHeat: number;
}

export type ReactorData = {
    height: number;
    width: number;
    layers: number;
    config: ReactorConfig;
    blocks: Map<string, BlockType>;
}

const RodBlockData: Map<BlockType, { intPulses: number, extPulses: number, fuelConsumption: number }> = new Map([
    ['rod1', { intPulses: 1, extPulses: 1, fuelConsumption: 1 }],
    ['rod2', { intPulses: 4, extPulses: 2, fuelConsumption: 2 }],
    ['rod4', { intPulses: 12, extPulses: 4, fuelConsumption: 4 }]
]);

export class Reactor {
    height: number;
    width: number;
    layers: number;
    config: ReactorConfig;

    blocks: Map<string, BlockType>;
    fuelRods: Map<string, BlockType>;
    absorbers: Set<string>;

    public constructor(height: number, width: number, layers: number, config: ReactorConfig) {
        this.height = height;
        this.width = width;
        this.layers = layers;
        this.config = config;
        this.blocks = new Map();
        this.fuelRods = new Map();
        this.absorbers = new Set();
    }

    public static createFromData(reactorData: ReactorData): Reactor {
        const { height, width, layers, config, blocks } = reactorData;
        const reactor = new Reactor(height, width, layers, config);
        for (const [key, blockType] of blocks) {
            const {x, y} = parseKey(key);
            reactor.setBlock(x, y, blockType);
        }
        return reactor;
    }

    public getData(): ReactorData {
        return {
            height: this.height,
            width: this.width,
            layers: this.layers,
            config: this.config,
            blocks: this.blocks
        };
    }

    public setBlock(x: number, y: number, blockType: BlockType) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return;
        }
        const key = getKey(x, y);
        if (blockType === 'empty') {
            this.blocks.delete(key);
            this.fuelRods.delete(key);
            this.absorbers.delete(key);
        } else {
            this.blocks.set(key, blockType);
            if (blockType === 'rod1' || blockType === 'rod2' || blockType === 'rod4') {
                this.fuelRods.set(key, blockType);
            } else {
                this.fuelRods.delete(key);
            }
            if (blockType === 'absorber') {
                this.absorbers.add(key);
            } else {
                this.absorbers.delete(key);
            }
        }
    }

    public clearBlocks() {
        this.blocks.clear();
        this.fuelRods.clear();
        this.absorbers.clear();
    }

    public getStaticStats(): StaticStats {
        let totalPower: number = 0;
        let totalFuelConsumption: number = 0;
        let totalCoolantConsumption: number = 0;

        for (const [key, blockType] of this.fuelRods) {
            if (!this.isValidKey(key)) {
                continue;
            }
            totalFuelConsumption += RodBlockData.get(blockType)!.fuelConsumption;

            
            totalPower += this.getPulses(key) * this.config.rfPerPulse;
        }

        for (const key of this.absorbers) {
            if (this.isValidKey(key)) {
                totalCoolantConsumption += this.config.absorberRate;
            }
        }

        return {
            powerGenerated: totalPower * this.layers,
            fuelConsumption: totalFuelConsumption * this.layers,
            coolantConsumption: totalCoolantConsumption * this.layers
        };
    }

    public simulateHeat(ticks: number): HeatStats {
        let safe = true;
        let ticksUntilExplosion = 0;
        let maxHeat = 0;

        const components = new JavaHashMapOrder<BlockType>();
        const heatMap: Map<string, number> = new Map();
        for (let x = 0; x < this.width; x++) {
            for (let y = 0; y < this.height; y++) {
                const key = getKey(x, y);
                const blockType = this.blocks.get(key);
                if (blockType) {
                    components.insert(key, blockType);
                    heatMap.set(key, 0);
                }
            }
        }

        let unstableTicks = 0;
        for (let tick = 0; tick < ticks; tick++) {
            let hottestHeat = 0;
            for (const {key, value: blockType} of components.entries()) {
                let currentHeat = heatMap.get(key) || 0;
                if (blockType === 'rod1' || blockType === 'rod2' || blockType === 'rod4') {
                    const pulses = this.getPulses(key);
                    const heatIncrease = Math.floor(pulses / 2) * pulses + 4;
                    currentHeat += heatIncrease;
                    heatMap.set(key, currentHeat);
                } else if (blockType === 'pipe') {
                    for (const neighbourKey of this.getAdjacentKeys(key)) {
                        const neighbourHeat = heatMap.get(neighbourKey) || 0;
                        if (neighbourHeat < currentHeat) 
                            continue;
                        const heatDifference = neighbourHeat - currentHeat;
                        const heatTransfer = Math.min(Math.floor(heatDifference / 4) + 10, heatDifference);
                        currentHeat += heatTransfer;
                        heatMap.set(neighbourKey, neighbourHeat - heatTransfer);
                    }
                    heatMap.set(key, currentHeat);
                } else if (blockType === 'absorber') {
                    for (const neighbourKey of this.getAdjacentKeys(key)) {
                        const neighbourHeat = heatMap.get(neighbourKey) || 0;
                        if (neighbourHeat <= 0)
                            continue;
                        heatMap.set(neighbourKey, neighbourHeat - this.config.absorberRate);
                    }
                } else if (blockType === 'vent') {
                    let hottestKey = '', hottest = 0;
                    for (const neighbourKey of this.getAdjacentKeys(key)) {
                        const neighbourHeat = heatMap.get(neighbourKey) || 0;
                        if (neighbourHeat > hottest) {
                            hottest = neighbourHeat;
                            hottestKey = neighbourKey;
                        }
                    }
                    if (hottestKey) {
                        const ventRate = Math.min(Math.floor(hottest / this.config.ventRelativeRate) + this.config.ventBaseRate, hottest);
                        heatMap.set(hottestKey, Math.max(0, hottest - ventRate));
                    }
                }
                hottestHeat = Math.max(hottestHeat, currentHeat)
                maxHeat = Math.max(maxHeat, hottestHeat)
            }
            if (hottestHeat > this.config.maxHeat) {
                unstableTicks++;
                if (unstableTicks > this.config.maxUnstableTicks) {
                    ticksUntilExplosion = tick;
                    safe = false;
                    break;
                }
            } else {
                unstableTicks = 0;
            }
        }
        
        return { safe, ticksUntilExplosion, maxHeat };
    }

    private getPulses(key: string): number {
        const blockType = this.blocks.get(key);
        if (!blockType || !RodBlockData.has(blockType)) {
            return 0;
        }
        let pulses = RodBlockData.get(blockType)!.intPulses;
        for (const adjacent of this.getAdjacentKeys(key)) {
            const adjacentBlock = this.blocks.get(adjacent);
            if (adjacentBlock === 'rod1' || adjacentBlock === 'rod2' || adjacentBlock === 'rod4') {
                pulses += RodBlockData.get(adjacentBlock)!.extPulses;
            } else if (adjacentBlock === 'reflector') {
                pulses += RodBlockData.get(blockType)!.extPulses;
            }
        }
        return pulses;
    }

    public isValidPosition(x: number, y: number): boolean {
        return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }

    private isValidKey(key: string): boolean {
        const {x, y} = parseKey(key);
        return this.isValidPosition(x, y);
    }

    public getAdjacentPositions(x: number, y: number): {x: number, y: number}[] {
        const directions = [
            {dx: -1, dy: 0},    // left
            {dx: 0, dy: 1},     // down
            {dx: 1, dy: 0},     // right
            {dx: 0, dy: -1},    // up
        ];

        const neighbours = new JavaHashSetOrder<Vector2i>(4);
        for (const dir of directions) {
            const newX = x + dir.dx;
            const newY = y + dir.dy;
            if (!this.isValidPosition(newX, newY))
                continue;

            const newKey = getKey(newX, newY);
            if (this.blocks.has(newKey)) {
                neighbours.add(new Vector2i(newX, newY));
            }
        }

        const ordered: {x: number, y: number}[] = [];
        for (const neighbour of neighbours.values()) {
            ordered.push({x: neighbour.x, y: neighbour.y});
        }
        return ordered
    }

    private getAdjacentKeys(key: string): string[] {
        const {x, y} = parseKey(key);
        const adjacentPositions = this.getAdjacentPositions(x, y);
        return adjacentPositions.map(pos => getKey(pos.x, pos.y));
    }
}
