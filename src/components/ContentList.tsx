import type { AdminContentListItem } from '@/types/widget';
import type { WidgetContentType } from '@/types/widget';
import { ListRowThumbnail } from '@/components/ListRowThumbnail';
import { cn } from '@/lib/cn';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';

interface ContentListProps {
  contentType: WidgetContentType;
  onContentTypeChange: (t: WidgetContentType) => void;
  search: string;
  onSearchChange: (q: string) => void;
  items: AdminContentListItem[];
  loading: boolean;
  hasMore: boolean;
  /** false trong lúc tải trang 1 hoặc chưa có mục — tránh sentinel kích hoạt load-more sớm (đóng `listLoading` stale trong closure). */
  infiniteScrollEnabled: boolean;
  onLoadMore: () => void;
  selectedId: string | null;
  onSelect: (item: AdminContentListItem) => void;
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
    <div className="space-y-2 px-3 py-2" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-slate-200 px-3 py-2.5">
          <div className="size-12 shrink-0 rounded-md bg-slate-200" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-[85%] rounded bg-slate-200" />
            <div className="h-3 w-[40%] rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ContentList({
  contentType,
  onContentTypeChange,
  search,
  onSearchChange,
  items,
  loading,
  hasMore,
  infiniteScrollEnabled,
  onLoadMore,
  selectedId,
  onSelect,
}: ContentListProps) {
  const sentinel = useInfiniteScroll(infiniteScrollEnabled, onLoadMore, hasMore);
  const showInitialSkeleton = loading && items.length === 0;
  const showLoadMoreBar = loading && items.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col border-r border-slate-200 bg-slate-50">
      <div className="shrink-0 border-b border-slate-200 p-3">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Loại nội dung</label>
        <select
          value={contentType}
          onChange={(e) => onContentTypeChange(e.target.value as WidgetContentType)}
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm font-medium text-slate-900 outline-none ring-0 focus:border-[#1d9e75] focus:ring-0 focus-visible:border-[#1d9e75] focus-visible:ring-0"
        >
          <option value="article">Bài viết</option>
          <option value="page">Trang nội dung</option>
          <option value="product">Sản phẩm</option>
        </select>
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Tìm theo tiêu đề…"
          className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#1d9e75]"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-scroll overscroll-contain [scrollbar-gutter:stable]">
        {showInitialSkeleton ? <ListSkeletonRows count={8} /> : null}
        {items.map((it) => (
          <button
            key={`${contentType}-${it.id}`}
            type="button"
            onClick={() => onSelect(it)}
            className={cn(
              'flex w-full items-center gap-3 border-b border-slate-200 px-3 py-2.5 text-left transition-colors',
              selectedId === it.id
                ? 'bg-emerald-50 shadow-[inset_4px_0_0_0_#1d9e75]'
                : 'hover:bg-slate-100',
            )}
          >
            <ListRowThumbnail src={it.thumbnail} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-900 line-clamp-2">{it.title}</div>
              {contentType === 'product' ? (
                <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-slate-500">
                  {/* {it.sku ? <span>SKU {it.sku}</span> : null} */}
                  {it.price ? (
                    <span>
                      {it.sku ? '· ' : null}
                      {it.price}
                    </span>
                  ) : null}
                  <StockBadge available={it.available} />
                  <PublishedBadge published={it.published} />
                </div>
              ) : null}
            </div>
          </button>
        ))}
        <div ref={sentinel} className="h-8 shrink-0" />
        {showLoadMoreBar ? (
          <div className="sticky bottom-0 flex items-center justify-center gap-2 border-t border-slate-200 bg-slate-50/95 px-3 py-2 backdrop-blur-sm">
            <span className="inline-block size-4 animate-spin rounded-full border-2 border-[#1d9e75] border-t-transparent" />
            <span className="text-xs font-medium text-slate-600">Đang tải thêm…</span>
          </div>
        ) : null}
        {!loading && items.length === 0 ? (
          <p className="px-3 py-4 text-center text-sm text-slate-500">Không có mục nào.</p>
        ) : null}
      </div>
    </div>
  );
}
