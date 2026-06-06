import * as React from "react";

export type RecorderStatus = "idle" | "requesting" | "recording" | "paused" | "stopped" | "error";

export type MicErrorCode = "denied" | "not_found" | "in_use" | "insecure" | "unsupported" | "generic";

export interface RecorderState {
  status: RecorderStatus;
  error: string | null;
  errorCode: MicErrorCode | null;
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
  if (file.type === "video/webm" || file.type === "video/mp4" || file.type === "video/quicktime") {
    return true;
  }
  return AUDIO_EXT.test(file.name);
}

function isPlaceholderDeviceId(id: string | null | undefined): boolean {
  return !id || id.startsWith("mic-");
}

function micErrorCodeFromException(err: unknown): MicErrorCode {
  if (!(err instanceof DOMException)) return "generic";
  switch (err.name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "denied";
    case "NotFoundError":
    case "OverconstrainedError":
      return "not_found";
    case "NotReadableError":
      return "in_use";
    case "SecurityError":
      return "insecure";
    default:
      return "generic";
  }
}

function buildAudioConstraints(deviceId: string | null): MediaTrackConstraints {
  const base: MediaTrackConstraints = { noiseSuppression: true, echoCancellation: true };
  if (!deviceId || isPlaceholderDeviceId(deviceId)) return base;
  return { ...base, deviceId: { ideal: deviceId } };
}

function pickRecorderMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "audio/webm";
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
  const [errorCode, setErrorCode] = React.useState<MicErrorCode | null>(null);
  const [durationMs, setDurationMs] = React.useState(0);
  const [level, setLevel] = React.useState(0);
  const [devices, setDevices] = React.useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = React.useState<string | null>(null);
  const [blob, setBlob] = React.useState<Blob | null>(null);
  const [sourceFilename, setSourceFilename] = React.useState<string | null>(null);

  const mediaRecorder = React.useRef<MediaRecorder | null>(null);
  const recorderMimeType = React.useRef("audio/webm");
  const stream = React.useRef<MediaStream | null>(null);
  const chunks = React.useRef<Blob[]>([]);
  const audioCtx = React.useRef<AudioContext | null>(null);
  const analyser = React.useRef<AnalyserNode | null>(null);
  const raf = React.useRef<number | null>(null);
  const startTs = React.useRef<number>(0);
  const accumulated = React.useRef<number>(0);

  const setMicError = React.useCallback((code: MicErrorCode) => {
    setErrorCode(code);
    setError(code);
  }, []);

  const clearMicError = React.useCallback(() => {
    setErrorCode(null);
    setError(null);
  }, []);

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
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      const inputs = list.filter((d) => d.kind === "audioinput" && d.deviceId);
      setDevices(inputs);
      setDeviceId((current) => {
        if (current && inputs.some((d) => d.deviceId === current)) return current;
        return inputs[0]?.deviceId ?? null;
      });
    } catch {
      /* ignore */
    }
  }, []);

  const acquireStream = React.useCallback(async (preferredId: string | null): Promise<MediaStream> => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new DOMException("getUserMedia not supported", "NotSupportedError");
    }
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: buildAudioConstraints(preferredId),
      });
    } catch (first) {
      if (isPlaceholderDeviceId(preferredId)) throw first;
      return navigator.mediaDevices.getUserMedia({ audio: buildAudioConstraints(null) });
    }
  }, []);

  const ensureMicPermission = React.useCallback(async () => {
    const s = await acquireStream(null);
    s.getTracks().forEach((t) => t.stop());
    await refreshDevices();
  }, [acquireStream, refreshDevices]);

  React.useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) return;
    ensureMicPermission().catch(() => {
      /* Permission may be granted on first record attempt */
    });
  }, [ensureMicPermission]);

  const start = React.useCallback(async () => {
    clearMicError();
    setStatus("requesting");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMicError("unsupported");
        setStatus("error");
        return;
      }

      const preferred = isPlaceholderDeviceId(deviceId) ? null : deviceId;
      const s = await acquireStream(preferred);
      stream.current = s;
      await refreshDevices();

      const ctx = new AudioContext();
      audioCtx.current = ctx;
      const source = ctx.createMediaStreamSource(s);
      const an = ctx.createAnalyser();
      an.fftSize = 1024;
      source.connect(an);
      analyser.current = an;

      const mimeType = pickRecorderMimeType();
      recorderMimeType.current = mimeType;
      const mr = new MediaRecorder(s, { mimeType });
      chunks.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      mr.onstop = () => {
        const recorded = new Blob(chunks.current, { type: recorderMimeType.current });
        setBlob(recorded.size > 0 ? recorded : null);
        if (recorded.size === 0) {
          setMicError("generic");
          setStatus("error");
        } else {
          setStatus("stopped");
        }
        mediaRecorder.current = null;
        cleanupStream();
        setLevel(0);
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
      setMicError(micErrorCodeFromException(err));
    }
  }, [deviceId, refreshDevices, cleanupStream, acquireStream, clearMicError, setMicError]);

  const stop = React.useCallback(() => {
    const mr = mediaRecorder.current;
    if (!mr || mr.state === "inactive") {
      cleanupStream();
      setLevel(0);
      setStatus("stopped");
      return;
    }
    // Finalize blob in onstop before releasing the microphone stream.
    mr.stop();
    setLevel(0);
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
      clearMicError();

      if (!isLikelyAudio(file)) {
        setStatus("error");
        setErrorCode("generic");
        setError("unsupported_file");
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
    [cleanupStream, clearMicError],
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
    clearMicError();
  }, [cleanupStream, clearMicError]);

  const getWaveform = React.useCallback((buffer: Uint8Array) => {
    if (analyser.current) analyser.current.getByteTimeDomainData(buffer as Uint8Array<ArrayBuffer>);
  }, []);

  const setDevice = React.useCallback((id: string) => {
    if (isPlaceholderDeviceId(id)) return;
    setDeviceId(id);
  }, []);

  return {
    status,
    error,
    errorCode,
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
