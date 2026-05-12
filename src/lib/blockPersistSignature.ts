import type { WidgetBlockRow } from '@/types/widget';

export function blockPayloadSlice(b: WidgetBlockRow, index: number) {
  return {
    block_index: index,
    title: b.title,
    position: b.position,
    display_type: b.display_type,
    grid_desktop_cols: b.grid_desktop_cols,
    grid_mobile_cols: b.grid_mobile_cols,
    grid_gap_px: b.grid_gap_px,
    slider_desktop_count: b.slider_desktop_count,
    slider_mobile_count: b.slider_mobile_count,
    product_ids: [...b.product_ids].sort(),
  };
}

export function serializeBlocksSignature(blocks: WidgetBlockRow[]): string {
  return JSON.stringify(blocks.map((b, i) => blockPayloadSlice(b, i)));
}

/** Chỉ so khớp các block đã có trong bản lưu (bỏ qua block mới append ở cuối). */
export function hasUnsavedChangesOnExistingBlocks(blocks: WidgetBlockRow[], savedSignature: string): boolean {
  if (!savedSignature) return false;
  try {
    const saved = JSON.parse(savedSignature) as ReturnType<typeof blockPayloadSlice>[];
    for (let i = 0; i < saved.length; i++) {
      const cur = blocks[i];
      if (!cur) return true;
      if (JSON.stringify(blockPayloadSlice(cur, i)) !== JSON.stringify(saved[i])) return true;
    }
  } catch {
    return true;
  }
  return false;
}

/** STT block 1-based đầu tiên trong phạm vi bản lưu bị lệch (hoặc 1). */
export function findFirstUnsavedExistingBlockStt(blocks: WidgetBlockRow[], savedSignature: string): number {
  if (!savedSignature) return 1;
  try {
    const saved = JSON.parse(savedSignature) as ReturnType<typeof blockPayloadSlice>[];
    for (let i = 0; i < saved.length; i++) {
      const cur = blocks[i];
      if (!cur) return i + 1;
      if (JSON.stringify(blockPayloadSlice(cur, i)) !== JSON.stringify(saved[i])) return i + 1;
    }
  } catch {
    return 1;
  }
  return 1;
}
