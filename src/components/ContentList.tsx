import type { AdminContentListItem } from '@/types/widget';
import type { WidgetContentType } from '@/types/widget';
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
  onLoadMore: () => void;
  selectedId: string | null;
  onSelect: (item: AdminContentListItem) => void;
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

export function ContentList({
  contentType,
  onContentTypeChange,
  search,
  onSearchChange,
  items,
  loading,
  hasMore,
  onLoadMore,
  selectedId,
  onSelect,
}: ContentListProps) {
  const sentinel = useInfiniteScroll(true, onLoadMore, hasMore);

  return (
    <div className="flex h-full min-h-0 flex-col border-r border-slate-200 bg-slate-50">
      <div className="border-b border-slate-200 p-3">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Loại nội dung</label>
        <select
          value={contentType}
          onChange={(e) => onContentTypeChange(e.target.value as WidgetContentType)}
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm font-medium text-slate-900"
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
      <div className="min-h-0 flex-1 overflow-y-auto">
        {items.map((it) => (
          <button
            key={`${contentType}-${it.id}`}
            type="button"
            onClick={() => onSelect(it)}
            className={cn(
              'flex w-full flex-col gap-1 border-b border-slate-200 px-3 py-2.5 text-left hover:bg-slate-100',
              selectedId === it.id && 'bg-white',
            )}
          >
            <div className="text-sm font-semibold text-slate-900 line-clamp-2">{it.title}</div>
            <div className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
              <span className="font-mono">{it.handle}</span>
              {contentType === 'product' ? (
                <>
                  {it.sku ? <span>· SKU {it.sku}</span> : null}
                  {it.price ? <span>· {it.price}</span> : null}
                  <StockBadge available={it.available} />
                  <PublishedBadge published={it.published} />
                </>
              ) : null}
            </div>
          </button>
        ))}
        <div ref={sentinel} className="h-8" />
        {loading ? <p className="px-3 py-2 text-xs text-slate-500">Đang tải…</p> : null}
        {!loading && items.length === 0 ? (
          <p className="px-3 py-4 text-center text-sm text-slate-500">Không có mục nào.</p>
        ) : null}
      </div>
    </div>
  );
}
