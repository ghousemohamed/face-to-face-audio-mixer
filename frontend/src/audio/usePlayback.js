import { useCallback, useEffect, useRef, useState } from 'react';

const PROCESSOR_URL = '/pcm-playback.js';

export function usePlayback({ sampleRate, prebufferMs = 100, maxBufferedMs = 1000 }) {
  const [status, setStatus] = useState('idle');
  const [stats, setStats] = useState({ queuedMs: 0, underruns: 0, playing: false });

  const levelRef = useRef(0);
  const nodeRef = useRef(null);
  const contextRef = useRef(null);

  const stop = useCallback(async () => {
    nodeRef.current?.port.postMessage({ type: 'reset' });
    nodeRef.current?.disconnect();
    nodeRef.current = null;

    const context = contextRef.current;
    contextRef.current = null;
    levelRef.current = 0;

    setStatus('idle');
    setStats({ queuedMs: 0, underruns: 0, playing: false });
    await context?.close().catch(() => {});
  }, []);

  const start = useCallback(async () => {
    if (contextRef.current || !sampleRate) return;
    setStatus('starting');

    try {
      const context = new AudioContext({ sampleRate });
      await context.audioWorklet.addModule(PROCESSOR_URL);

      const node = new AudioWorkletNode(context, 'pcm-playback', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        processorOptions: {
          prebufferSamples: Math.round((sampleRate * prebufferMs) / 1000),
          maxSamples: Math.round((sampleRate * maxBufferedMs) / 1000),
        },
      });

      node.port.onmessage = (event) => {
        levelRef.current = event.data.peak;
        setStats({
          queuedMs: event.data.queuedMs,
          underruns: event.data.underruns,
          playing: event.data.playing,
        });
      };

      node.connect(context.destination);
      await context.resume();

      contextRef.current = context;
      nodeRef.current = node;
      setStatus('playing');
    } catch {
      setStatus('error');
    }
  }, [sampleRate, prebufferMs, maxBufferedMs]);

  const push = useCallback((pcm16) => {
    const node = nodeRef.current;
    if (!node) return;
    node.port.postMessage({ pcm16 }, [pcm16.buffer]);
  }, []);

  useEffect(() => () => void stop(), [stop]);

  return { status, stats, levelRef, start, stop, push };
}
