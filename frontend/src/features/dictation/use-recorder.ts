import * as React from "react";

export type RecorderStatus = "idle" | "requesting" | "recording" | "paused" | "stopped" | "error";

export interface RecorderState {
  status: RecorderStatus;
  error: string | null;
  durationMs: number;
  level: number; // 0..1 instantaneous amplitude
  devices: MediaDeviceInfo[];
  deviceId: string | null;
  blob: Blob | null;
  /** Set when audio was loaded from an external file (not microphone). */
  sourceFilename: string | null;
}

interface UseRecorderResult extends RecorderState {
  start: () => Promise<void>;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  setDevice: (id: string) => void;
  loadFile: (file: File) => Promise<boolean>;
  /** Provides current time-domain samples for waveform drawing. */
  getWaveform: (buffer: Uint8Array) => void;
}

const AUDIO_EXT = /\.(wav|mp3|m4a|ogg|webm|flac|aac|wma|opus|mp4|mpeg)$/i;

function isLikelyAudio(file: File): boolean {
  if (file.type.startsWith("audio/")) return true;
  if (file.type === "video/webm") return true;
  return AUDIO_EXT.test(file.name);
}

function probeDurationMs(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = "metadata";
    const done = (ms: number) => {
      URL.revokeObjectURL(url);
      resolve(ms);
    };
    audio.onloadedmetadata = () => {
      if (!isFinite(audio.duration) || audio.duration === 0) {
        audio.currentTime = 1e101;
        audio.ontimeupdate = () => {
          audio.ontimeupdate = null;
          done(isFinite(audio.duration) ? audio.duration * 1000 : 0);
        };
        return;
      }
      done(audio.duration * 1000);
    };
    audio.onerror = () => done(0);
    audio.src = url;
  });
}

export function useRecorder(): UseRecorderResult {
  const [status, setStatus] = React.useState<RecorderStatus>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [durationMs, setDurationMs] = React.useState(0);
  const [level, setLevel] = React.useState(0);
  const [devices, setDevices] = React.useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = React.useState<string | null>(null);
  const [blob, setBlob] = React.useState<Blob | null>(null);
  const [sourceFilename, setSourceFilename] = React.useState<string | null>(null);

  const mediaRecorder = React.useRef<MediaRecorder | null>(null);
  const stream = React.useRef<MediaStream | null>(null);
  const chunks = React.useRef<Blob[]>([]);
  const audioCtx = React.useRef<AudioContext | null>(null);
  const analyser = React.useRef<AnalyserNode | null>(null);
  const raf = React.useRef<number | null>(null);
  const startTs = React.useRef<number>(0);
  const accumulated = React.useRef<number>(0);

  const cleanupStream = React.useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (audioCtx.current && audioCtx.current.state !== "closed") {
      audioCtx.current.close().catch(() => {});
    }
    audioCtx.current = null;
    analyser.current = null;
  }, []);

  React.useEffect(() => () => cleanupStream(), [cleanupStream]);

  const tick = React.useCallback(() => {
    if (analyser.current) {
      const buf = new Uint8Array(analyser.current.fftSize);
      analyser.current.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 2.2));
    }
    if (status === "recording") {
      setDurationMs(accumulated.current + (performance.now() - startTs.current));
    }
    raf.current = requestAnimationFrame(tick);
  }, [status]);

  React.useEffect(() => {
    if (status === "recording") {
      raf.current = requestAnimationFrame(tick);
      return () => {
        if (raf.current) cancelAnimationFrame(raf.current);
      };
    }
  }, [status, tick]);

  const refreshDevices = React.useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices(list.filter((d) => d.kind === "audioinput"));
    } catch {
      /* ignore */
    }
  }, []);

  const start = React.useCallback(async () => {
    setError(null);
    setStatus("requesting");
    try {
      const constraints: MediaStreamConstraints = {
        audio: deviceId
          ? { deviceId: { exact: deviceId }, noiseSuppression: true, echoCancellation: true }
          : { noiseSuppression: true, echoCancellation: true },
      };
      const s = await navigator.mediaDevices.getUserMedia(constraints);
      stream.current = s;
      await refreshDevices();

      const ctx = new AudioContext();
      audioCtx.current = ctx;
      const source = ctx.createMediaStreamSource(s);
      const an = ctx.createAnalyser();
      an.fftSize = 1024;
      source.connect(an);
      analyser.current = an;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const mr = new MediaRecorder(s, { mimeType });
      chunks.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      mr.onstop = () => {
        setBlob(new Blob(chunks.current, { type: mimeType }));
      };
      mr.start(250);
      mediaRecorder.current = mr;
      accumulated.current = 0;
      startTs.current = performance.now();
      setDurationMs(0);
      setBlob(null);
      setSourceFilename(null);
      setStatus("recording");
    } catch (err) {
      cleanupStream();
      setStatus("error");
      setError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Mikrofon erişimi reddedildi. Tarayıcı izinlerini kontrol edin."
          : "Mikrofona erişilemedi.",
      );
    }
  }, [deviceId, refreshDevices, cleanupStream]);

  const stop = React.useCallback(() => {
    if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
      mediaRecorder.current.stop();
    }
    cleanupStream();
    setLevel(0);
    setStatus("stopped");
  }, [cleanupStream]);

  const pause = React.useCallback(() => {
    if (mediaRecorder.current?.state === "recording") {
      mediaRecorder.current.pause();
      accumulated.current += performance.now() - startTs.current;
      setStatus("paused");
    }
  }, []);

  const resume = React.useCallback(() => {
    if (mediaRecorder.current?.state === "paused") {
      mediaRecorder.current.resume();
      startTs.current = performance.now();
      setStatus("recording");
    }
  }, []);

  const loadFile = React.useCallback(
    async (file: File): Promise<boolean> => {
      cleanupStream();
      mediaRecorder.current = null;
      chunks.current = [];
      setError(null);

      if (!isLikelyAudio(file)) {
        setStatus("error");
        setError("Desteklenmeyen dosya. MP3, WAV, M4A, OGG veya WebM seçin.");
        return false;
      }

      const durationMs = await probeDurationMs(file);
      setBlob(file);
      setSourceFilename(file.name);
      setDurationMs(durationMs);
      setLevel(0);
      setStatus("stopped");
      return true;
    },
    [cleanupStream],
  );

  const reset = React.useCallback(() => {
    cleanupStream();
    mediaRecorder.current = null;
    chunks.current = [];
    setBlob(null);
    setSourceFilename(null);
    setDurationMs(0);
    setLevel(0);
    setStatus("idle");
    setError(null);
  }, [cleanupStream]);

  const getWaveform = React.useCallback((buffer: Uint8Array) => {
    if (analyser.current) analyser.current.getByteTimeDomainData(buffer as Uint8Array<ArrayBuffer>);
  }, []);

  const setDevice = React.useCallback((id: string) => setDeviceId(id), []);

  React.useEffect(() => {
    refreshDevices();
  }, [refreshDevices]);

  return {
    status,
    error,
    durationMs,
    level,
    devices,
    deviceId,
    blob,
    sourceFilename,
    start,
    stop,
    pause,
    resume,
    reset,
    setDevice,
    loadFile,
    getWaveform,
  };
}
