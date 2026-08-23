import type { ReactorConfig } from "./reactor";

export const reactorPresets: {id: string, name: string, config: ReactorConfig}[] = [
    {
        id: "default",
        name: "Default",
        config: {
            safeMode: false,
            safeModeCooldown: 2400,
            maxSize: 64,
            reactorMaxEnergyStored: 50_000_000,
            reactorMaxEnergyOutput: 25_000,
            rfPerPulse: 64,
            absorberRate: 16,
            ventBaseRate: 4,
            ventRelativeRate: 100,
            maxHeat: 2000,
            maxUnstableTicks: 600
        }
    },
    {
        id: "sb4",
        name: "Stoneblock 4",
        config: {
            safeMode: false,
            safeModeCooldown: 2400,
            maxSize: 64,
            reactorMaxEnergyStored: 500_000_000,
            reactorMaxEnergyOutput: 50_000_000,
            rfPerPulse: 9_600,
            absorberRate: 16,
            ventBaseRate: 4,
            ventRelativeRate: 100,
            maxHeat: 4_000,
            maxUnstableTicks: 400
        }
    },
    {
        id: "custom",
        name: "Custom",
        config: {
            safeMode: false,
            safeModeCooldown: 2400,
            maxSize: 64,
            reactorMaxEnergyStored: 50_000_000,
            reactorMaxEnergyOutput: 25_000,
            rfPerPulse: 64,
            absorberRate: 16,
            ventBaseRate: 4,
            ventRelativeRate: 100,
            maxHeat: 2000,
            maxUnstableTicks: 600
        }
    },
]