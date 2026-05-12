import { Check, Plus } from 'lucide-react';
import type { AdminContentListItem, ProductSnapshot } from '@/types/widget';
import { ListRowThumbnail } from '@/components/ListRowThumbnail';
import { SelectedProductsAccordion } from '@/components/SelectedProductsAccordion';
import { cn } from '@/lib/cn';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';

interface ProductPickerProps {
  search: string;
  onSearchChange: (q: string) => void;
  items: AdminContentListItem[];
  loading: boolean;
  hasMore: boolean;
  infiniteScrollEnabled: boolean;
  onLoadMore: () => void;
  onAdd: (p: AdminContentListItem) => void | Promise<void>;
  blockProductIds: Set<string>;
  blockFull: boolean;
  /** Row vừa thêm — hiện check ngắn */
  flashProductId: string | null;
  /** Map productId → list block_index (0-based) chứa SP — render badge "Block N" trong row picker. */
  productBlockMap: Map<string, number[]>;
  /** Ẩn panel “Sản phẩm đã chọn” khi chưa có block nào. */
  showSelectedProducts?: boolean;
  /** Block đang chọn — danh sách SP đã chọn nằm dưới listing. */
  selectedBlockIndex1: number;
  selectedInBlock: ProductSnapshot[];
  maxProductsPerBlock: number;
  onRemoveFromBlock: (productId: string) => void;
  onReorderInBlock: (fromIndex: number, toIndex: number) => void;
  onClearBlockProducts: () => void;
}

function BlockBadge({ blockIndexes }: { blockIndexes: number[] }) {
  if (!blockIndexes.length) return null;
  return (
    <>
      {blockIndexes.map((idx) => (
        <span
          key={idx}
          className="inline-flex items-center rounded border border-violet-200 bg-violet-100 px-1 py-0.5 text-[10px] font-semibold text-violet-700"
        >
          Block {idx + 1}
        </span>
      ))}
    </>
  );
}

function StockBadge({ available }: { available?: boolean }) {
  const ok = available !== false;
  return (
    <span style={{display: 'none'}}
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

function ListSkeletonRows({ count }: { count: number }) {
  return (
    <div className="space-y-0" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-slate-200 px-3 py-2">
          <div className="size-12 shrink-0 rounded-md bg-slate-200" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-[75%] rounded bg-slate-200" />
            <div className="h-3 w-[45%] rounded bg-slate-100" />
          </div>
          <div className="size-9 shrink-0 rounded-lg bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export function ProductPicker({
  search,
  onSearchChange,
  items,
  loading,
  hasMore,
  infiniteScrollEnabled,
  onLoadMore,
  onAdd,
  blockProductIds,
  blockFull,
  flashProductId,
  productBlockMap,
  showSelectedProducts = true,
  selectedBlockIndex1,
  selectedInBlock,
  maxProductsPerBlock,
  onRemoveFromBlock,
  onReorderInBlock,
  onClearBlockProducts,
}: ProductPickerProps) {
  const sentinel = useInfiniteScroll(infiniteScrollEnabled, onLoadMore, hasMore);
  const showInitialSkeleton = loading && items.length === 0;
  const showLoadMoreBar = loading && items.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col border-l border-slate-200 bg-slate-50">
      <div
        className={cn(
          'flex min-h-0 flex-col border-b border-slate-200',
          showSelectedProducts ? 'flex-[1.05]' : 'flex-1',
        )}
      >
        <div className="shrink-0 p-3">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tìm sản phẩm</label>
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Tên sản phẩm"
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#1d9e75]"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-scroll overscroll-contain [scrollbar-gutter:stable]">
          {showInitialSkeleton ? <ListSkeletonRows count={8} /> : null}
          {items.map((it) => {
            const inBlock = blockProductIds.has(it.id);
            const blockIdxs = productBlockMap.get(it.id) ?? [];
            const disabled = inBlock || blockFull;
            const flashed = flashProductId === it.id;
            return (
              <div
                key={it.id}
                className={cn(
                  'flex items-center gap-2 border-b border-slate-200 px-3 py-2 transition-colors duration-300',
                  flashed && 'bg-emerald-50 shadow-[inset_4px_0_0_0_#1d9e75]',
                  !flashed && inBlock && 'bg-slate-100 shadow-[inset_4px_0_0_0_#94a3b8]',
                  !flashed && !inBlock && 'hover:bg-slate-100',
                )}
              >
                <ListRowThumbnail src={it.thumbnail} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900 line-clamp-2">{it.title}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-slate-500">
                    {it.price ? <span>{it.sku ? '· ' : ''}{it.price}</span> : null}
                    <StockBadge available={it.available} />
                    <PublishedBadge published={it.published} />
                    <BlockBadge blockIndexes={blockIdxs} />
                  </div>
                </div>
                <button
                  type="button"
                  disabled={disabled}
                  title={
                    disabled
                      ? inBlock
                        ? 'Đã có trong block'
                        : blockFull
                          ? 'Block đã đủ sản phẩm'
                          : undefined
                      : 'Thêm vào block đang chọn'
                  }
                  onClick={() => onAdd(it)}
                  className={cn(
                    'inline-flex shrink-0 items-center justify-center rounded-lg border p-2 transition-transform active:scale-95',
                    disabled
                      ? 'cursor-not-allowed border-slate-100 text-slate-300'
                      : 'border-[#1d9e75] text-[#1d9e75] hover:bg-emerald-50',
                    flashed && 'border-emerald-600 bg-emerald-100 text-emerald-800',
                  )}
                  aria-label="Thêm"
                >
                  {flashed ? <Check className="size-4" strokeWidth={2.5} /> : <Plus className="size-4" />}
                </button>
              </div>
            );
          })}
          <div ref={sentinel} className="h-8 shrink-0" />
          {showLoadMoreBar ? (
            <div className="sticky bottom-0 flex items-center justify-center gap-2 border-t border-slate-200 bg-slate-50/95 px-3 py-2 backdrop-blur-sm">
              <span className="inline-block size-4 animate-spin rounded-full border-2 border-[#1d9e75] border-t-transparent" />
              <span className="text-xs font-medium text-slate-600">Đang tải thêm…</span>
            </div>
          ) : null}
          {!loading && items.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-slate-500">Không có sản phẩm.</p>
          ) : null}
        </div>
      </div>

      {showSelectedProducts ? (
        <div className="flex min-h-0 flex-[0.633] flex-col bg-white">
          <SelectedProductsAccordion
            blockIndex1={selectedBlockIndex1}
            products={selectedInBlock}
            maxProducts={maxProductsPerBlock}
            onRemove={onRemoveFromBlock}
            onReorder={onReorderInBlock}
            onClearAll={onClearBlockProducts}
          />
        </div>
      ) : null}
    </div>
  );
}
