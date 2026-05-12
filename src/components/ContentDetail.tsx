import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { Plus } from 'lucide-react';
import type { WidgetBlockRow } from '@/types/widget';
import type { PositionOption } from '@/lib/positionParser';
import { buildArticleBodyPreviewHtml, buildContentPreviewHtml, type PreviewStorefrontFlags } from '@/lib/previewContentHtml';
import { cn } from '@/lib/cn';
import { useSwiperPreview } from '@/hooks/useSwiperPreview';
import { BlockPreviewChrome } from '@/components/BlockPreviewChrome';
import { BlockConfigAccordion } from '@/components/BlockConfigAccordion';

interface ContentDetailProps {
  title: string;
  bodyHtml: string;
  blocks: WidgetBlockRow[];
  previewFlags: PreviewStorefrontFlags;
  activeBlockId: string | null;
  onActiveBlock: (id: string) => void;
  positionOptions: PositionOption[];
  maxBlocks: number;
  onChangeBlock: (id: string, next: WidgetBlockRow) => void;
  onDeleteBlock: (id: string) => void;
  onAddBlock: () => void;
  onSave: () => void;
  saving: boolean;
  canSave: boolean;
  addBlockGate: { stt: number } | null;
  onSaveUnsavedBeforeAdd: () => void;
  onReviewUnsavedBeforeAdd: () => void;
  liveStorefrontUrl: string | null;
  haravanAdminEditUrl: string | null;
  previewAppearance?: {
    primaryColor: string;
    fontFamily?: string;
  } | null;
}

