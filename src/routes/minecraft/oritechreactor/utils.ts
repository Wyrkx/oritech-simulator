interface Entry<T> {
    hash: number;
    key: string;
    vectorKey: Vector2i;
    value: T;
}

export class JavaHashMapOrder<T> {
    private buckets: Entry<T>[][];
    private capacity = 16;
    private threshold = 12;
    private size = 0;

    public constructor() {
        this.buckets = this.createBuckets(this.capacity);
    }

    public init(entries: {key: string, value: T}[]): void {
        for (const entry of entries) {
            this.insert(entry.key, entry.value);
        }
    }

    private createBuckets(capacity: number): Entry<T>[][] {
        return Array.from(
            { length: capacity },
            () => []
        );
    }

    public insert(key: string, value: T): void {
        const {x, y} = parseKey(key);
        const vectorKey = new Vector2i(x, y);
        const hash = javaHash(vectorKey);

        // HashMap resizes before inserting the new element.
        if (this.size + 1 > this.threshold) {
            this.resize();
        }

        const index = hash & (this.capacity - 1);

        this.buckets[index].push({
            hash,
            key,
            vectorKey,
            value
        });

        this.size++;
    }

    public *entries(): IterableIterator<Entry<T>> {
        for (const bucket of this.buckets) {
            for (const entry of bucket) {
                yield entry;
            }
        }
    }

    private resize(): void {
        const oldBuckets = this.buckets;
        const oldCapacity = this.capacity;

        this.capacity *= 2;
        this.threshold = Math.floor(this.capacity * 0.75);

        this.buckets = this.createBuckets(this.capacity);

        for (let oldIndex = 0; oldIndex < oldCapacity; oldIndex++) {
            const oldBucket = oldBuckets[oldIndex];

            const low: Entry<T>[] = [];
            const high: Entry<T>[] = [];

            const splitBit = oldCapacity;

            for (const entry of oldBucket) {
                if ((entry.hash & splitBit) === 0) {
                    low.push(entry);
                } else {
                    high.push(entry);
                }
            }

            this.buckets[oldIndex] = low;
            this.buckets[oldIndex + oldCapacity] = high;
        }
    }
}

function tableSizeFor(capacity: number): number {
    if (capacity <= 1) return 1;
    return Math.pow(2, Math.ceil(Math.log2(capacity)));
}

export function javaHash(item: { hashCode(): number }): number {
    const hash = item.hashCode();
    return (hash ^ (hash >>> 16)) >>> 0;
}

export class JavaHashSetOrder<T extends { hashCode(): number }> {
    private buckets: T[][];
    private capacity: number;
    private threshold: number;
    private size = 0;

    public constructor(initialCapacity: number = 16) {
        this.capacity = tableSizeFor(initialCapacity);
        this.threshold = Math.floor(this.capacity * 0.75);
        this.buckets = this.createBuckets(this.capacity);
    }

    private createBuckets(capacity: number): T[][] {
        return Array.from({ length: capacity }, () => []);
    }

    public add(item: T): void {
        // Matches JavaHashMapOrder: resize happens before the new
        // element is placed, which yields the same final bucket
        // layout as Java's resize-after-insert for this purpose.
        if (this.size + 1 > this.threshold) {
            this.resize();
        }

        const index = javaHash(item) & (this.capacity - 1);
        this.buckets[index].push(item);
        this.size++;
    }

    public *values(): IterableIterator<T> {
        for (const bucket of this.buckets) {
            for (const item of bucket) {
                yield item;
            }
        }
    }

    private resize(): void {
        const oldBuckets = this.buckets;
        const oldCapacity = this.capacity;

        this.capacity *= 2;
        this.threshold = Math.floor(this.capacity * 0.75);
        this.buckets = this.createBuckets(this.capacity);

        const splitBit = oldCapacity;
        for (let oldIndex = 0; oldIndex < oldCapacity; oldIndex++) {
            const low: T[] = [];
            const high: T[] = [];

            for (const item of oldBuckets[oldIndex]) {
                if ((javaHash(item) & splitBit) === 0) {
                    low.push(item);
                } else {
                    high.push(item);
                }
            }

            this.buckets[oldIndex] = low;
            this.buckets[oldIndex + oldCapacity] = high;
        }
    }
}

export class Vector2i {
    constructor(
        public x: number = 0,
        public y: number = 0
    ) {}

    equals(other: Vector2i): boolean {
        return this.x === other.x && this.y === other.y;
    }

    hashCode(): number {
        let result = 1;
        result = Math.imul(31, result) + this.x;
        result = Math.imul(31, result) + this.y;
        return result | 0;
    }

    clone(): Vector2i {
        return new Vector2i(this.x, this.y);
    }

    toString(): string {
        return `(${this.x}, ${this.y})`;
    }
}

export function getKey(x: number, y: number): string {
    return `${x},${y}`;
}

export function parseKey(key: string): {x: number, y: number} {
    const [x, y] = key.split(',').map(Number);
    return {x, y};
}
