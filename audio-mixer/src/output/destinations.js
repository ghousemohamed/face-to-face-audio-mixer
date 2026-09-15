export class Destinations {
  constructor() {
    this.sinks = new Set();
  }

  get size() {
    return this.sinks.size;
  }

  add(sink) {
    this.sinks.add(sink);
    return () => this.sinks.delete(sink);
  }

  emit(frame) {
    for (const sink of this.sinks) {
      try {
        sink(frame);
      } catch (error) {
        console.error('[core-audio-mixer] audio sink failed', error);
      }
    }
  }
}
