const MAX_CATCH_UP_FRAMES = 8;

export class FrameClock {
  constructor(frameDurationMs, onTick) {
    this.frameDurationMs = frameDurationMs;
    this.onTick = onTick;
    this.timer = null;
    this.nextFrameAt = 0;
  }

  get running() {
    return this.timer !== null;
  }

  start() {
    if (this.running) return;

    this.nextFrameAt = performance.now() + this.frameDurationMs;
    this.timer = setInterval(() => this.drain(), this.frameDurationMs);

    this.timer.unref?.();
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }

  drain() {
    const now = performance.now();
    let emitted = 0;

    while (now >= this.nextFrameAt && emitted < MAX_CATCH_UP_FRAMES) {
      this.onTick();
      this.nextFrameAt += this.frameDurationMs;
      emitted += 1;
    }

    if (now >= this.nextFrameAt) this.nextFrameAt = now + this.frameDurationMs;
  }
}
