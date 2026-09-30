/** Per-traveller difference, derived from the two authoritative quotes. */
export const expressPriceDelta = (regularPrice: number, expressPrice: number) => Math.round((expressPrice - regularPrice) * 100) / 100;
