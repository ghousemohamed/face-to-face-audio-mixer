const BAND_CENTRES_HZ = [500, 1200, 2400, 4000];
const BAND_Q = 1.2;

const ENVELOPE_MAX_AGE_MS = 700;
const ENVELOPE_MIN_FRAMES = 12;

export class SpeechEnvelope {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.bands = null;
    this.bandVariance = BAND_CENTRES_HZ.map(() => 0);
    this.envelopeVariance = 0;
  }

  track(samples, elapsedMs, voiced) {
    this.bands ??= BAND_CENTRES_HZ.map((centre) => ({
      filter: bandpass(centre, this.sampleRate),
      history: [],
    }));

    for (const band of this.bands) {
      const level = band.filter(samples);
      if (voiced) band.history.push({ level, atMs: elapsedMs });
    }

    this.expire(elapsedMs);
  }

  expire(elapsedMs) {
    if (!this.bands) return;

    const oldest = elapsedMs - ENVELOPE_MAX_AGE_MS;
    let total = 0;

    for (let b = 0; b < this.bands.length; b += 1) {
      const history = this.bands[b].history;
      while (history.length > 0 && history[0].atMs < oldest) history.shift();

      this.bandVariance[b] = history.length < ENVELOPE_MIN_FRAMES ? 0 : varianceOf(history);
      total += this.bandVariance[b];
    }

    this.envelopeVariance = total / this.bands.length;
  }
}

function varianceOf(history) {
  let logSum = 0;
  for (let i = 0; i < history.length; i += 1) {
    logSum += Math.log(Math.max(history[i].level, 1e-10));
  }
  const geometricMean = Math.exp(logSum / history.length);

  let sum = 0;
  let sumOfSquares = 0;
  for (let i = 0; i < history.length; i += 1) {
    const compressed = Math.cbrt(history[i].level / geometricMean);
    sum += compressed;
    sumOfSquares += compressed * compressed;
  }

  const mean = sum / history.length;
  return Math.max(0, sumOfSquares / history.length - mean * mean);
}

function bandpass(centreHz, sampleRate) {
  const w0 = (2 * Math.PI * centreHz) / sampleRate;
  const alpha = Math.sin(w0) / (2 * BAND_Q);
  const a0 = 1 + alpha;

  const b0 = alpha / a0;
  const b2 = -alpha / a0;
  const a1 = (-2 * Math.cos(w0)) / a0;
  const a2 = (1 - alpha) / a0;

  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;

  return (samples) => {
    let sumOfSquares = 0;

    for (let i = 0; i < samples.length; i += 1) {
      const x0 = samples[i];
      const y0 = b0 * x0 + b2 * x2 - a1 * y1 - a2 * y2;

      x2 = x1;
      x1 = x0;
      y2 = y1;
      y1 = y0;

      sumOfSquares += y0 * y0;
    }

    return Math.sqrt(sumOfSquares / samples.length);
  };
}
