/** Đếm số thẻ `<p>` mở (top-level heuristic cho description HTML). */
export function countParagraphs(html: string): number {
  if (!html?.trim()) return 0;
  const re = /<p\b[^>]*>/gi;
  return [...html.matchAll(re)].length;
}

export interface PositionOption {
  value: string;
  label: string;
}

export function buildPositionOptions(paragraphCount: number): PositionOption[] {
  const opts: PositionOption[] = [{ value: 'start', label: 'Đầu bài' }];
  for (let i = 1; i <= paragraphCount; i++) {
    opts.push({ value: `after_p_${i}`, label: `Sau đoạn ${i}` });
  }
  opts.push({ value: 'end', label: 'Cuối bài' });
  return opts;
}
