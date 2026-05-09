import { Trash2 } from 'lucide-react';
import type { WidgetBlockRow } from '@/types/widget';
import { cn } from '@/lib/cn';
import type { PositionOption } from '@/lib/positionParser';

interface BlockCardProps {
  block: WidgetBlockRow;
  active: boolean;
  positionOptions: PositionOption[];
  maxProducts: number;
  onChange: (next: WidgetBlockRow) => void;
  onDelete: () => void;
  onFocus: () => void;
  onRequestRemoveProduct: (productId: string) => void;
}

export function BlockCard({
  block,
  active,
  positionOptions,
  maxProducts,
  onChange,
  onDelete,
  onFocus,
  onRequestRemoveProduct,
}: BlockCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border p-3 transition-colors',
        active ? 'border-[#1d9e75] bg-emerald-50/40' : 'border-slate-200 bg-white',
      )}
      onClick={onFocus}
      role="presentation"
    >
      <div className="flex items-start justify-between gap-2">
        <input
          type="text"
          value={block.title ?? ''}
          onChange={(e) => onChange({ ...block, title: e.target.value || null })}
          onClick={(e) => e.stopPropagation()}
          placeholder="Tiêu đề block (tuỳ chọn)"
          className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm font-semibold text-slate-900 outline-none focus:border-[#1d9e75]"
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600"
          aria-label="Xóa block"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vị trí chèn</span>
          <select
            value={block.position}
            onChange={(e) => onChange({ ...block, position: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900"
          >
            {positionOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <div className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dạng hiển thị</span>
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange({ ...block, display_type: 'grid' });
              }}
              className={cn(
                'flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold',
                block.display_type === 'grid'
                  ? 'border-[#1d9e75] bg-[#1d9e75] text-white'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50',
              )}
            >
              Grid
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange({ ...block, display_type: 'slider' });
              }}
              className={cn(
                'flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold',
                block.display_type === 'slider'
                  ? 'border-[#1d9e75] bg-[#1d9e75] text-white'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50',
              )}
            >
              Slider
            </button>
          </div>
        </div>
      </div>

      {block.display_type === 'grid' ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="text-xs text-slate-500">
            Cột desktop
            <select
              value={block.grid_desktop_cols}
              onChange={(e) =>
                onChange({ ...block, grid_desktop_cols: Number(e.target.value) as 3 | 4 | 5 })
              }
              onClick={(e) => e.stopPropagation()}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
            >
              <option value={3}>3</option>
              <option value={4}>4</option>
              <option value={5}>5</option>
            </select>
          </label>
          <label className="text-xs text-slate-500">
            Cột mobile
            <select
              value={block.grid_mobile_cols}
              onChange={(e) =>
                onChange({ ...block, grid_mobile_cols: Number(e.target.value) as 1 | 2 })
              }
              onClick={(e) => e.stopPropagation()}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
            </select>
          </label>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="text-xs text-slate-500">
            Slide desktop
            <input
              type="number"
              step="0.1"
              min="1"
              value={block.slider_desktop_count}
              onChange={(e) => onChange({ ...block, slider_desktop_count: Number(e.target.value) })}
              onClick={(e) => e.stopPropagation()}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
            />
          </label>
          <label className="text-xs text-slate-500">
            Slide mobile
            <input
              type="number"
              step="0.1"
              min="1"
              value={block.slider_mobile_count}
              onChange={(e) => onChange({ ...block, slider_mobile_count: Number(e.target.value) })}
              onClick={(e) => e.stopPropagation()}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
            />
          </label>
        </div>
      )}

      <div className="mt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Sản phẩm trong block ({block.product_ids.length}/{maxProducts})
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {block.products_cache.map((p) => (
            <div
              key={p.id}
              className="group relative h-14 w-14 overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
            >
              {p.featured_image ? (
                <img src={p.featured_image} alt="" className="size-full object-cover" />
              ) : (
                <div className="flex size-full items-center justify-center text-[10px] text-slate-400">No img</div>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRequestRemoveProduct(p.id);
                }}
                className="absolute inset-0 flex items-center justify-center bg-slate-900/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Xóa"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
