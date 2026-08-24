
export function getKey(x: number, y: number): string {
    return `${x},${y}`;
}

export function parseKey(key: string): {x: number, y: number} {
    const [x, y] = key.split(',').map(Number);
    return {x, y};
}
