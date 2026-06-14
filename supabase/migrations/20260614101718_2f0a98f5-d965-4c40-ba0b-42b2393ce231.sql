
-- Extensions
create extension if not exists pgsodium;

-- Enum for roles
do $$ begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin', 'member');
  end if;
end $$;

-- =========================================
-- user_roles
-- =========================================
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create policy "users see own roles" on public.user_roles
  for select to authenticated using (user_id = auth.uid());
create policy "admins read all roles" on public.user_roles
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "admins insert roles" on public.user_roles
  for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "admins update roles" on public.user_roles
  for update to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "admins delete roles" on public.user_roles
  for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Bootstrap function: any authenticated user can promote themselves to admin
-- ONLY when no admin exists yet. Idempotent.
create or replace function public.bootstrap_first_admin()
returns boolean language plpgsql security definer set search_path = public
as $$
declare existing int;
begin
  if auth.uid() is null then return false; end if;
  select count(*) into existing from public.user_roles where role = 'admin';
  if existing = 0 then
    insert into public.user_roles (user_id, role) values (auth.uid(), 'admin')
      on conflict do nothing;
    insert into public.user_roles (user_id, role) values (auth.uid(), 'member')
      on conflict do nothing;
    return true;
  end if;
  -- ensure caller at least has a member row
  insert into public.user_roles (user_id, role) values (auth.uid(), 'member')
    on conflict do nothing;
  return false;
end $$;
revoke all on function public.bootstrap_first_admin() from public;
grant execute on function public.bootstrap_first_admin() to authenticated;

-- =========================================
-- clients
-- =========================================
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text,
  website text,
  industry text,
  status text not null default 'active',
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.clients to authenticated;
grant all on public.clients to service_role;
alter table public.clients enable row level security;

create policy "auth read clients" on public.clients
  for select to authenticated using (true);
create policy "auth insert clients" on public.clients
  for insert to authenticated with check (auth.uid() = created_by);
create policy "owner or admin update clients" on public.clients
  for update to authenticated
  using (auth.uid() = created_by or public.has_role(auth.uid(),'admin'));
create policy "owner or admin delete clients" on public.clients
  for delete to authenticated
  using (auth.uid() = created_by or public.has_role(auth.uid(),'admin'));

create trigger trg_clients_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

-- =========================================
-- projects
-- =========================================
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  status text not null default 'active',
  starts_on date,
  ends_on date,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.projects to authenticated;
grant all on public.projects to service_role;
alter table public.projects enable row level security;

create policy "auth read projects" on public.projects
  for select to authenticated using (true);
create policy "auth insert projects" on public.projects
  for insert to authenticated with check (auth.uid() = created_by);
create policy "owner or admin update projects" on public.projects
  for update to authenticated
  using (auth.uid() = created_by or public.has_role(auth.uid(),'admin'));
create policy "owner or admin delete projects" on public.projects
  for delete to authenticated
  using (auth.uid() = created_by or public.has_role(auth.uid(),'admin'));

create trigger trg_projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- =========================================
-- contacts
-- =========================================
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  role text,
  email text,
  phone text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.contacts to authenticated;
grant all on public.contacts to service_role;
alter table public.contacts enable row level security;

create policy "auth read contacts" on public.contacts
  for select to authenticated using (true);
create policy "auth insert contacts" on public.contacts
  for insert to authenticated with check (auth.uid() = created_by);
create policy "owner or admin update contacts" on public.contacts
  for update to authenticated
  using (auth.uid() = created_by or public.has_role(auth.uid(),'admin'));
create policy "owner or admin delete contacts" on public.contacts
  for delete to authenticated
  using (auth.uid() = created_by or public.has_role(auth.uid(),'admin'));

create trigger trg_contacts_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

-- =========================================
-- client_notes
-- =========================================
create table if not exists public.client_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  body text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.client_notes to authenticated;
grant all on public.client_notes to service_role;
alter table public.client_notes enable row level security;

