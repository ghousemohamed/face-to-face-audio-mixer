const clamp01 = (value) => Math.max(0, Math.min(1, value));

export class EnergyVad {
  constructor({ minSnrDb = 6, snrRangeDb = 14 } = {}) {
    this.minSnrDb = minSnrDb;
    this.snrRangeDb = snrRangeDb;
  }

  process(samples, { snrDb, tonality }) {
    const energy = clamp01((snrDb - this.minSnrDb) / this.snrRangeDb);

    return energy * (0.4 + 0.6 * tonality);
  }
}
