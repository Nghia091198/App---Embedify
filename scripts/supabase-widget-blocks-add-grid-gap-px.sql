-- Chạy một lần trên Supabase: Dashboard → SQL Editor → New query → Run.
-- Sau đó nếu API vẫn báo schema: Settings → API → Reload schema (hoặc đợi vài phút).

alter table public.widget_blocks
  add column if not exists grid_gap_px integer not null default 12;

comment on column public.widget_blocks.grid_gap_px is 'Gap between product cards in px (8–48), grid + slider';
