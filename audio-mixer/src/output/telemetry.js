const INTERVAL_MS = 100;

export class Telemetry {
  constructor(sampleRate, frameDurationMs) {
    this.sampleRate = sampleRate;
    this.frameDurationMs = frameDurationMs;

    this.listeners = new Set();
    this.lastPublishedMs = -Infinity;
    this.snapshot = this.empty();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  publish({ frame, metrics, selectedId, reason, devices, scoreOf }) {
    const byId = new Map(devices.map((device) => [device.id, device]));
    const previousId = this.snapshot.selection.deviceId;

    this.snapshot = {
      timestamp: frame.timestamp,
      sampleRate: this.sampleRate,
      frameDurationMs: this.frameDurationMs,
      outputPeak: frame.peak,
      selection: { deviceId: selectedId, changed: selectedId !== previousId, reason },
      devices: [...metrics].map(([id, metric]) => ({
        id,
        selected: id === selectedId,
        mixed: reason === 'mix',
        level: metric.level,
        score: reason === 'mix' ? null : scoreOf(id),
        vad: metric.vad?.stats?.() ?? null,
        voiceProbability: metric.voiceProbability,
        envelopeVariance: metric.envelopeVariance,
        isSpeech: metric.isSpeech,
        rmsDb: metric.rmsDb,
        noiseFloorDb: metric.noiseFloorDb,
        snrDb: metric.snrDb,
        starved: byId.get(id)?.starved ?? false,
        bufferedMs: byId.get(id)?.bufferedMs ?? 0,
      })),
    };

    if (this.listeners.size === 0) return;
    if (frame.timestamp - this.lastPublishedMs < INTERVAL_MS) return;

    this.lastPublishedMs = frame.timestamp;

    for (const listener of this.listeners) {
      try {
        listener(this.snapshot);
      } catch (error) {
        console.error('[core-audio-mixer] telemetry listener failed', error);
      }
    }
  }

  empty() {
    return {
      timestamp: 0,
      sampleRate: this.sampleRate,
      frameDurationMs: this.frameDurationMs,
      outputPeak: 0,
      selection: { deviceId: null, changed: false, reason: 'silence' },
      devices: [],
    };
  }
}
