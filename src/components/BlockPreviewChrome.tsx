import { Trash2 } from 'lucide-react';

interface BlockPreviewChromeProps {
  displayTitle: string;
  onDelete: () => void;
  /** `embedded`: một hàng trong chrome block preview (không viền bọc ngoài). */
  variant?: 'default' | 'embedded';
}

export function BlockPreviewChrome({ displayTitle, onDelete, variant = 'default' }: BlockPreviewChromeProps) {
  const inner = (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <h3 className="min-w-0 flex-1 truncate text-sm font-semibold tracking-normal text-slate-800">
        {displayTitle}
      </h3>
      <button
        type="button"
        onClick={onDelete}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600"
        aria-label="Xóa block"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );

  if (variant === 'embedded') {
    return inner;
  }

  return (
    <div className="shrink-0 border-b border-slate-100 bg-white font-sans">
      <div className="flex items-center gap-2 px-2 py-2">{inner}</div>
    </div>
  );
}
