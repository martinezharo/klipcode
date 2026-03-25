begin;

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.validate_folder_hierarchy()
returns trigger
language plpgsql
as $$
declare
  has_cycle boolean;
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'A folder cannot be its own parent';
  end if;

  with recursive ancestors as (
    select id, parent_id
    from public.folders
    where id = new.parent_id
      and owner_id = new.owner_id

    union all

    select f.id, f.parent_id
    from public.folders f
    inner join ancestors a on a.parent_id = f.id
    where f.owner_id = new.owner_id
  )
  select exists(select 1 from ancestors where id = new.id)
  into has_cycle;

  if has_cycle then
    raise exception 'Folder hierarchy cannot contain cycles';
  end if;

  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
  set email = excluded.email,
      display_name = coalesce(excluded.display_name, profiles.display_name),
      avatar_url = coalesce(excluded.avatar_url, profiles.avatar_url),
      updated_at = now();

  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  parent_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint folders_name_not_empty check (btrim(name) <> ''),
  constraint folders_owner_id_id_unique unique (owner_id, id),
  constraint folders_owner_parent_fk
    foreign key (owner_id, parent_id)
    references public.folders (owner_id, id)
    on update cascade
    on delete cascade
);

create table if not exists public.snippets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  folder_id uuid,
  title text not null,
  code text not null,
  language text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint snippets_title_not_empty check (btrim(title) <> ''),
  constraint snippets_code_not_empty check (btrim(code) <> ''),
  constraint snippets_owner_folder_fk
    foreign key (owner_id, folder_id)
    references public.folders (owner_id, id)
    on update cascade
    on delete set null
);

create index if not exists idx_profiles_email on public.profiles (email);
create index if not exists idx_folders_owner_parent on public.folders (owner_id, parent_id);
create index if not exists idx_folders_owner_created_at on public.folders (owner_id, created_at desc);
create index if not exists idx_snippets_owner_folder on public.snippets (owner_id, folder_id);
create index if not exists idx_snippets_owner_updated_at on public.snippets (owner_id, updated_at desc);
create index if not exists idx_snippets_owner_language on public.snippets (owner_id, language);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists set_folders_updated_at on public.folders;
create trigger set_folders_updated_at
before update on public.folders
for each row
execute function public.set_updated_at();

drop trigger if exists validate_folders_hierarchy on public.folders;
create trigger validate_folders_hierarchy
before insert or update of parent_id, owner_id on public.folders
for each row
execute function public.validate_folder_hierarchy();

drop trigger if exists set_snippets_updated_at on public.snippets;
create trigger set_snippets_updated_at
before update on public.snippets
for each row
execute function public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_changed on auth.users;
create trigger on_auth_user_changed
after insert or update of email, raw_user_meta_data on auth.users
for each row
execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.folders enable row level security;
alter table public.snippets enable row level security;

alter table public.profiles force row level security;
alter table public.folders force row level security;
alter table public.snippets force row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists folders_select_own on public.folders;
create policy folders_select_own
on public.folders
for select
to authenticated
using (auth.uid() = owner_id);

drop policy if exists folders_insert_own on public.folders;
create policy folders_insert_own
on public.folders
for insert
to authenticated
with check (auth.uid() = owner_id);

drop policy if exists folders_update_own on public.folders;
create policy folders_update_own
on public.folders
for update
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists folders_delete_own on public.folders;
create policy folders_delete_own
on public.folders
for delete
to authenticated
using (auth.uid() = owner_id);

drop policy if exists snippets_select_own on public.snippets;
create policy snippets_select_own
on public.snippets
for select
to authenticated
using (auth.uid() = owner_id);

drop policy if exists snippets_insert_own on public.snippets;
create policy snippets_insert_own
on public.snippets
for insert
to authenticated
with check (auth.uid() = owner_id);

drop policy if exists snippets_update_own on public.snippets;
create policy snippets_update_own
on public.snippets
for update
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists snippets_delete_own on public.snippets;
create policy snippets_delete_own
on public.snippets
for delete
to authenticated
using (auth.uid() = owner_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.folders to authenticated;
grant select, insert, update, delete on public.snippets to authenticated;

-- Añadir soporte para fijar elementos
alter table public.folders add column is_pinned boolean not null default false;
alter table public.snippets add column is_pinned boolean not null default false;

-- Índices extra para que cargar los "favoritos" sea inmediato
create index if not exists idx_folders_owner_pinned on public.folders (owner_id, is_pinned);
create index if not exists idx_snippets_owner_pinned on public.snippets (owner_id, is_pinned);

commit;