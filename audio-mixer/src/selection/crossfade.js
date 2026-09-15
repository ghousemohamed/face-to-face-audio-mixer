const ATTACK_MS = 12;
const RELEASE_MS = 120;
const SILENT_GAIN = 1e-4;

export class Crossfade {
  constructor(sampleRate) {
    this.attack = rateFor(ATTACK_MS, sampleRate);
    this.release = rateFor(RELEASE_MS, sampleRate);
    this.gains = new Map();
  }

  render(selectedId, sources, output) {
    output.fill(0);

    for (const id of this.gains.keys()) {
      if (!sources.has(id)) this.gains.delete(id);
    }

    for (const [id, source] of sources) {
      const target = id === selectedId ? 1 : 0;
      let gain = this.gains.get(id) ?? 0;

      if (gain === 0 && target === 0) continue;

      const rate = target > gain ? this.attack : this.release;

      for (let i = 0; i < output.length; i += 1) {
        gain += (target - gain) * rate;
        if (source) output[i] += source[i] * gain;
      }

      this.gains.set(id, target === 0 && gain < SILENT_GAIN ? 0 : gain);
    }

    return output;
  }
}

function rateFor(milliseconds, sampleRate) {
  return 1 - Math.exp(-1 / ((milliseconds / 1000) * sampleRate));
}
