-- Khoảng cách giữa các card trong block (grid + slider). Cột tùy chọn: nếu chưa có, app vẫn đọc mặc định 12px ở mapRow.
alter table public.widget_blocks
  add column if not exists grid_gap_px integer not null default 12;

comment on column public.widget_blocks.grid_gap_px is 'Gap between product cards in px (8–48), grid + slider';
