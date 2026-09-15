import { useCallback, useEffect, useRef, useState } from 'react';

const PROCESSOR_URL = '/pcm-processor.js';

export function useMicCapture({ frameDurationMs = 20, captureConstraints } = {}) {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [muted, setMuted] = useState(false);
  const [format, setFormat] = useState(null);

  const levelRef = useRef(0);
  const frameCountRef = useRef(0);
  const frameSinkRef = useRef(null);
  const audioGraphRef = useRef(null);

  const setFrameSink = useCallback((sink) => {
    frameSinkRef.current = sink;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const graph = { stream: null, context: null, node: null, source: null };
    audioGraphRef.current = graph;

    async function start() {
      setStatus('requesting');

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            autoGainControl: true,
            noiseSuppression: false,
            ...captureConstraints,
          },
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const context = new AudioContext();
        await context.audioWorklet.addModule(PROCESSOR_URL);
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          await context.close();
          return;
        }

        const frameSamples = Math.round((context.sampleRate * frameDurationMs) / 1000);
        const source = context.createMediaStreamSource(stream);
        const node = new AudioWorkletNode(context, 'pcm-capture', {
          numberOfInputs: 1,
          numberOfOutputs: 0,
          channelCount: 1,
          channelCountMode: 'explicit',
          processorOptions: { frameSamples },
        });

        node.port.onmessage = (event) => {
          levelRef.current = event.data.rms;
          frameCountRef.current += 1;
          frameSinkRef.current?.(event.data);
        };

        source.connect(node);

        Object.assign(graph, { stream, context, node, source });
        setFormat({ sampleRate: context.sampleRate, frameSamples, frameDurationMs });
        setStatus('ready');

        if (context.state === 'suspended') {
          const resume = () => context.resume().catch(() => {});
          resume();
          window.addEventListener('pointerdown', resume, { once: true });
          window.addEventListener('keydown', resume, { once: true });
        }
      } catch (err) {
        if (cancelled) return;
        setError(err);
        setStatus(err?.name === 'NotAllowedError' ? 'denied' : 'error');
      }
    }

    start();

    return () => {
      cancelled = true;
      graph.node?.port.close();
      graph.source?.disconnect();
      graph.node?.disconnect();
      graph.stream?.getTracks().forEach((track) => track.stop());
      graph.context?.close().catch(() => {});
      levelRef.current = 0;
    };
  }, [frameDurationMs, captureConstraints]);

  const toggleMute = useCallback(() => {
    setMuted((wasMuted) => {
      const next = !wasMuted;
      audioGraphRef.current?.stream?.getAudioTracks().forEach((track) => {
        track.enabled = !next;
      });
      if (next) levelRef.current = 0;
      return next;
    });
  }, []);

  return { status, error, muted, toggleMute, levelRef, frameCountRef, format, setFrameSink };
}
