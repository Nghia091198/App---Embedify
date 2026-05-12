import { useId, useState } from 'react';
import { ChevronDown, GripVertical, X } from 'lucide-react';
import type { ProductSnapshot } from '@/types/widget';
import { ListRowThumbnail } from '@/components/ListRowThumbnail';
import { cn } from '@/lib/cn';

interface SelectedProductsAccordionProps {
  blockIndex1: number;
  products: ProductSnapshot[];
  maxProducts: number;
  onRemove: (productId: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onClearAll: () => void;
  defaultOpen?: boolean;
}

export function SelectedProductsAccordion({
  blockIndex1,
  products,
  maxProducts,
  onRemove,
  onReorder,
  onClearAll,
  defaultOpen = true,
}: SelectedProductsAccordionProps) {
  const panelId = useId();
  const [open, setOpen] = useState(defaultOpen);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col bg-white font-sans">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 border-b border-slate-200 px-3 py-2.5 text-left"
        aria-expanded={open}
        aria-controls={panelId}
      >
        <span className="text-sm font-semibold tracking-normal text-slate-800">
          Block {blockIndex1}: Sản phẩm đã chọn ({products.length})
        </span>
        <ChevronDown className={cn('size-4 shrink-0 text-slate-500 transition-transform', open && 'rotate-180')} />
      </button>
      {open ? (
        <div id={panelId} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
            <ul className="divide-y divide-slate-100">
              {products.map((p, idx) => (
                <li
                  key={p.id}
                  draggable
                  onDragStart={() => setDragIndex(idx)}
                  onDragEnd={() => setDragIndex(null)}
                  onDragOver={(e) => {
                    e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragIndex == null || dragIndex === idx) return;
                    onReorder(dragIndex, idx);
                    setDragIndex(null);
                  }}
                  className={cn(
                    'flex items-center gap-2 px-2 py-2 transition-colors',
                    dragIndex === idx && 'bg-emerald-50/50',
                  )}
                >
                  <span className="shrink-0 cursor-grab text-slate-400" aria-hidden>
                    <GripVertical className="size-4" />
                  </span>
                  <ListRowThumbnail src={p.featured_image} className="size-11 shrink-0 rounded-md" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug text-slate-900 line-clamp-2">{p.title}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      {p.published !== false ? (
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                          Hiển thị
                        </span>
                      ) : (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                          Ẩn
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400">
                        {idx + 1}/{maxProducts}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(p.id)}
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    aria-label="Xóa khỏi block"
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
            {products.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-slate-500">Chưa chọn sản phẩm.</p>
            ) : null}
          </div>
          {products.length > 0 ? (
            <div className="shrink-0 border-t border-slate-100 py-2 text-center">
              <button
                type="button"
                onClick={onClearAll}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline"
              >
                Xóa tất cả
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
