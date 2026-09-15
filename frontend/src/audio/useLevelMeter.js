import { useEffect, useRef } from 'react';

const NOISE_FLOOR = 0.08;
const GAIN = 1.9;
const RELEASE = 0.88;

export function useLevelMeter(levelRef) {
  const elementRef = useRef(null);

  useEffect(() => {
    if (!levelRef) return undefined;

    let frame;
    let smoothed = 0;

    const tick = () => {
      const raw = levelRef.current ?? 0;
      const shaped = Math.max(0, Math.min(1, (Math.sqrt(raw) - NOISE_FLOOR) * GAIN));
      smoothed = shaped > smoothed ? shaped : smoothed * RELEASE + shaped * (1 - RELEASE);
      elementRef.current?.style.setProperty('--level', smoothed.toFixed(3));
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [levelRef]);

  return elementRef;
}
