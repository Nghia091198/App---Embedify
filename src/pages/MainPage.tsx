import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ContentDetail } from '@/components/ContentDetail';
import { ContentList } from '@/components/ContentList';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ProductPicker } from '@/components/ProductPicker';
import { Toast, type ToastVariant } from '@/components/Toast';
import { useConfig } from '@/hooks/useConfig';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { AdminContentListItem, ProductSnapshot, WidgetBlockRow, WidgetContentType } from '@/types/widget';
import {
  findFirstUnsavedExistingBlockStt,
  hasUnsavedChangesOnExistingBlocks,
  serializeBlocksSignature,
} from '@/lib/blockPersistSignature';
import { buildHaravanAdminEditUrl } from '@/lib/haravanAdminLinks';
import { buildPositionOptions, countParagraphs } from '@/lib/positionParser';

interface Selected {
  type: WidgetContentType;
  id: string;
  blog_id?: string;
  blog_handle?: string;
  handle: string;
  title: string;
  body_html: string;
}

function buildStorefrontLiveUrl(
  storefrontBase: string | undefined,
  type: WidgetContentType,
  handle: string,
  blogHandle?: string,
): string | null {
  const base = storefrontBase?.trim().replace(/\/$/, '');
  if (!base || !handle) return null;
  const h = encodeURIComponent(handle);
  if (type === 'page') return `${base}/pages/${h}`;
  if (type === 'article') {
    if (!blogHandle) return null;
    return `${base}/blogs/${encodeURIComponent(blogHandle)}/${h}`;
  }
  if (type === 'product') return `${base}/products/${h}`;
  return null;
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
    grid_gap_px: 12,
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
    url: it.handle ? `/products/${it.handle}` : '',
    description: '',
    body_html: null,
    vendor: null,
    type: null,
    tags: [],
    options: [],
    price: null,
    price_min: null,
    price_max: null,
    price_varies: false,
    compare_at_price: null,
    compare_at_price_min: null,
    compare_at_price_max: null,
    compare_at_price_varies: false,
    formatted_price: it.price ?? null,
    formatted_compare_at_price: null,
    available: it.available ?? true,
    published: it.published ?? true,
    published_at: null,
    created_at: null,
    updated_at: null,
    featured_image: it.thumbnail ?? null,
    images: [],
    variants: [],
    sku: it.sku ?? null,
  };
}

async function fetchProductSnapshotFromApi(productId: string): Promise<ProductSnapshot | null> {
  try {
    const r = await fetch('/api/admin/product-snapshots', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [productId] }),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { snapshots?: ProductSnapshot[] };
    return j.snapshots?.[0] ?? null;
  } catch {
    return null;
  }
}

interface MainPageProps {
  shopDomain: string | null;
}