export function ContentDetail({
  title,
  bodyHtml,
  blocks,
  previewFlags,
  activeBlockId,
  onActiveBlock,
  positionOptions,
  maxBlocks,
  onChangeBlock,
  onDeleteBlock,
  onAddBlock,
  onSave,
  saving,
  canSave,
  addBlockGate,
  onSaveUnsavedBeforeAdd,
  onReviewUnsavedBeforeAdd,
  liveStorefrontUrl,
  haravanAdminEditUrl,
  previewAppearance,
}: ContentDetailProps) {
  const previewHref = liveStorefrontUrl ?? '#';
  const previewOpens = Boolean(liveStorefrontUrl);
  const adminHref = haravanAdminEditUrl ?? '#';
  const adminOpens = Boolean(haravanAdminEditUrl);

  const activeBlock = useMemo(() => {
    if (blocks.length === 0) return null;
    const byId = activeBlockId ? blocks.find((b) => b.id === activeBlockId) : null;
    return byId ?? blocks[0] ?? null;
  }, [blocks, activeBlockId]);

  const blockOrdinals = useMemo(() => {
    const m: Record<string, number> = {};
    blocks.forEach((b, i) => {
      m[b.id] = i + 1;
    });
    return m;
  }, [blocks]);

  const fullPreviewHtml = useMemo(() => {
    if (blocks.length === 0) {
      return buildArticleBodyPreviewHtml(bodyHtml, previewFlags);
    }
    if (!activeBlock) {
      return buildArticleBodyPreviewHtml(bodyHtml, previewFlags);
    }
    return buildContentPreviewHtml(bodyHtml, blocks, previewFlags, {
      activeBlockId: activeBlock.id,
      blockOrdinals,
    });
  }, [blocks, activeBlock, bodyHtml, previewFlags, blockOrdinals]);

  const fullPreviewRef = useRef<HTMLDivElement>(null);

  useSwiperPreview(fullPreviewRef, fullPreviewHtml);

  useEffect(() => {
    if (blocks.length === 0) return;
    const root = fullPreviewRef.current;
    if (!root) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('a') || t.closest('button') || t.closest('input')) return;
      const slot = t.closest('[data-wg-block-id]');
      const id = slot?.getAttribute('data-wg-block-id');
      if (id) onActiveBlock(id);
    };
    root.addEventListener('click', onClick);
    return () => {
      root.removeEventListener('click', onClick);
    };
  }, [fullPreviewHtml, blocks.length, onActiveBlock]);

  const previewSurfaceStyle = useMemo((): CSSProperties => {
    const primary = (previewAppearance?.primaryColor ?? '#e84040').trim() || '#e84040';
    const font = previewAppearance?.fontFamily?.trim();
    const s: CSSProperties & Record<string, string> = { '--wg-color': primary };
    if (font) s['--wg-font'] = font;
    return s;
  }, [previewAppearance]);

  const activeBlockOrdinal = activeBlock ? (blockOrdinals[activeBlock.id] ?? 1) : 1;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-slate-200 bg-white px-3 py-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nội dung</h2>
            <p className="mt-0.5 text-sm font-bold text-slate-900 line-clamp-2">{title || '—'}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
            <a
              href={adminHref}
              target={adminOpens ? '_blank' : undefined}
              rel={adminOpens ? 'noopener noreferrer' : undefined}
              onClick={adminOpens ? undefined : (e) => e.preventDefault()}
              className={cn(
                'inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide',
                adminOpens
                  ? 'text-sky-600 hover:text-sky-700 hover:underline'
                  : 'cursor-not-allowed text-slate-400 no-underline',
              )}
              title={adminOpens ? adminHref : 'Chưa có domain shop hoặc thiếu blog với bài viết.'}
              aria-disabled={!adminOpens}
            >
              Xem trên admin
            </a>
            <span className="hidden text-sky-600 sm:inline" style={{ transform: 'scale(0.8)' }}>
              |
            </span>
            <a
              href={previewHref}
              target={previewOpens ? '_blank' : undefined}
              rel={previewOpens ? 'noopener noreferrer' : undefined}
              onClick={previewOpens ? undefined : (e) => e.preventDefault()}
              className={cn(
                'inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide',
                previewOpens
                  ? 'text-sky-600 hover:text-sky-700 hover:underline'
                  : 'cursor-not-allowed text-slate-400 no-underline',
              )}
              title={
                previewOpens
                  ? (liveStorefrontUrl ?? undefined)
                  : 'Chưa có domain shop (đăng nhập lại) hoặc thiếu blog_handle với bài viết.'
              }
              aria-disabled={!previewOpens}
            >
              Xem trên website
            </a>
          </div>
        </div>
        <p className="mt-2 rounded-md border border-amber-100 bg-amber-50 px-2 py-1.5 text-[10px] leading-snug text-amber-900">
          Xem trước nội dung bài (và block nếu có). Trang storefront có thể khác do theme.
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-[1.05] flex-col border-b border-slate-200 bg-slate-50/50">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-2">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div
                ref={fullPreviewRef}
                className="wg-preview wg-preview-root min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2 text-sm [scrollbar-gutter:stable] [&_a]:text-sky-600 [&_p]:mb-3 [&_p:last-child]:mb-0"
                style={previewSurfaceStyle}
                dangerouslySetInnerHTML={{ __html: fullPreviewHtml }}
              />
            </div>
          </div>
        </div>

        {blocks.length === 0 ? (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-3 py-3">
            <p className="text-xs text-slate-600">Chưa có block sản phẩm trên bài này.</p>
            <button
              type="button"
              onClick={onAddBlock}
              disabled={blocks.length >= maxBlocks}
              className="inline-flex items-center gap-1 rounded-lg bg-[#1d9e75] px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="size-3.5" />
              Thêm block
            </button>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col bg-white">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Block đã chèn</h2>
                {blocks.length > 1 ? (
                  <>
                    <label className="sr-only" htmlFor="wg-active-block-select">
                      Chọn block
                    </label>
                    <select
                      id="wg-active-block-select"
                      value={activeBlock?.id ?? ''}
                      onChange={(e) => onActiveBlock(e.target.value)}
                      className="max-w-[10rem] rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-[#1d9e75]"
                    >
                      {blocks.map((b, i) => (
                        <option key={b.id} value={b.id}>
                          Block {i + 1}
                        </option>
                      ))}
                    </select>
                  </>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onSave}
                  disabled={saving || !canSave}
                  className="rounded-lg bg-[#1d9e75] px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? 'Đang lưu…' : 'Lưu'}
                </button>
                <button
                  type="button"
                  onClick={onAddBlock}
                  disabled={blocks.length >= maxBlocks}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="size-3.5" />
                  Thêm block
                </button>
              </div>
            </div>

            {activeBlock ? (
              <div className="wg-admin-block-chrome flex min-h-9 shrink-0 items-center gap-2 border-b border-slate-100 bg-white px-3 py-1.5">
                <BlockPreviewChrome
                  variant="embedded"
                  displayTitle={`Block sản phẩm ${activeBlockOrdinal}`}
                  onDelete={() => onDeleteBlock(activeBlock.id)}
                />
              </div>
            ) : null}

            {addBlockGate ? (
              <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-xs font-medium text-amber-900">
                  Bạn cần lưu block {addBlockGate.stt} trước khi thêm block mới.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={onSaveUnsavedBeforeAdd}
                    disabled={saving || !canSave}
                    className="rounded-lg bg-[#1d9e75] px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Lưu block {addBlockGate.stt}
                  </button>
                  <button
                    type="button"
                    onClick={onReviewUnsavedBeforeAdd}
                    className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100/80"
                  >
                    Xem lại block {addBlockGate.stt}
                  </button>
                </div>
              </div>
            ) : null}

            {activeBlock ? (
              <div className="min-h-0 flex-1 overflow-y-auto p-3 [scrollbar-gutter:stable]">
                <BlockConfigAccordion
                  block={activeBlock}
                  blockOrdinal={activeBlockOrdinal}
                  positionOptions={positionOptions}
                  onChange={(next) => onChangeBlock(activeBlock.id, next)}
                />
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
