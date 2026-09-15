const IMMEDIATE_ALPHA = 0.28;
const MEDIUM_ALPHA = 0.095;
const LONG_ALPHA = 0.033;

const LONG_MARGIN = 0.05;
const MEDIUM_MARGIN = 0.05;

const SILENCE_SCORE = 0.08;
const SILENCE_HOLD_MS = 300;

const FAILSAFE_SNR_DB = 12;

const FAILSAFE_ALPHA = 0.02;
const FAILSAFE_SHARE = 0.15;

export class Selector {
  constructor(frameDurationMs) {
    this.frameDurationMs = frameDurationMs;

    this.elapsedMs = 0;
    this.selectedId = null;
    this.silentSince = null;
    this.tracks = new Map();

    this.audibleShare = new Map();

    this.audibleSnrDb = new Map();

    this.reason = 'silence';
  }

  scoreOf(deviceId) {
    return this.tracks.get(deviceId)?.medium ?? 0;
  }

  choose(metrics) {
    this.elapsedMs += this.frameDurationMs;
    this.score(metrics);

    let bestId = null;
    let bestMedium = -Infinity;
    let loudestImmediate = 0;

    for (const [id, track] of this.tracks) {
      if (!metrics.has(id)) continue;
      if (track.medium > bestMedium) {
        bestMedium = track.medium;
        bestId = id;
      }
      if (track.immediate > loudestImmediate) loudestImmediate = track.immediate;
    }

    if (bestId === null || loudestImmediate < SILENCE_SCORE) {
      this.silentSince ??= this.elapsedMs;

      if (this.elapsedMs - this.silentSince >= SILENCE_HOLD_MS) {
        const audible = this.mostAudible(metrics);

        if (audible) {
          this.selectedId = audible;
          this.reason = 'failsafe';
          return this.selectedId;
        }

        this.selectedId = null;
        this.reason = 'silence';
        return this.selectedId;
      }

      this.reason = this.selectedId === null ? 'silence' : 'hold';
      return this.selectedId;
    }

    this.silentSince = null;
    this.reason = 'speech';

    if (this.selectedId === null || !metrics.has(this.selectedId)) {
      this.selectedId = bestId;
      return this.selectedId;
    }

    if (bestId !== this.selectedId && this.clearlyBetter(bestId, this.selectedId)) {
      this.selectedId = bestId;
    }

    return this.selectedId;
  }

  mostAudible(metrics) {
    const audible = (id) => metrics.has(id) && (this.audibleShare.get(id) ?? 0) >= FAILSAFE_SHARE;

    if (this.selectedId && audible(this.selectedId)) return this.selectedId;

    let bestId = null;
    let bestSnrDb = -Infinity;

    for (const [id] of metrics) {
      if (!audible(id)) continue;

      const snrDb = this.audibleSnrDb.get(id) ?? 0;
      if (snrDb > bestSnrDb) {
        bestSnrDb = snrDb;
        bestId = id;
      }
    }

    return bestId;
  }

  trackAudible(metrics) {
    for (const [id, metric] of metrics) {
      const share = this.audibleShare.get(id) ?? 0;
      const heard = metric.snrDb >= FAILSAFE_SNR_DB ? 1 : 0;
      this.audibleShare.set(id, share + (heard - share) * FAILSAFE_ALPHA);

      const snrDb = this.audibleSnrDb.get(id) ?? 0;
      this.audibleSnrDb.set(id, snrDb + (Math.max(0, metric.snrDb) - snrDb) * FAILSAFE_ALPHA);
    }
  }

  score(metrics) {
    this.trackAudible(metrics);

    const bandCount = [...metrics.values()][0]?.bandVariance.length ?? 0;
    const bandBest = new Array(bandCount).fill(0);

    for (const metric of metrics.values()) {
      for (let b = 0; b < bandCount; b += 1) {
        if (metric.bandVariance[b] > bandBest[b]) bandBest[b] = metric.bandVariance[b];
      }
    }

    for (const [id, metric] of metrics) {
      let proximity = 0;
      let measured = 0;

      for (let b = 0; b < bandCount; b += 1) {
        if (bandBest[b] <= 0) continue;
        proximity += metric.bandVariance[b] / bandBest[b];
        measured += 1;
      }

      proximity = measured > 0 ? proximity / measured : 1;
      const instant = metric.voiceProbability * proximity * metric.recency;

      let track = this.tracks.get(id);
      if (!track) {
        track = { immediate: 0, medium: 0, long: 0 };
        this.tracks.set(id, track);
      }

      track.immediate += (instant - track.immediate) * IMMEDIATE_ALPHA;
      track.medium += (instant - track.medium) * MEDIUM_ALPHA;
      track.long += (instant - track.long) * LONG_ALPHA;
    }
  }

  clearlyBetter(challengerId, incumbentId) {
    const challenger = this.tracks.get(challengerId);
    const incumbent = this.tracks.get(incumbentId);
    if (!challenger || !incumbent) return false;

    return (
      challenger.long > incumbent.long + LONG_MARGIN &&
      challenger.medium > incumbent.medium + MEDIUM_MARGIN &&
      challenger.immediate > incumbent.immediate
    );
  }

  forget(deviceId) {
    this.tracks.delete(deviceId);
    this.audibleShare.delete(deviceId);
    this.audibleSnrDb.delete(deviceId);
    if (this.selectedId === deviceId) this.selectedId = null;
  }
}