export function MainPage({ shopDomain }: MainPageProps) {
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
  const [persistedSig, setPersistedSig] = useState('');
  const [addBlockGate, setAddBlockGate] = useState<{ stt: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const storefrontBase = shopDomain
    ? `https://${shopDomain.replace(/^https?:\/\//i, '').replace(/\/$/, '')}`
    : undefined;

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

  const [toast, setToast] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<ToastVariant>('info');
  const [pickerFlashProductId, setPickerFlashProductId] = useState<string | null>(null);
  const dismissToast = useCallback(() => {
    setToast(null);
    setToastVariant('info');
  }, []);
  const showToast = useCallback((msg: string, variant: ToastVariant = 'info') => {
    setToast(msg);
    setToastVariant(variant);
  }, []);

  const positionOptions = useMemo(
    () => buildPositionOptions(countParagraphs(selected?.body_html ?? '')),
    [selected?.body_html],
  );

  const blocksDirty = useMemo(
    () => serializeBlocksSignature(blocks) !== persistedSig,
    [blocks, persistedSig],
  );

  const activeBlock = useMemo(
    () => blocks.find((b) => b.id === activeBlockId) ?? blocks[0] ?? null,
    [blocks, activeBlockId],
  );

  /** Layout: reset page/items trước passive effects của con (IntersectionObserver), tránh fetch sai `page` và sentinel kích hoạt load-more khi `page` còn stale. */
  useLayoutEffect(() => {
    setPage(1);
    setItems([]);
    setHasMore(true);
  }, [contentType, debouncedSearch]);

  const contentListScrollEnabled = items.length > 0 && !listLoading;
  const productPickerScrollEnabled = products.length > 0 && !productLoading;

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

  useLayoutEffect(() => {
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
    return (await r.json()) as {
      title: string;
      body_html: string;
      blog_id?: string;
      blog_handle?: string;
      handle?: string;
    } | null;
  }, [contentType]);

  const loadBlocks = useCallback(async (sel: Selected) => {
    const r = await fetch(`/api/admin/blocks/${sel.type}/${sel.id}`, { credentials: 'include' });
    const setEmpty = () => {
      setBlocks([]);
      setActiveBlockId(null);
      setPersistedSig(serializeBlocksSignature([]));
    };
    if (!r.ok) {
      setEmpty();
      return;
    }
    const j = (await r.json()) as { blocks: WidgetBlockRow[] };
    const list = j.blocks ?? [];
    if (list.length === 0) {
      setEmpty();
    } else {
      setBlocks(list);
      setActiveBlockId(list[0]?.id ?? null);
      setPersistedSig(serializeBlocksSignature(list));
    }
  }, []);

  const onSelectContent = useCallback(
    async (item: AdminContentListItem) => {
      setAddBlockGate(null);
      setBlocks([]);
      setPersistedSig(serializeBlocksSignature([]));
      const detail = await loadDetail(item);
      const sel: Selected = {
        type: contentType,
        id: item.id,
        blog_id: item.blog_id ?? detail?.blog_id,
        blog_handle: detail?.blog_handle ?? item.blog_handle,
        handle: detail?.handle ?? item.handle,
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

  const tryAddBlock = useCallback(() => {
    if (!selected || blocks.length >= maxBlocks) return;
    if (hasUnsavedChangesOnExistingBlocks(blocks, persistedSig)) {
      setAddBlockGate({ stt: findFirstUnsavedExistingBlockStt(blocks, persistedSig) });
      return;
    }
    const nb = emptyBlock(blocks.length, selected.type, selected.id);
    setBlocks((prev) => [...prev, nb]);
    setActiveBlockId(nb.id);
  }, [selected, blocks, maxBlocks, persistedSig]);

  const onReviewUnsavedBeforeAdd = useCallback(() => {
    if (!addBlockGate) return;
    const idx = addBlockGate.stt - 1;
    const bid = blocks[idx]?.id;
    if (!bid) return;
    setActiveBlockId(bid);
    window.requestAnimationFrame(() => {
      document.getElementById('block-config-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }, [addBlockGate, blocks]);

  const saveBlocks = useCallback(
    async (opts?: { thenAddBlock?: boolean; blocksOverride?: WidgetBlockRow[]; silent?: boolean }) => {
      if (!selected) return;
      const blocksToSave = opts?.blocksOverride ?? blocks;
      setSaving(true);
      try {
        const payload = {
          content_type: selected.type,
          content_id: selected.id,
          blog_id: selected.type === 'article' ? selected.blog_id : undefined,
          blocks: blocksToSave.map((b, i) => ({
            block_index: i,
            title: b.title,
            position: b.position,
            display_type: b.display_type,
            grid_desktop_cols: b.grid_desktop_cols,
            grid_mobile_cols: b.grid_mobile_cols,
            grid_gap_px: b.grid_gap_px,
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
          const j = (await r.json()) as {
            blocks?: WidgetBlockRow[];
            haravan_touched?: boolean;
            haravan_touch_error?: string;
            haravan_embed?: {
              iframe_in_body: boolean;
              app_origin_source: 'env' | 'request' | 'none';
              app_origin_used: string;
            };
          };
          let list = j.blocks ?? [];

          /** API/DB đôi khi trả `products_cache` rỗng dù còn `product_ids` → preview “mất” sản phẩm. */
          const idsToRefetch = [
            ...new Set(
              list.flatMap((b) =>
                (b.products_cache?.length ?? 0) > 0 || !b.product_ids?.length ? [] : b.product_ids.map(String),
              ),
            ),
          ].filter(Boolean);
          if (idsToRefetch.length > 0) {
            try {
              const snapR = await fetch('/api/admin/product-snapshots', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: idsToRefetch }),
              });
              if (snapR.ok) {
                const snapJ = (await snapR.json()) as { snapshots?: ProductSnapshot[] };
                const byId = new Map((snapJ.snapshots ?? []).map((s) => [String(s.id), s]));
                list = list.map((b) => {
                  if ((b.products_cache?.length ?? 0) > 0 || !b.product_ids?.length) return b;
                  const caches = b.product_ids
                    .map((id) => byId.get(String(id)))
                    .filter((x): x is ProductSnapshot => Boolean(x));
                  return caches.length > 0 ? { ...b, products_cache: caches } : b;
                });
              }
            } catch {
              /* ignore */
            }
          }

          /** Body Haravan đã chèn iframe — refetch để strip/inject preview khớp, tránh block “trôi” / mất chrome. */
          try {
            const detail = await loadDetail({
              id: selected.id,
              title: selected.title,
              handle: selected.handle,
              blog_id: selected.blog_id,
              blog_handle: selected.blog_handle,
            });
            if (detail) {
              setSelected((s) =>
                s && s.id === selected.id
                  ? { ...s, body_html: detail.body_html, title: detail.title, handle: detail.handle ?? s.handle }
                  : s,
              );
            }
          } catch {
            /* ignore */
          }

          setPersistedSig(serializeBlocksSignature(list));
          setAddBlockGate(null);
          if (!opts?.silent) {
            if (j.haravan_touched) {
              const emb = j.haravan_embed;
              if (list.length > 0 && emb && !emb.iframe_in_body) {
                showToast(
                  'Đã lưu HTML tĩnh lên Haravan nhưng không chèn iframe (thiếu APP_ORIGIN / Host). Slider trong frame cần URL app public.',
                  'warning',
                );
              } else if (emb?.iframe_in_body && emb.app_origin_source === 'request') {
                showToast(
                  'Đã lưu widget + iframe lên Haravan (origin lấy từ request — nên set APP_ORIGIN production cho ổn định).',
                  'success',
                );
              } else {
                showToast('Đã lưu widget và cập nhật body HTML (iframe widget-frame) lên Haravan.', 'success');
              }
            } else if (j.haravan_touch_error) {
              showToast(`Đã lưu widget. Haravan: ${j.haravan_touch_error}`, 'warning');
            } else {
              showToast('Đã lưu widget.', 'success');
            }
          }
          if (opts?.thenAddBlock) {
            const nb = emptyBlock(list.length, selected.type, selected.id);
            setBlocks([...list, nb]);
            setActiveBlockId(nb.id);
          } else {
            setBlocks(list);
            setActiveBlockId(list[0]?.id ?? null);
          }
        } else {
          showToast('Lưu thất bại.', 'error');
        }
      } finally {
        setSaving(false);
      }
    },
    [selected, blocks, showToast, loadDetail],
  );

  const deleteBlock = useCallback(
    (id: string) => {
      setConfirm({
        title: 'Xóa block',
        message: 'Khi xóa block, tất cả sản phẩm trong block cũng sẽ mất. Bạn có chắc không?',
        onOk: () => {
          setConfirm(null);
          if (!selected) return;
          const remaining = blocks.filter((b) => b.id !== id);
          setBlocks(remaining);
          setActiveBlockId((cur) => {
            if (cur !== id) return cur;
            return remaining[0]?.id ?? null;
          });
          void saveBlocks({ blocksOverride: remaining });
        },
      });
    },
    [selected, blocks, saveBlocks],
  );

  const addProductToActive = useCallback(
    async (it: AdminContentListItem) => {
      if (!selected) {
        showToast('Chọn một nội dung ở cột trái trước.', 'warning');
        return;
      }
      let targetBlockId: string | null = null;
      if (blocks.length > 0) {
        const bid = activeBlock?.id;
        if (!bid) {
          showToast('Chọn block (dropdown Block 1 / 2… hoặc nhấn vào block trong xem trước).', 'warning');
          return;
        }
        if ((activeBlock?.product_ids.length ?? 0) >= maxProducts) {
          showToast('Block đã đủ số sản phẩm tối đa.', 'warning');
          return;
        }
        if (activeBlock?.product_ids.includes(it.id)) {
          showToast('Sản phẩm đã có trong block.', 'warning');
          return;
        }
        targetBlockId = bid;
      }

      const snapFull = await fetchProductSnapshotFromApi(it.id);
      const snap = snapFull ?? itemToSnapshot(it);

      if (blocks.length === 0) {
        const nb: WidgetBlockRow = {
          ...emptyBlock(0, selected.type, selected.id),
          product_ids: [it.id],
          products_cache: [snap],
        };
        setBlocks([nb]);
        setActiveBlockId(nb.id);
        setPickerFlashProductId(it.id);
        window.setTimeout(() => setPickerFlashProductId(null), 900);
        return;
      }
      if (!targetBlockId) return;
      const bid = targetBlockId;
      let added = false;
      setBlocks((prev) =>
        prev.map((b) => {
          if (b.id !== bid) return b;
          if (b.product_ids.includes(it.id) || b.product_ids.length >= maxProducts) return b;
          added = true;
          return {
            ...b,
            product_ids: [...b.product_ids, it.id],
            products_cache: [...b.products_cache, snap],
          };
        }),
      );
      if (added) {
        setPickerFlashProductId(it.id);
        window.setTimeout(() => setPickerFlashProductId(null), 900);
      }
    },
    [selected, blocks, activeBlock, maxProducts, showToast],
  );

  const removeProductFromBlock = useCallback((blockId: string, productId: string) => {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id !== blockId
          ? b
          : {
              ...b,
              product_ids: b.product_ids.filter((id) => id !== productId),
              products_cache: b.products_cache.filter((p) => p.id !== productId),
            },
      ),
    );
  }, []);

  const reorderProductsInBlock = useCallback((blockId: string, from: number, to: number) => {
    if (from === to) return;
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;
        const ids = [...b.product_ids];
        const caches = [...b.products_cache];
        const [pid] = ids.splice(from, 1);
        ids.splice(to, 0, pid);
        const [snap] = caches.splice(from, 1);
        caches.splice(to, 0, snap);
        return { ...b, product_ids: ids, products_cache: caches };
      }),
    );
  }, []);

  const clearBlockProducts = useCallback((blockId: string) => {
    setConfirm({
      title: 'Xóa tất cả sản phẩm',
      message: 'Xóa toàn bộ sản phẩm khỏi block này?',
      onOk: () => {
        setBlocks((prev) =>
          prev.map((b) => (b.id === blockId ? { ...b, product_ids: [], products_cache: [] } : b)),
        );
        setConfirm(null);
      },
    });
  }, []);

  const blockProductIds = useMemo(() => new Set(activeBlock?.product_ids ?? []), [activeBlock]);

  /** Map productId → list block_index chứa SP — dùng để render badge "Block N" trong picker. */
  const productBlockMap = useMemo<Map<string, number[]>>(() => {
    const map = new Map<string, number[]>();
    blocks.forEach((b, i) => {
      const bi = b.block_index ?? i;
      b.product_ids.forEach((pid) => {
        const cur = map.get(pid);
        if (cur) cur.push(bi);
        else map.set(pid, [bi]);
      });
    });
    return map;
  }, [blocks]);

  const contentPreviewFlags = useMemo(
    () => ({
      enable_add_to_cart: config?.enable_add_to_cart ?? true,
      enable_quick_view: config?.enable_quick_view ?? false,
      show_price: config?.show_price ?? true,
      enable_contact: config?.enable_contact ?? false,
      contact_label: config?.contact_label ?? 'Liên hệ',
      contact_url: config?.contact_url ?? '',
      product_link_base: storefrontBase ?? null,
    }),
    [
      config?.enable_add_to_cart,
      config?.enable_quick_view,
      config?.show_price,
      config?.enable_contact,
      config?.contact_label,
      config?.contact_url,
      storefrontBase,
    ],
  );

  const liveStorefrontUrl = useMemo(
    () =>
      selected
        ? buildStorefrontLiveUrl(storefrontBase, selected.type, selected.handle, selected.blog_handle)
        : null,
    [selected, storefrontBase],
  );

  const haravanAdminEditUrl = useMemo(
    () =>
      selected
        ? buildHaravanAdminEditUrl(shopDomain, selected.type, selected.id, selected.blog_id)
        : null,
    [shopDomain, selected],
  );

  const activeBlockIndex = useMemo(() => {
    if (!activeBlock) return 0;
    return Math.max(0, blocks.findIndex((b) => b.id === activeBlock.id));
  }, [blocks, activeBlock]);

  return (
    <div className="grid h-[calc(100vh-57px)] min-h-0 grid-cols-1 gap-0 lg:grid-cols-12">
      <div className="flex h-full min-h-0 flex-col overflow-hidden lg:col-span-3">
        <ContentList
          contentType={contentType}
          onContentTypeChange={(t) => {
            setContentType(t);
            setPage(1);
            setSelected(null);
            setBlocks([]);
            setActiveBlockId(null);
          }}
          search={search}
          onSearchChange={setSearch}
          items={items}
          loading={listLoading}
          hasMore={hasMore}
          infiniteScrollEnabled={contentListScrollEnabled}
          onLoadMore={() => {
            if (!listLoading && hasMore) setPage((p) => p + 1);
          }}
          selectedId={selected?.id ?? null}
          onSelect={(it) => void onSelectContent(it)}
        />
      </div>
      <div className="flex h-full min-h-0 flex-col overflow-hidden lg:col-span-5">
        {selected ? (
          <ContentDetail
            title={selected.title}
            bodyHtml={selected.body_html}
            blocks={blocks}
            previewFlags={contentPreviewFlags}
            activeBlockId={activeBlockId}
            onActiveBlock={setActiveBlockId}
            positionOptions={positionOptions}
            maxBlocks={maxBlocks}
            onChangeBlock={changeBlock}
            onDeleteBlock={deleteBlock}
            onAddBlock={tryAddBlock}
            onSave={() => void saveBlocks()}
            saving={saving}
            canSave={blocksDirty}
            addBlockGate={addBlockGate}
            onSaveUnsavedBeforeAdd={() => void saveBlocks({ thenAddBlock: true })}
            onReviewUnsavedBeforeAdd={onReviewUnsavedBeforeAdd}
            liveStorefrontUrl={liveStorefrontUrl}
            haravanAdminEditUrl={haravanAdminEditUrl}
            previewAppearance={
              config
                ? {
                    primaryColor: config.primary_color?.trim() || '#e84040',
                    fontFamily: config.font_family?.trim() || undefined,
                  }
                : null
            }
          />
        ) : (
          <div className="flex h-full items-center justify-center border-r border-slate-200 text-sm text-slate-500">
            Chọn một nội dung bên trái.
          </div>
        )}
      </div>
      <div className="flex h-full min-h-0 flex-col overflow-hidden lg:col-span-4">
        <ProductPicker
          search={productSearch}
          onSearchChange={setProductSearch}
          items={products}
          loading={productLoading}
          hasMore={productHasMore}
          infiniteScrollEnabled={productPickerScrollEnabled}
          onLoadMore={() => {
            if (!productLoading && productHasMore) setProductPage((p) => p + 1);
          }}
          onAdd={addProductToActive}
          blockProductIds={blockProductIds}
          blockFull={(activeBlock?.product_ids.length ?? 0) >= maxProducts}
          flashProductId={pickerFlashProductId}
          productBlockMap={productBlockMap}
          showSelectedProducts={blocks.length > 0}
          selectedBlockIndex1={activeBlockIndex + 1}
          selectedInBlock={activeBlock?.products_cache ?? []}
          maxProductsPerBlock={maxProducts}
          onRemoveFromBlock={(pid) => {
            if (activeBlock) removeProductFromBlock(activeBlock.id, pid);
          }}
          onReorderInBlock={(from, to) => {
            if (activeBlock) reorderProductsInBlock(activeBlock.id, from, to);
          }}
          onClearBlockProducts={() => {
            if (activeBlock) clearBlockProducts(activeBlock.id);
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
      <Toast message={toast} onDismiss={dismissToast} variant={toastVariant} />
    </div>
  );
}
