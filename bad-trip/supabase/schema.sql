-- ===========================================================================
-- Bad'Trip — schéma Supabase
-- À exécuter dans : Supabase → SQL Editor → New query → Run
-- Crée les tables, la sécurité par ligne (RLS), le bucket de stockage
-- et un trigger qui crée un profil à chaque inscription.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- PROFILS (1 ligne par utilisateur, lié à auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  email        text,
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Crée automatiquement un profil quand un compte est créé
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- PROJETS (un "voyage")
-- ---------------------------------------------------------------------------
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  destination text,
  owner_id    uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

alter table public.projects enable row level security;

-- ---------------------------------------------------------------------------
-- MEMBRES DU PROJET (collaboration)
-- ---------------------------------------------------------------------------
create table if not exists public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

alter table public.project_members enable row level security;

-- ---------------------------------------------------------------------------
-- INVITATIONS
-- ---------------------------------------------------------------------------
create table if not exists public.invitations (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  email      text not null,
  token      uuid not null default gen_random_uuid(),
  invited_by uuid not null references auth.users (id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now()
);

alter table public.invitations enable row level security;
create index if not exists invitations_token_idx on public.invitations (token);
create index if not exists invitations_email_idx on public.invitations (lower(email));

-- ---------------------------------------------------------------------------
-- FICHIERS déposés (texte, image, doc)
-- ---------------------------------------------------------------------------
create table if not exists public.files (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects (id) on delete cascade,
  uploaded_by    uuid not null references auth.users (id) on delete cascade,
  name           text not null,
  kind           text not null default 'doc' check (kind in ('text', 'image', 'doc')),
  mime_type      text,
  storage_path   text,          -- chemin dans le bucket (null si c'est du texte collé)
  content_text   text,          -- texte brut collé directement
  created_at     timestamptz not null default now()
);

alter table public.files enable row level security;
create index if not exists files_project_idx on public.files (project_id);

-- ---------------------------------------------------------------------------
-- ITINÉRAIRES générés par l'IA
-- ---------------------------------------------------------------------------
create table if not exists public.itineraries (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  generated_by uuid not null references auth.users (id) on delete cascade,
  title        text,
  summary      text,
  data         jsonb not null default '{}'::jsonb,   -- { days: [ { day, title, stops: [ {name,lat,lng,...} ] } ] }
  created_at   timestamptz not null default now()
);

alter table public.itineraries enable row level security;
create index if not exists itineraries_project_idx on public.itineraries (project_id);

-- ===========================================================================
-- FONCTION D'AIDE : est-ce que l'utilisateur courant est membre du projet ?
-- SECURITY DEFINER pour éviter la récursion des politiques RLS.
-- ===========================================================================
create or replace function public.is_project_member(pid uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.project_members m
    where m.project_id = pid and m.user_id = auth.uid()
  );
$$;

-- ===========================================================================
-- POLITIQUES RLS
-- ===========================================================================

-- PROFILS : chacun voit tous les profils (pour afficher les noms des membres),
-- mais ne modifie que le sien.
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- PROJETS : visibles par leurs membres ; créables par l'utilisateur connecté ;
-- modifiables/supprimables par le propriétaire.
drop policy if exists "projects_select_member" on public.projects;
create policy "projects_select_member" on public.projects
  for select using (public.is_project_member(id));

drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own" on public.projects
  for insert with check (auth.uid() = owner_id);

drop policy if exists "projects_update_owner" on public.projects;
create policy "projects_update_owner" on public.projects
  for update using (auth.uid() = owner_id);

drop policy if exists "projects_delete_owner" on public.projects;
create policy "projects_delete_owner" on public.projects
  for delete using (auth.uid() = owner_id);

-- MEMBRES : chacun voit les lignes des projets dont il est membre.
drop policy if exists "members_select" on public.project_members;
create policy "members_select" on public.project_members
  for select using (user_id = auth.uid() or public.is_project_member(project_id));

-- On peut s'ajouter soi-même (accepter une invitation) ou être ajouté comme owner à la création.
drop policy if exists "members_insert_self" on public.project_members;
create policy "members_insert_self" on public.project_members
  for insert with check (user_id = auth.uid());

drop policy if exists "members_delete" on public.project_members;
create policy "members_delete" on public.project_members
  for delete using (
    user_id = auth.uid()
    or exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
  );

-- INVITATIONS : les membres du projet voient et créent les invitations.
drop policy if exists "invitations_select_member" on public.invitations;
create policy "invitations_select_member" on public.invitations
  for select using (public.is_project_member(project_id));

drop policy if exists "invitations_insert_member" on public.invitations;
create policy "invitations_insert_member" on public.invitations
  for insert with check (public.is_project_member(project_id) and invited_by = auth.uid());

drop policy if exists "invitations_delete_member" on public.invitations;
create policy "invitations_delete_member" on public.invitations
  for delete using (public.is_project_member(project_id));

-- FICHIERS : membres du projet uniquement.
drop policy if exists "files_select_member" on public.files;
create policy "files_select_member" on public.files
  for select using (public.is_project_member(project_id));

drop policy if exists "files_insert_member" on public.files;
create policy "files_insert_member" on public.files
  for insert with check (public.is_project_member(project_id) and uploaded_by = auth.uid());

drop policy if exists "files_delete_member" on public.files;
create policy "files_delete_member" on public.files
  for delete using (public.is_project_member(project_id));

-- ITINÉRAIRES : membres du projet uniquement.
drop policy if exists "itineraries_select_member" on public.itineraries;
create policy "itineraries_select_member" on public.itineraries
  for select using (public.is_project_member(project_id));

drop policy if exists "itineraries_insert_member" on public.itineraries;
create policy "itineraries_insert_member" on public.itineraries
  for insert with check (public.is_project_member(project_id) and generated_by = auth.uid());

drop policy if exists "itineraries_delete_member" on public.itineraries;
create policy "itineraries_delete_member" on public.itineraries
  for delete using (public.is_project_member(project_id));

-- ===========================================================================
-- STOCKAGE : bucket privé pour les fichiers déposés
-- ===========================================================================
insert into storage.buckets (id, name, public)
values ('trip-files', 'trip-files', false)
on conflict (id) do nothing;

-- Le chemin des fichiers est "{project_id}/...", on vérifie l'appartenance
-- au projet à partir du 1er segment du chemin.
drop policy if exists "trip_files_select" on storage.objects;
create policy "trip_files_select" on storage.objects
  for select using (
    bucket_id = 'trip-files'
    and public.is_project_member((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "trip_files_insert" on storage.objects;
create policy "trip_files_insert" on storage.objects
  for insert with check (
    bucket_id = 'trip-files'
    and public.is_project_member((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "trip_files_delete" on storage.objects;
create policy "trip_files_delete" on storage.objects
  for delete using (
    bucket_id = 'trip-files'
    and public.is_project_member((storage.foldername(name))[1]::uuid)
  );
