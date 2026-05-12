import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const PRIMARY_FALLBACK = '#e84040';

const PRESETS = [
  ['#e53935', '#fb8c00', '#fdd835', '#8d6e63', '#9ccc65', '#2e7d32', '#5e35b1', '#3949ab'],
  ['#1976d2', '#00acc1', '#aed581', '#000000', '#616161', '#bdbdbd', '#ffffff'],
] as const;

function clamp(n: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, n));
}

function expandHex3(h: string): string {
  const m = h.match(/^#([0-9A-Fa-f]{3})$/i);
  if (!m) return h;
  const g = m[1];
  return `#${g[0]}${g[0]}${g[1]}${g[1]}${g[2]}${g[2]}`.toLowerCase();
}

function parseColorToRgba(s: string): { r: number; g: number; b: number; a: number } {
  const t = s.trim();
  if (!t) return { r: 232, g: 64, b: 64, a: 1 };
  const hex6 = t.match(/^#([0-9A-Fa-f]{6})$/i);
  if (hex6) {
    const n = parseInt(hex6[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const hex3 = t.match(/^#([0-9A-Fa-f]{3})$/i);
  if (hex3) return parseColorToRgba(expandHex3(t));
  const rgb = t.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i,
  );
  if (rgb) {
    return {
      r: clamp(Math.round(Number(rgb[1])), 0, 255),
      g: clamp(Math.round(Number(rgb[2])), 0, 255),
      b: clamp(Math.round(Number(rgb[3])), 0, 255),
      a: rgb[4] != null && rgb[4] !== '' ? clamp(Number(rgb[4]), 0, 1) : 1,
    };
  }
  return { r: 232, g: 64, b: 64, a: 1 };
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const d = max - min;
  let h = 0;
  if (d > 1e-6) {
    if (max === R) h = ((G - B) / d + (G < B ? 6 : 0)) / 6;
    else if (max === G) h = ((B - R) / d + 2) / 6;
    else h = ((R - G) / d + 4) / 6;
  }
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h, s, v };
}

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let R = 0;
  let G = 0;
  let B = 0;
  switch (i % 6) {
    case 0:
      R = v;
      G = t;
      B = p;
      break;
    case 1:
      R = q;
      G = v;
      B = p;
      break;
    case 2:
      R = p;
      G = v;
      B = t;
      break;
    case 3:
      R = p;
      G = q;
      B = v;
      break;
    case 4:
      R = t;
      G = p;
      B = v;
      break;
    default:
      R = v;
      G = p;
      B = q;
      break;
  }
  return { r: Math.round(R * 255), g: Math.round(G * 255), b: Math.round(B * 255) };
}

function rgbaToCss({ r, g, b, a }: { r: number; g: number; b: number; a: number }): string {
  if (a >= 0.999) {
    const h = (n: number) => n.toString(16).padStart(2, '0');
    return `#${h(r)}${h(g)}${h(b)}`.toLowerCase();
  }
  return `rgba(${r},${g},${b},${Math.round(a * 1000) / 1000})`;
}

interface ThemeColorStudioProps {
  value: string;
  onChange: (next: string) => void;
  /** Dùng trong accordion: bỏ card/viền ngoài và tiêu đề trùng với trigger */
  embedded?: boolean;
}

/** Chỉnh màu chủ đạo widget (nút, viền brand, quickview, giá). */
export function ThemeColorStudio({ value, onChange, embedded }: ThemeColorStudioProps) {
  const [h, setH] = useState(0);
  const [s, setS] = useState(0);
  const [v, setV] = useState(1);
  const [a, setA] = useState(1);
  const [hexInput, setHexInput] = useState('');
  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const alphaRef = useRef<HTMLDivElement>(null);
  const draggingSv = useRef(false);
  const hsvaRef = useRef({ h: 0, s: 0, v: 1, a: 1 });
  hsvaRef.current = { h, s, v, a };

  const stored = value ?? '';
  const effective = stored.trim() || PRIMARY_FALLBACK;

  const syncFromString = useCallback((css: string) => {
    const { r, g, b, a: al } = parseColorToRgba(css);
    const { h: hh, s: ss, v: vv } = rgbToHsv(r, g, b);
    setH(hh);
    setS(ss);
    setV(vv);
    setA(al);
    setHexInput(rgbaToCss(parseColorToRgba(css)));
  }, []);

  useEffect(() => {
    const eff = (value ?? '').trim() || PRIMARY_FALLBACK;
    syncFromString(eff);
  }, [value, syncFromString]);

  const hueColor = useMemo(() => {
    const { r, g, b } = hsvToRgb(h, 1, 1);
    return `rgb(${r},${g},${b})`;
  }, [h]);

  const previewCss = useMemo(() => rgbaToCss({ ...hsvToRgb(h, s, v), a }), [h, s, v, a]);

  const commit = useCallback(
    (nextH: number, nextS: number, nextV: number, nextA: number) => {
      const { r, g, b } = hsvToRgb(nextH, nextS, nextV);
      const css = rgbaToCss({ r, g, b, a: nextA });
      setHexInput(css);
      onChange(css);
    },
    [onChange],
  );

  const setFromSv = (clientX: number, clientY: number) => {
    const el = svRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = clamp((clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((clientY - rect.top) / rect.height, 0, 1);
    const ns = x;
    const nv = 1 - y;
    const { h: hh, a: aa } = hsvaRef.current;
    setS(ns);
    setV(nv);
    commit(hh, ns, nv, aa);
  };

  const onSvPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    draggingSv.current = true;
    setFromSv(e.clientX, e.clientY);
  };
  const onSvPointerMove = (e: React.PointerEvent) => {
    if (!draggingSv.current) return;
    setFromSv(e.clientX, e.clientY);
  };
  const onSvPointerUp = () => {
    draggingSv.current = false;
  };

  const setFromHue = (clientX: number) => {
    const el = hueRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const nh = clamp((clientX - rect.left) / rect.width, 0, 1);
    const { s: ss, v: vv, a: aa } = hsvaRef.current;
    setH(nh);
    commit(nh, ss, vv, aa);
  };

  const setFromAlpha = (clientX: number) => {
    const el = alphaRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const na = clamp((clientX - rect.left) / rect.width, 0, 1);
    const { h: hh, s: ss, v: vv } = hsvaRef.current;
    setA(na);
    commit(hh, ss, vv, na);
  };

  const bindHueDrag = (e: React.PointerEvent) => {
    const el = hueRef.current;
    if (!el) return;
    el.setPointerCapture?.(e.pointerId);
    setFromHue(e.clientX);
    const move = (ev: PointerEvent) => setFromHue(ev.clientX);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const bindAlphaDrag = (e: React.PointerEvent) => {
    const el = alphaRef.current;
    if (!el) return;
    el.setPointerCapture?.(e.pointerId);
    setFromAlpha(e.clientX);
    const move = (ev: PointerEvent) => setFromAlpha(ev.clientX);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onHexBlur = () => {
    const t = hexInput.trim();
    if (!t) {
      onChange(PRIMARY_FALLBACK);
      syncFromString(PRIMARY_FALLBACK);
      return;
    }
    const parsed = parseColorToRgba(t);
    const css = rgbaToCss(parsed);
    onChange(css);
    syncFromString(css);
  };

  const onRgbChange = (key: 'r' | 'g' | 'b', val: string) => {
    const n = clamp(Math.round(Number(val) || 0), 0, 255);
    const cur = parseColorToRgba(hexInput || effective);
    const next = { ...cur, [key]: n };
    const css = rgbaToCss(next);
    onChange(css);
    syncFromString(css);
  };

  const onAlphaPercent = (pct: string) => {
    const n = clamp(Math.round(Number(pct) || 0), 0, 100) / 100;
    const { h: hh, s: ss, v: vv } = hsvaRef.current;
    setA(n);
    commit(hh, ss, vv, n);
  };

  return (
    <section
      className={
        embedded
          ? 'space-y-4'
          : 'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm'
      }
    >
      <div className={embedded ? 'space-y-4' : 'space-y-4 p-4 sm:p-5'}>
        {!embedded ? (
          <div>
            <h3 className="text-sm font-bold text-slate-900">Màu chủ đạo</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Màu chính, nút, viền brand, giá và quickview trên storefront.
            </p>
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <span
            className="size-9 shrink-0 rounded-lg border border-slate-200 shadow-inner"
            style={{ background: previewCss }}
            aria-hidden
          />
          <input
            type="text"
            value={hexInput}
            onChange={(e) => setHexInput(e.target.value)}
            onBlur={() => void onHexBlur()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            spellCheck={false}
            className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900 outline-none focus:border-[#1d9e75] focus:ring-1 focus:ring-[#1d9e75]/30"
            placeholder="#e84040 hoặc rgba()"
          />
        </div>

        <div
          ref={svRef}
          role="presentation"
          className="relative aspect-[4/3] max-h-[220px] w-full cursor-crosshair overflow-hidden rounded-xl border border-slate-200 shadow-inner sm:max-h-[260px]"
          style={{
            background: `
                linear-gradient(to top, #000, transparent),
                linear-gradient(to right, #fff, ${hueColor})
              `,
          }}
          onPointerDown={onSvPointerDown}
          onPointerMove={onSvPointerMove}
          onPointerUp={onSvPointerUp}
          onPointerLeave={onSvPointerUp}
        >
          <div
            className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md ring-1 ring-black/20"
            style={{
              left: `${s * 100}%`,
              top: `${(1 - v) * 100}%`,
            }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
          <div className="min-w-0 flex-1 space-y-2">
            <div
              ref={hueRef}
              role="slider"
              aria-valuemin={0}
              aria-valuemax={360}
              aria-valuenow={Math.round(h * 360)}
              className="relative h-3 w-full cursor-pointer rounded-full border border-slate-200 shadow-inner"
              style={{
                background:
                  'linear-gradient(to right,#f00 0%,#ff0 17%,#0f0 33%,#0ff 50%,#00f 67%,#f0f 83%,#f00 100%)',
              }}
              onPointerDown={bindHueDrag}
            >
              <div
                className="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ring-1 ring-black/25"
                style={{ left: `${h * 100}%` }}
              />
            </div>
            <div
              ref={alphaRef}
              role="slider"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(a * 100)}
              className="relative h-3 w-full cursor-pointer rounded-full border border-slate-200 shadow-inner"
              style={{
                background: `linear-gradient(to right, transparent, ${hueColor}), repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50% / 12px 12px`,
              }}
              onPointerDown={bindAlphaDrag}
            >
              <div
                className="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ring-1 ring-black/25"
                style={{ left: `${a * 100}%` }}
              />
            </div>
          </div>
          <div
            className="size-11 shrink-0 rounded-xl border border-slate-200 shadow-md sm:size-12"
            style={{ background: previewCss }}
            aria-hidden
          />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Hex
            <input
              type="text"
              value={hexInput}
              onChange={(e) => setHexInput(e.target.value)}
              onBlur={() => void onHexBlur()}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-sm font-normal normal-case text-slate-900"
            />
          </label>
          {(['r', 'g', 'b'] as const).map((k) => {
            const cur = parseColorToRgba(hexInput || effective);
            return (
              <label key={k} className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {k.toUpperCase()}
                <input
                  type="number"
                  min={0}
                  max={255}
                  value={cur[k]}
                  onChange={(e) => onRgbChange(k, e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-sm font-normal normal-case text-slate-900"
                />
              </label>
            );
          })}
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            A %
            <input
              type="number"
              min={0}
              max={100}
              value={Math.round(a * 100)}
              onChange={(e) => onAlphaPercent(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-sm font-normal normal-case text-slate-900"
            />
          </label>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Màu có sẵn</p>
          <div className="space-y-1.5">
            {PRESETS.map((row, ri) => (
              <div key={ri} className="flex flex-wrap gap-1.5">
                {row.map((c) => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    onClick={() => {
                      onChange(c);
                      syncFromString(c);
                    }}
                    className={`size-7 rounded-md border shadow-sm transition-transform hover:scale-105 ${
                      c.toLowerCase() === '#ffffff' ? 'border-slate-300' : 'border-black/10'
                    }`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => {
              onChange(PRIMARY_FALLBACK);
              syncFromString(PRIMARY_FALLBACK);
            }}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Đặt lại mặc định (#e84040)
          </button>
        </div>
      </div>
    </section>
  );
}
