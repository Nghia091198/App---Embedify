import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/cn';

interface ListRowThumbnailProps {
  src: string | null | undefined;
  className?: string;
}

export function ListRowThumbnail({ src, className }: ListRowThumbnailProps) {
  const url = typeof src === 'string' ? src.trim() : '';
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className={cn(
          'size-12 shrink-0 rounded-md border border-slate-200 bg-white object-cover',
          className,
        )}
      />
    );
  }
  return (
    <div
      className={cn(
        'flex size-12 shrink-0 items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-100 text-slate-400',
        className,
      )}
      aria-hidden
    >
      <ImageOff className="size-5" strokeWidth={1.5} />
    </div>
  );
}
