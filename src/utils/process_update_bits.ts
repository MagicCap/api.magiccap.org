// Defines the type for the update bits.
export type UpdateBits = {
    stable: boolean;
    alpha: boolean;
    beta: boolean;
};

// Processes the update bits or null if they are invalid.
export default (value: string): UpdateBits | null => {
    const n = Number(value);
    if (isNaN(n) || n === Infinity) return null;
    return {
        stable: (n&1) !== 0,
        alpha: (n&2) !== 0,
        beta: (n&4) !== 0,
    };
};
