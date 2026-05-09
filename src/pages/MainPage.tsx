import { useCallback, useEffect, useMemo, useState } from 'react';
import { ContentDetail } from '@/components/ContentDetail';
import { ContentList } from '@/components/ContentList';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ProductPicker } from '@/components/ProductPicker';
import { useConfig } from '@/hooks/useConfig';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { AdminContentListItem, ProductSnapshot, WidgetBlockRow, WidgetContentType } from '@/types/widget';
import { buildPositionOptions, countParagraphs } from '@/lib/positionParser';

interface Selected {
  type: WidgetContentType;
  id: string;
  blog_id?: string;
  title: string;
  body_html: string;
}

function emptyBlock(index: number, contentType: WidgetContentType, contentId: string): WidgetBlockRow {
  const now = new Date().toISOString();
  return {
    id: `local-${crypto.randomUUID()}`,
    org_id: '',
    content_type: contentType,
    content_id: contentId,
    block_index: index,
    title: null,
    position: 'end',
    display_type: 'grid',
    grid_desktop_cols: 4,
    grid_mobile_cols: 2,
    slider_desktop_count: 4,
    slider_mobile_count: 1.5,
    product_ids: [],
    products_cache: [],
    created_at: now,
    updated_at: now,
  };
}

function itemToSnapshot(it: AdminContentListItem): ProductSnapshot {
  return {
    id: it.id,
    title: it.title,
    handle: it.handle,
    sku: it.sku ?? null,
    featured_image: it.thumbnail ?? null,
    price: it.price ?? null,
    compare_at_price: null,
    available: it.available ?? true,
    published: it.published ?? true,
  };
}

