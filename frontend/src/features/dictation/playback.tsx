import * as React from "react";
import { SkipBack, SkipForward, Play, Pause, Rewind, FastForward } from "lucide-react";
import { Button } from "@/components/ui/button";

function fmt(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

interface Props {
  blob: Blob;
  /** Accurate recorded duration in ms, used when the media metadata reports Infinity (common for MediaRecorder webm). */
  fallbackDurationMs?: number;
}

const SKIP = 5; // seconds

export function PlaybackTransport({ blob, fallbackDurationMs }: Props) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = React.useState(false);
  const [current, setCurrent] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const fixingDuration = React.useRef(false);

  const url = React.useMemo(() => URL.createObjectURL(blob), [blob]);
  React.useEffect(() => () => URL.revokeObjectURL(url), [url]);

  const fallback = fallbackDurationMs ? fallbackDurationMs / 1000 : 0;
  const totalDuration = isFinite(duration) && duration > 0 ? duration : fallback;

  const onLoadedMetadata = () => {
    const a = audioRef.current;
    if (!a) return;
    if (!isFinite(a.duration) || a.duration === 0) {
      // Force the browser to compute the real duration for MediaRecorder blobs.
      fixingDuration.current = true;
      a.currentTime = 1e101;
    } else {
      setDuration(a.duration);
    }
  };

  const onTimeUpdate = () => {
    const a = audioRef.current;
    if (!a) return;
    if (fixingDuration.current) {
      fixingDuration.current = false;
      setDuration(isFinite(a.duration) ? a.duration : fallback);
      a.currentTime = 0;
      setCurrent(0);
      return;
    }
    setCurrent(a.currentTime);
  };

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play();
      setPlaying(true);
    } else {
      a.pause();
      setPlaying(false);
    }
  };

  const seekTo = (t: number) => {
    const a = audioRef.current;
    if (!a) return;
    const clamped = Math.max(0, Math.min(totalDuration || a.duration || t, t));
    a.currentTime = clamped;
    setCurrent(clamped);
  };

  const rewind = () => seekTo(current - SKIP);
  const forward = () => seekTo(current + SKIP);
  const toStart = () => seekTo(0);
  const toEnd = () => seekTo(totalDuration);

  return (
    <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onLoadedMetadata={onLoadedMetadata}
        onTimeUpdate={onTimeUpdate}
        onEnded={() => setPlaying(false)}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        className="hidden"
      />

      <div className="flex items-center justify-center gap-1.5">
        <Button variant="outline" size="icon-sm" onClick={toStart} aria-label="Başa sar" title="Başa sar">
          <SkipBack />
        </Button>
        <Button variant="outline" size="icon-sm" onClick={rewind} aria-label="Geri sar" title="5 sn geri">
          <Rewind />
        </Button>
        <Button size="icon" onClick={togglePlay} aria-label={playing ? "Duraklat" : "Oynat"}>
          {playing ? <Pause /> : <Play />}
        </Button>
        <Button variant="outline" size="icon-sm" onClick={forward} aria-label="İleri sar" title="5 sn ileri">
          <FastForward />
        </Button>
        <Button variant="outline" size="icon-sm" onClick={toEnd} aria-label="Sona sar" title="Sona sar">
          <SkipForward />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <span className="w-10 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
          {fmt(current)}
        </span>
        <input
          type="range"
          min={0}
          max={totalDuration || 0}
          step={0.1}
          value={Math.min(current, totalDuration || 0)}
          onChange={(e) => seekTo(Number(e.target.value))}
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-border accent-primary"
          aria-label="Kayıt konumu"
        />
        <span className="w-10 font-mono text-[11px] tabular-nums text-muted-foreground">
          {fmt(totalDuration)}
        </span>
      </div>
    </div>
  );
}
