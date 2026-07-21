-- Add optional background color for buttons (Modified Fitzgerald Key / custom).
alter table public.buttons
  add column background_color text not null default '#ffffff';

alter table public.buttons
  add constraint buttons_background_color_hex_check
  check (background_color ~ '^#[0-9A-Fa-f]{6}$');
