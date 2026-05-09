import { Plus } from 'lucide-react';
import type { WidgetBlockRow } from '@/types/widget';
import type { PositionOption } from '@/lib/positionParser';
import { BlockCard } from '@/components/BlockCard';

interface ContentDetailProps {
  title: string;
  bodyHtml: string;
  blocks: WidgetBlockRow[];
  activeBlockId: string | null;
  onActiveBlock: (id: string) => void;
  positionOptions: PositionOption[];
  maxBlocks: number;
  maxProducts: number;
  onChangeBlock: (id: string, next: WidgetBlockRow) => void;
  onDeleteBlock: (id: string) => void;
  onAddBlock: () => void;
  onRequestRemoveProduct: (blockId: string, productId: string) => void;
  onSave: () => void;
  saving: boolean;
}

export function ContentDetail({
  title,
  bodyHtml,
  blocks,
  activeBlockId,
  onActiveBlock,
  positionOptions,
  maxBlocks,
  maxProducts,
  onChangeBlock,
  onDeleteBlock,
  onAddBlock,
  onRequestRemoveProduct,
  onSave,
  saving,
}: ContentDetailProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-[50vh] min-h-0 flex-col border-b border-slate-200">
        <div className="shrink-0 border-b border-slate-100 px-3 py-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nội dung</h2>
          <p className="mt-1 text-sm font-bold text-slate-900 line-clamp-2">{title || '—'}</p>
        </div>
        <div
          className="min-h-0 flex-1 overflow-y-auto px-3 py-2 text-sm text-slate-800"
          dangerouslySetInnerHTML={{ __html: bodyHtml || '<p class="text-slate-400">(Trống)</p>' }}
        />
      </div>
      <div className="flex h-[50vh] min-h-0 flex-col bg-white">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Block đã chèn</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="rounded-lg bg-[#1d9e75] px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
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
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          {blocks.length === 0 ? (
            <p className="text-center text-sm text-slate-500">Chưa có block. Nhấn &quot;Thêm block&quot;.</p>
          ) : null}
          {blocks.map((b) => (
            <BlockCard
              key={b.id}
              block={b}
              active={activeBlockId === b.id}
              positionOptions={positionOptions}
              maxProducts={maxProducts}
              onFocus={() => onActiveBlock(b.id)}
              onChange={(next) => onChangeBlock(b.id, next)}
              onDelete={() => onDeleteBlock(b.id)}
              onRequestRemoveProduct={(pid) => onRequestRemoveProduct(b.id, pid)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
