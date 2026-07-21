-- Preserve Applied Change Set history if the author User is deleted.
alter table public.change_sets
  alter column author_id drop not null;

alter table public.change_sets
  drop constraint if exists change_sets_author_id_fkey;

alter table public.change_sets
  add constraint change_sets_author_id_fkey
  foreign key (author_id) references auth.users (id) on delete set null;
