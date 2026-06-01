import * as React from "react";

interface Props {
  active: boolean;
  getWaveform: (buffer: Uint8Array) => void;
  className?: string;
}

/** Real-time oscilloscope-style waveform driven by the recorder's analyser. */
export function Waveform({ active, getWaveform, className }: Props) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const raf = React.useRef<number | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const buffer = new Uint8Array(1024);

    const draw = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);
      const css = getComputedStyle(document.documentElement);
      const primary = `hsl(${css.getPropertyValue("--primary").trim()})`;

      if (active) {
        getWaveform(buffer);
        ctx.lineWidth = 2;
        ctx.strokeStyle = primary;
        ctx.beginPath();
        const slice = width / buffer.length;
        for (let i = 0; i < buffer.length; i++) {
          const v = buffer[i] / 128;
          const y = (v * height) / 2;
          const x = i * slice;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      } else {
        // Idle baseline
        ctx.strokeStyle = `hsl(${css.getPropertyValue("--muted-foreground").trim()} / 0.4)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
      }
      raf.current = requestAnimationFrame(draw);
    };

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.scale(dpr, dpr);
      ctx.scale(1 / dpr, 1 / dpr);
    };
    resize();
    raf.current = requestAnimationFrame(draw);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [active, getWaveform]);

  return <canvas ref={canvasRef} className={className} />;
}
