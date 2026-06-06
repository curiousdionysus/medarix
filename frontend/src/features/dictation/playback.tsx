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
  const [playError, setPlayError] = React.useState<string | null>(null);
  const durationProbe = React.useRef(false);

  const url = React.useMemo(() => URL.createObjectURL(blob), [blob]);
  React.useEffect(() => () => URL.revokeObjectURL(url), [url]);

  const fallback = fallbackDurationMs ? fallbackDurationMs / 1000 : 0;
  const totalDuration = isFinite(duration) && duration > 0 ? duration : fallback;

  React.useEffect(() => {
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
    setPlayError(null);
    durationProbe.current = false;
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.load();
    }
  }, [url]);

  const syncDurationFromElement = React.useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (isFinite(a.duration) && a.duration > 0) {
      setDuration(a.duration);
      durationProbe.current = false;
    }
  }, []);

  const onLoadedMetadata = () => {
    syncDurationFromElement();
    const a = audioRef.current;
    if (!a || durationProbe.current) return;
    if (!isFinite(a.duration) || a.duration === 0) {
      durationProbe.current = true;
      a.currentTime = 1e101;
    }
  };

  const onDurationChange = () => syncDurationFromElement();

  const onTimeUpdate = () => {
    const a = audioRef.current;
    if (!a) return;
    if (durationProbe.current) {
      durationProbe.current = false;
      syncDurationFromElement();
      a.currentTime = 0;
      setCurrent(0);
      return;
    }
    setCurrent(a.currentTime);
  };

  React.useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const a = audioRef.current;
      if (a && !a.paused) setCurrent(a.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const togglePlay = async () => {
    const a = audioRef.current;
    if (!a) return;
    setPlayError(null);
    if (a.paused) {
      try {
        await a.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
        setPlayError(t("playback.playFailed"));
      }
    } else {
      a.pause();
      setPlaying(false);
    }
  };

  const seekTo = (time: number) => {
    const a = audioRef.current;
    if (!a) return;
    const max = totalDuration || (isFinite(a.duration) ? a.duration : 0);
    const clamped = Math.max(0, Math.min(max || time, time));
    a.currentTime = clamped;
    setCurrent(clamped);
  };

  return (
    <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
      <audio
        ref={audioRef}
        src={url}
        preload="auto"
        onLoadedMetadata={onLoadedMetadata}
        onDurationChange={onDurationChange}
        onTimeUpdate={onTimeUpdate}
        onEnded={() => setPlaying(false)}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        className="hidden"
      />

      {playError ? <p className="text-center text-xs text-destructive">{playError}</p> : null}

      <div className="flex items-center justify-center gap-1.5">
        <Button variant="outline" size="icon-sm" onClick={() => seekTo(0)} aria-label={t("playback.seekStart")} title={t("playback.seekStart")}>
          <SkipBack />
        </Button>
        <Button variant="outline" size="icon-sm" onClick={() => seekTo(current - SKIP)} aria-label={t("playback.back5s")} title={t("playback.back5s")}>
          <Rewind />
        </Button>
        <Button size="icon" onClick={() => void togglePlay()} aria-label={playing ? t("playback.pause") : t("playback.play")}>
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
          max={Math.max(totalDuration, 0.001)}
          step={0.05}
          value={Math.min(current, totalDuration || 0)}
          onChange={(e) => seekTo(Number(e.target.value))}
          disabled={!totalDuration}
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-border accent-primary disabled:opacity-50"
          aria-label={t("playback.position")}
        />
        <span className="w-10 font-mono text-[11px] tabular-nums text-muted-foreground">
          {fmt(totalDuration)}
        </span>
      </div>
    </div>
  );
}