create policy "auth read client_notes" on public.client_notes
  for select to authenticated using (true);
create policy "auth insert client_notes" on public.client_notes
  for insert to authenticated with check (auth.uid() = created_by);
create policy "owner or admin update client_notes" on public.client_notes
  for update to authenticated
  using (auth.uid() = created_by or public.has_role(auth.uid(),'admin'));
create policy "owner or admin delete client_notes" on public.client_notes
  for delete to authenticated
  using (auth.uid() = created_by or public.has_role(auth.uid(),'admin'));

create trigger trg_client_notes_updated_at
  before update on public.client_notes
  for each row execute function public.set_updated_at();

-- =========================================
-- credentials with pgsodium-managed key
-- =========================================
do $$
declare kid uuid;
begin
  begin
    select id into kid from pgsodium.valid_key where name = 'crm_credentials_key' limit 1;
  exception when others then
    kid := null;
  end;
  if kid is null then
    perform pgsodium.create_key(name => 'crm_credentials_key');
  end if;
end $$;

create table if not exists public.credentials (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  label text not null,
  system text,
  url text,
  username text,
  secret_encrypted bytea,
  secret_nonce bytea,
  notes text,
  last_rotated_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.credentials to authenticated;
grant all on public.credentials to service_role;
alter table public.credentials enable row level security;

-- Members can read metadata. The encrypted bytea is useless without the key.
create policy "auth read credentials meta" on public.credentials
  for select to authenticated using (true);
create policy "admins insert credentials" on public.credentials
  for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "admins update credentials" on public.credentials
  for update to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admins delete credentials" on public.credentials
  for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create trigger trg_credentials_updated_at
  before update on public.credentials
  for each row execute function public.set_updated_at();

-- Admin-only encrypt/decrypt RPCs
create or replace function public.credential_set_secret(_id uuid, _plain text)
returns void language plpgsql security definer set search_path = public, pgsodium
as $$
declare kid uuid; n bytea; c bytea;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'forbidden';
  end if;
  select id into kid from pgsodium.valid_key where name = 'crm_credentials_key' limit 1;
  if kid is null then raise exception 'encryption key missing'; end if;
  if _plain is null or _plain = '' then
    update public.credentials
      set secret_encrypted = null, secret_nonce = null, last_rotated_at = now()
      where id = _id;
    return;
  end if;
  n := pgsodium.crypto_aead_det_noncegen();
  c := pgsodium.crypto_aead_det_encrypt(
        convert_to(_plain, 'utf8'),
        convert_to(_id::text, 'utf8'),
        kid,
        n);
  update public.credentials
    set secret_encrypted = c, secret_nonce = n, last_rotated_at = now()
    where id = _id;
end $$;
revoke all on function public.credential_set_secret(uuid, text) from public;
grant execute on function public.credential_set_secret(uuid, text) to authenticated;

create or replace function public.credential_reveal(_id uuid)
returns text language plpgsql security definer set search_path = public, pgsodium
as $$
declare kid uuid; enc bytea; nonce bytea; plain bytea;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'forbidden';
  end if;
  select id into kid from pgsodium.valid_key where name = 'crm_credentials_key' limit 1;
  select secret_encrypted, secret_nonce into enc, nonce
    from public.credentials where id = _id;
  if enc is null then return null; end if;
  plain := pgsodium.crypto_aead_det_decrypt(
            enc,
            convert_to(_id::text, 'utf8'),
            kid,
            nonce);
  return convert_from(plain, 'utf8');
end $$;
revoke all on function public.credential_reveal(uuid) from public;
grant execute on function public.credential_reveal(uuid) to authenticated;

-- =========================================
-- prompts: link to client / project
-- =========================================
alter table public.prompts add column if not exists client_id uuid references public.clients(id) on delete set null;
alter table public.prompts add column if not exists project_id uuid references public.projects(id) on delete set null;
