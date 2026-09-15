const CROSSFADE_MS = 30;
const HALF_PI = Math.PI / 2;

export class Crossfade {
  constructor(sampleRate) {
    this.crossfadeSamples = Math.max(1, Math.round((sampleRate * CROSSFADE_MS) / 1000));
    this.playingId = null;
    this.fadeFromId = null;
    this.fadePosition = this.crossfadeSamples;
  }

  get fading() {
    return this.fadePosition < this.crossfadeSamples;
  }

  render(selectedId, sources, output) {
    if (this.playingId !== selectedId) {
      this.fadeFromId = this.playingId;
      this.playingId = selectedId;
      this.fadePosition = 0;
    }

    const to = sources.get(this.playingId) ?? null;
    const from = sources.get(this.fadeFromId) ?? null;

    for (let i = 0; i < output.length; i += 1) {
      if (!this.fading) {
        output[i] = to ? to[i] : 0;
        continue;
      }

      const t = this.fadePosition / this.crossfadeSamples;
      output[i] =
        (to ? to[i] * Math.sin(t * HALF_PI) : 0) + (from ? from[i] * Math.cos(t * HALF_PI) : 0);
      this.fadePosition += 1;
    }

    return output;
  }
}
