import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { WidgetBlockRow } from '@/types/widget';
import { cn } from '@/lib/cn';
import type { PositionOption } from '@/lib/positionParser';

const GAP_PRESETS: Array<{ label: string; px: number }> = [
  { label: 'Nhỏ (8px)', px: 8 },
  { label: 'Vừa (12px)', px: 12 },
  { label: 'Trung bình (16px)', px: 16 },
  { label: 'Lớn (24px)', px: 24 },
];

function clampGapPx(n: number): number {
  if (!Number.isFinite(n)) return 12;
  return Math.min(48, Math.max(8, Math.round(n)));
}

const fieldLabel = 'mb-0 block text-xs font-medium text-slate-600';

interface BlockConfigAccordionProps {
  block: WidgetBlockRow;
  /** STT block (1-based) — hiển thị trên tiêu đề panel. */
  blockOrdinal: number;
  positionOptions: PositionOption[];
  onChange: (next: WidgetBlockRow) => void;
  defaultOpen?: boolean;
}

export function BlockConfigAccordion({
  block,
  blockOrdinal,
  positionOptions,
  onChange,
  defaultOpen = true,
}: BlockConfigAccordionProps) {
  const panelId = useId();
  const [open, setOpen] = useState(defaultOpen);

  const presetValue = GAP_PRESETS.some((p) => p.px === block.grid_gap_px)
    ? String(block.grid_gap_px)
    : 'custom';

  const setGapPx = (raw: number) => {
    onChange({ ...block, grid_gap_px: clampGapPx(raw) });
  };

  return (
    <div id="block-config-panel" className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white font-sans">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5 text-left"
        aria-expanded={open}
        aria-controls={panelId}
      >
        <span className="text-sm font-semibold tracking-normal text-slate-800">
          Cấu hình block {blockOrdinal}
        </span>
        <ChevronDown className={cn('size-4 shrink-0 text-slate-500 transition-transform', open && 'rotate-180')} />
      </button>
      {open ? (
        <div id={panelId} className="min-h-0 space-y-4 overflow-y-auto p-3 [scrollbar-gutter:stable]">
          {/* Hàng 1: vị trí | kiểu | cột desktop | cột mobile (hoặc slide khi slider) */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="min-w-0">
              <span className={fieldLabel}>Vị trí chèn</span>
              <select
                value={block.position}
                onChange={(e) => onChange({ ...block, position: e.target.value })}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900 outline-none focus:border-[#1d9e75]"
              >
                {positionOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="min-w-0">
              <span className={fieldLabel}>Kiểu hiển thị</span>
              <div className="mt-1.5 flex gap-2">
                <button
                  type="button"
                  onClick={() => onChange({ ...block, display_type: 'grid' })}
                  className={cn(
                    'min-h-[2.5rem] flex-1 rounded-lg border px-2 py-2 text-xs font-semibold',
                    block.display_type === 'grid'
                      ? 'border-[#1d9e75] bg-emerald-50 text-[#1d9e75]'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                  )}
                >
                  Grid
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ ...block, display_type: 'slider' })}
                  className={cn(
                    'min-h-[2.5rem] flex-1 rounded-lg border px-2 py-2 text-xs font-semibold',
                    block.display_type === 'slider'
                      ? 'border-[#1d9e75] bg-emerald-50 text-[#1d9e75]'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                  )}
                >
                  Slider
                </button>
              </div>
            </div>

            {block.display_type === 'grid' ? (
              <>
                <div className="min-w-0">
                  <span className={fieldLabel}>Cột desktop</span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {([2, 3, 4, 5] as const).map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => onChange({ ...block, grid_desktop_cols: n })}
                        className={cn(
                          'min-h-[2.5rem] min-w-[2.25rem] rounded-lg border px-2.5 text-xs font-semibold',
                          block.grid_desktop_cols === n
                            ? 'border-[#1d9e75] bg-emerald-50 text-[#1d9e75]'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50',
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="min-w-0">
                  <span className={fieldLabel}>Cột mobile</span>
                  <div className="mt-1.5 flex gap-1.5">
                    {([1, 2] as const).map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => onChange({ ...block, grid_mobile_cols: n })}
                        className={cn(
                          'min-h-[2.5rem] min-w-[2.25rem] rounded-lg border px-2.5 text-xs font-semibold',
                          block.grid_mobile_cols === n
                            ? 'border-[#1d9e75] bg-emerald-50 text-[#1d9e75]'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50',
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                <label className="min-w-0 text-xs text-slate-600">
                  <span className={fieldLabel}>Slide desktop</span>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    value={block.slider_desktop_count}
                    onChange={(e) => onChange({ ...block, slider_desktop_count: Number(e.target.value) })}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                  />
                </label>
                <label className="min-w-0 text-xs text-slate-600">
                  <span className={fieldLabel}>Slide mobile</span>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    value={block.slider_mobile_count}
                    onChange={(e) => onChange({ ...block, slider_mobile_count: Number(e.target.value) })}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                  />
                </label>
              </>
            )}
          </div>

          {/* Hàng 2: khoảng cách | px + slider */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <label className="min-w-0">
              <span className={fieldLabel}>Khoảng cách</span>
              <select
                value={presetValue}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === 'custom') return;
                  onChange({ ...block, grid_gap_px: Number(v) });
                }}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm outline-none focus:border-[#1d9e75]"
              >
                {GAP_PRESETS.map((p) => (
                  <option key={p.px} value={String(p.px)}>
                    {p.label}
                  </option>
                ))}
                <option value="custom">Tùy chỉnh ({block.grid_gap_px}px)</option>
              </select>
            </label>

            <div className="min-w-0">
              <span className={fieldLabel}>Khoảng cách giữa các sản phẩm</span>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  type="number"
                  min={8}
                  max={48}
                  step={1}
                  value={block.grid_gap_px}
                  onChange={(e) => setGapPx(Number(e.target.value))}
                  className="w-[4.25rem] shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-2 text-center text-sm font-medium text-slate-800 outline-none focus:border-[#1d9e75]"
                  aria-label="Khoảng cách (px)"
                />
                <span className="shrink-0 text-xs text-slate-500">px</span>
                <input
                  type="range"
                  min={8}
                  max={48}
                  step={1}
                  value={block.grid_gap_px}
                  onChange={(e) => setGapPx(Number(e.target.value))}
                  className="h-2 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 accent-[#1d9e75]"
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
