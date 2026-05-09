import { Plus } from 'lucide-react';
import type { AdminContentListItem, ProductSnapshot } from '@/types/widget';
import { cn } from '@/lib/cn';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';

interface ProductPickerProps {
  search: string;
  onSearchChange: (q: string) => void;
  items: AdminContentListItem[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onAdd: (p: AdminContentListItem) => void;
  blockProductIds: Set<string>;
  blockFull: boolean;
  selectedInBlock: ProductSnapshot[];
  onRequestRemoveFromPicker: (productId: string) => void;
}

function StockBadge({ available }: { available?: boolean }) {
  const ok = available !== false;
  return (
    <span
      className={cn(
        'rounded px-1.5 py-0.5 text-[10px] font-semibold',
        ok ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800',
      )}
    >
      {ok ? 'Còn hàng' : 'Hết hàng'}
    </span>
  );
}

function PublishedBadge({ published }: { published?: boolean }) {
  const ok = published !== false;
  return (
    <span
      className={cn(
        'rounded px-1.5 py-0.5 text-[10px] font-semibold',
        ok ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600',
      )}
    >
      {ok ? 'Hiển thị' : 'Ẩn'}
    </span>
  );
}

export function ProductPicker({
  search,
  onSearchChange,
  items,
  loading,
  hasMore,
  onLoadMore,
  onAdd,
  blockProductIds,
  blockFull,
  selectedInBlock,
  onRequestRemoveFromPicker,
}: ProductPickerProps) {
  const sentinel = useInfiniteScroll(true, onLoadMore, hasMore);

  return (
    <div className="flex h-full min-h-0 flex-col border-l border-slate-200 bg-slate-50">
      <div className="flex min-h-0 flex-1 flex-col border-b border-slate-200">
        <div className="p-3">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tìm sản phẩm</label>
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Tên / SKU…"
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#1d9e75]"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {items.map((it) => {
            const inBlock = blockProductIds.has(it.id);
            const disabled = inBlock || blockFull;
            return (
              <div
                key={it.id}
                className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 hover:bg-slate-100"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900 line-clamp-2">{it.title}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-slate-500">
                    {it.sku ? <span>SKU {it.sku}</span> : null}
                    {it.price ? <span>· {it.price}</span> : null}
                    <StockBadge available={it.available} />
                    <PublishedBadge published={it.published} />
                  </div>
                </div>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onAdd(it)}
                  className={cn(
                    'inline-flex shrink-0 items-center justify-center rounded-lg border p-2',
                    disabled
                      ? 'cursor-not-allowed border-slate-100 text-slate-300'
                      : 'border-[#1d9e75] text-[#1d9e75] hover:bg-emerald-50',
                  )}
                  aria-label="Thêm"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            );
          })}
          <div ref={sentinel} className="h-8" />
          {loading ? <p className="px-3 py-2 text-xs text-slate-500">Đang tải…</p> : null}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Trong block đang chọn
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-4 gap-2">
            {selectedInBlock.map((p) => (
              <div
                key={p.id}
                className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-white"
              >
                {p.featured_image ? (
                  <img src={p.featured_image} alt="" className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center text-[10px] text-slate-400">—</div>
                )}
                <button
                  type="button"
                  onClick={() => onRequestRemoveFromPicker(p.id)}
                  className="absolute inset-0 flex items-center justify-center bg-slate-900/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Xóa"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            ))}
          </div>
          {selectedInBlock.length === 0 ? (
            <p className="mt-2 text-center text-xs text-slate-500">Chưa chọn sản phẩm.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
