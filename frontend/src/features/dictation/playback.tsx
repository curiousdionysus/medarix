import * as React from "react";
import { SkipBack, SkipForward, Play, Pause, Rewind, FastForward } from "lucide-react";
import { useT } from "@/features/i18n/locale-context";
import { Button } from "@/components/ui/button";

function fmt(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

interface Props {
  blob: Blob;
  fallbackDurationMs?: number;
}

const SKIP = 5;

export function PlaybackTransport({ blob, fallbackDurationMs }: Props) {
  const t = useT();
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

  const seekTo = (time: number) => {
    const a = audioRef.current;
    if (!a) return;
    const clamped = Math.max(0, Math.min(totalDuration || a.duration || time, time));
    a.currentTime = clamped;
    setCurrent(clamped);
  };

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
        <Button variant="outline" size="icon-sm" onClick={() => seekTo(0)} aria-label={t("playback.seekStart")} title={t("playback.seekStart")}>
          <SkipBack />
        </Button>
        <Button variant="outline" size="icon-sm" onClick={() => seekTo(current - SKIP)} aria-label={t("playback.back5s")} title={t("playback.back5s")}>
          <Rewind />
        </Button>
        <Button size="icon" onClick={togglePlay} aria-label={playing ? t("playback.pause") : t("playback.play")}>
          {playing ? <Pause /> : <Play />}
        </Button>
        <Button variant="outline" size="icon-sm" onClick={() => seekTo(current + SKIP)} aria-label={t("playback.forward")} title={t("playback.forward")}>
          <FastForward />
        </Button>
        <Button variant="outline" size="icon-sm" onClick={() => seekTo(totalDuration)} aria-label={t("playback.toEnd")} title={t("playback.toEnd")}>
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
          aria-label={t("playback.position")}
        />
        <span className="w-10 font-mono text-[11px] tabular-nums text-muted-foreground">
          {fmt(totalDuration)}
        </span>
      </div>
    </div>
  );
}