export function MainPage() {
  const { config } = useConfig();
  const maxBlocks = config?.max_blocks_per_content ?? 5;
  const maxProducts = config?.max_products_per_block ?? 15;

  const [contentType, setContentType] = useState<WidgetContentType>('article');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [items, setItems] = useState<AdminContentListItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [listLoading, setListLoading] = useState(false);

  const [selected, setSelected] = useState<Selected | null>(null);

  const [blocks, setBlocks] = useState<WidgetBlockRow[]>([]);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [productSearch, setProductSearch] = useState('');
  const debouncedProductSearch = useDebouncedValue(productSearch, 300);
  const [products, setProducts] = useState<AdminContentListItem[]>([]);
  const [productPage, setProductPage] = useState(1);
  const [productHasMore, setProductHasMore] = useState(true);
  const [productLoading, setProductLoading] = useState(false);

  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    onOk: () => void;
  } | null>(null);

  const positionOptions = useMemo(
    () => buildPositionOptions(countParagraphs(selected?.body_html ?? '')),
    [selected?.body_html],
  );

  const activeBlock = useMemo(
    () => blocks.find((b) => b.id === activeBlockId) ?? blocks[0] ?? null,
    [blocks, activeBlockId],
  );

  useEffect(() => {
    setPage(1);
    setItems([]);
    setHasMore(true);
  }, [contentType, debouncedSearch]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setListLoading(true);
      try {
        const qs = new URLSearchParams({
          type: contentType,
          page: String(page),
          q: debouncedSearch,
        });
        const r = await fetch(`/api/admin/contents?${qs}`, { credentials: 'include' });
        if (!r.ok) throw new Error('list');
        const j = (await r.json()) as {
          items: AdminContentListItem[];
          has_more: boolean;
        };
        if (cancelled) return;
        setItems((prev) => (page === 1 ? j.items : [...prev, ...j.items]));
        setHasMore(Boolean(j.has_more));
      } catch {
        if (!cancelled) {
          if (page === 1) setItems([]);
          setHasMore(false);
        }
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contentType, debouncedSearch, page]);

  useEffect(() => {
    setProductPage(1);
    setProducts([]);
    setProductHasMore(true);
  }, [debouncedProductSearch]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setProductLoading(true);
      try {
        const qs = new URLSearchParams({ page: String(productPage), q: debouncedProductSearch });
        const r = await fetch(`/api/admin/products?${qs}`, { credentials: 'include' });
        if (!r.ok) throw new Error('products');
        const j = (await r.json()) as { items: AdminContentListItem[]; has_more: boolean };
        if (cancelled) return;
        setProducts((prev) => (productPage === 1 ? j.items : [...prev, ...j.items]));
        setProductHasMore(Boolean(j.has_more));
      } catch {
        if (!cancelled) {
          if (productPage === 1) setProducts([]);
          setProductHasMore(false);
        }
      } finally {
        if (!cancelled) setProductLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedProductSearch, productPage]);

  const loadDetail = useCallback(async (item: AdminContentListItem) => {
    const qs = new URLSearchParams({ type: contentType, id: item.id });
    if (contentType === 'article' && item.blog_id) qs.set('blog_id', item.blog_id);
    const r = await fetch(`/api/admin/content-detail?${qs}`, { credentials: 'include' });
    if (!r.ok) return null;
    return (await r.json()) as { title: string; body_html: string; blog_id?: string } | null;
  }, [contentType]);

  const loadBlocks = useCallback(
    async (sel: Selected) => {
      const r = await fetch(`/api/admin/blocks/${sel.type}/${sel.id}`, { credentials: 'include' });
      if (!r.ok) {
        setBlocks([]);
        return;
      }
      const j = (await r.json()) as { blocks: WidgetBlockRow[] };
      const list = j.blocks ?? [];
      setBlocks(list);
      setActiveBlockId(list[0]?.id ?? null);
    },
    [],
  );

  const onSelectContent = useCallback(
    async (item: AdminContentListItem) => {
      const detail = await loadDetail(item);
      const sel: Selected = {
        type: contentType,
        id: item.id,
        blog_id: item.blog_id,
        title: detail?.title ?? item.title,
        body_html: detail?.body_html ?? '',
      };
      setSelected(sel);
      await loadBlocks(sel);
    },
    [contentType, loadDetail, loadBlocks],
  );

  useEffect(() => {
    if (!selected) return;
    const allowed = new Set(positionOptions.map((o) => o.value));
    setBlocks((prev) =>
      prev.map((b) => (allowed.has(b.position) ? b : { ...b, position: 'end' })),
    );
  }, [positionOptions, selected]);

  const changeBlock = useCallback((id: string, next: WidgetBlockRow) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? next : b)));
  }, []);

  const deleteBlock = useCallback((id: string) => {
    setConfirm({
      title: 'Xóa block',
      message: 'Khi xóa block, tất cả sản phẩm trong block cũng sẽ mất. Bạn có chắc không?',
      onOk: () => {
        setBlocks((prev) => prev.filter((b) => b.id !== id));
        setActiveBlockId((cur) => (cur === id ? null : cur));
        setConfirm(null);
      },
    });
  }, []);

  const addBlock = useCallback(() => {
    if (!selected || blocks.length >= maxBlocks) return;
    const nb = emptyBlock(blocks.length, selected.type, selected.id);
    setBlocks((prev) => [...prev, nb]);
    setActiveBlockId(nb.id);
  }, [selected, blocks.length, maxBlocks]);

  const onSave = useCallback(async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const payload = {
        content_type: selected.type,
        content_id: selected.id,
        blocks: blocks.map((b, i) => ({
          block_index: i,
          title: b.title,
          position: b.position,
          display_type: b.display_type,
          grid_desktop_cols: b.grid_desktop_cols,
          grid_mobile_cols: b.grid_mobile_cols,
          slider_desktop_count: b.slider_desktop_count,
          slider_mobile_count: b.slider_mobile_count,
          product_ids: b.product_ids,
        })),
      };
      const r = await fetch('/api/admin/blocks', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (r.ok) {
        await loadBlocks(selected);
      }
    } finally {
      setSaving(false);
    }
  }, [selected, blocks, loadBlocks]);

  const addProductToActive = useCallback(
    (it: AdminContentListItem) => {
      const bid = activeBlock?.id;
      if (!bid) return;
      setBlocks((prev) =>
        prev.map((b) => {
          if (b.id !== bid) return b;
          if (b.product_ids.includes(it.id) || b.product_ids.length >= maxProducts) return b;
          const snap = itemToSnapshot(it);
          return {
            ...b,
            product_ids: [...b.product_ids, it.id],
            products_cache: [...b.products_cache, snap],
          };
        }),
      );
    },
    [activeBlock?.id, maxProducts],
  );

  const removeProduct = useCallback((blockId: string, productId: string) => {
    setConfirm({
      title: 'Xóa sản phẩm',
      message: 'Xóa sản phẩm này khỏi block?',
      onOk: () => {
        setBlocks((prev) =>
          prev.map((b) =>
            b.id === blockId
              ? {
                  ...b,
                  product_ids: b.product_ids.filter((id) => id !== productId),
                  products_cache: b.products_cache.filter((p) => p.id !== productId),
                }
              : b,
          ),
        );
        setConfirm(null);
      },
    });
  }, []);

  const blockProductIds = useMemo(() => new Set(activeBlock?.product_ids ?? []), [activeBlock]);

  return (
    <div className="grid h-[calc(100vh-57px)] min-h-0 grid-cols-1 gap-0 lg:grid-cols-12">
      <div className="lg:col-span-3">
        <ContentList
          contentType={contentType}
          onContentTypeChange={(t) => {
            setContentType(t);
            setSelected(null);
            setBlocks([]);
            setActiveBlockId(null);
          }}
          search={search}
          onSearchChange={setSearch}
          items={items}
          loading={listLoading}
          hasMore={hasMore}
          onLoadMore={() => {
            if (!listLoading && hasMore) setPage((p) => p + 1);
          }}
          selectedId={selected?.id ?? null}
          onSelect={(it) => void onSelectContent(it)}
        />
      </div>
      <div className="min-h-0 lg:col-span-5">
        {selected ? (
          <ContentDetail
            title={selected.title}
            bodyHtml={selected.body_html}
            blocks={blocks}
            activeBlockId={activeBlockId}
            onActiveBlock={setActiveBlockId}
            positionOptions={positionOptions}
            maxBlocks={maxBlocks}
            maxProducts={maxProducts}
            onChangeBlock={changeBlock}
            onDeleteBlock={deleteBlock}
            onAddBlock={addBlock}
            onRequestRemoveProduct={removeProduct}
            onSave={() => void onSave()}
            saving={saving}
          />
        ) : (
          <div className="flex h-full items-center justify-center border-r border-slate-200 text-sm text-slate-500">
            Chọn một nội dung bên trái.
          </div>
        )}
      </div>
      <div className="min-h-0 lg:col-span-4">
        <ProductPicker
          search={productSearch}
          onSearchChange={setProductSearch}
          items={products}
          loading={productLoading}
          hasMore={productHasMore}
          onLoadMore={() => {
            if (!productLoading && productHasMore) setProductPage((p) => p + 1);
          }}
          onAdd={addProductToActive}
          blockProductIds={blockProductIds}
          blockFull={(activeBlock?.product_ids.length ?? 0) >= maxProducts}
          selectedInBlock={activeBlock?.products_cache ?? []}
          onRequestRemoveFromPicker={(pid) => {
            if (activeBlock) removeProduct(activeBlock.id, pid);
          }}
        />
      </div>

      <ConfirmDialog
        open={confirm != null}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm?.onOk()}
      />
    </div>
  );
}
