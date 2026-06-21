-- ============================================================
--  Casa Hub — schema Supabase (MVP)
--  Esegui tutto questo in: Supabase > SQL Editor > New query > Run
--  Connette TUTTE le feature dell'app al database:
--   - properties     -> dati casa + valore
--   - documents      -> documenti dell'agenzia (Documenti)
--   - items          -> file caricati dal proprietario (Aggiunti da te)
--   - leads          -> richieste dai pulsanti "Contattaci"
--   - access_log     -> log degli sblocchi (tap/login)
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- properties ----------
create table if not exists public.properties (
  id            uuid primary key default gen_random_uuid(),
  address       text,
  title         text,
  sub           text,
  estimate      integer,
  estimate_min  integer,
  estimate_max  integer,
  created_at    timestamptz default now()
);

insert into public.properties (id, address, title, sub, estimate, estimate_min, estimate_max)
values ('11111111-1111-1111-1111-111111111111',
        'Viale Marco Fulvio Nobiliore 50', 'Monolocale, 32 m²', 'Roma, zona Tuscolano (00178)',
        110000, 98000, 122000)
on conflict (id) do nothing;

-- ---------- documents (agenzia) ----------
create table if not exists public.documents (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references public.properties(id) on delete cascade,
  title        text not null,
  subtitle     text,
  icon         text default 'doc',   -- doc | energy | plan | wrench
  locked       boolean default true, -- true = richiede PIN
  file_path    text,
  mime         text,
  sort         integer default 0,
  created_at   timestamptz default now()
);
create index if not exists documents_property_idx on public.documents(property_id);

insert into public.documents (property_id, title, subtitle, icon, locked, sort) values
 ('11111111-1111-1111-1111-111111111111','Atto di compravendita','Rogito notarile, PDF','doc',false,1),
 ('11111111-1111-1111-1111-111111111111','APE, Classe D','Valido fino al 17/06/2035','energy',true,2),
 ('11111111-1111-1111-1111-111111111111','Planimetria catastale','Protetto','plan',true,3),
 ('11111111-1111-1111-1111-111111111111','Libretto impianti','Caldaia, climatizzazione','wrench',true,4)
on conflict do nothing;

-- ---------- items (caricati dal proprietario) ----------
create table if not exists public.items (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references public.properties(id) on delete cascade,
  type         text not null,
  title        text not null,
  file_name    text,
  file_path    text,
  mime         text,
  created_at   timestamptz default now()
);
create index if not exists items_property_idx on public.items(property_id);

-- ---------- leads (Contattaci) ----------
create table if not exists public.leads (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid references public.properties(id) on delete set null,
  kind         text not null,        -- Affitto | Valutazione
  contact      text,                 -- opzionale (telefono/email)
  created_at   timestamptz default now()
);

-- ---------- access_log (sblocchi) ----------
create table if not exists public.access_log (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid references public.properties(id) on delete set null,
  event        text default 'unlock',
  ua           text,
  created_at   timestamptz default now()
);

-- ============================================================
--  RLS — versione MVP (permissiva, accesso con anon key)
--  NB: per ora chiunque abbia URL + anon key può leggere/scrivere.
--  Va bene per il prototipo. Vedi README per l'hardening.
-- ============================================================
alter table public.properties enable row level security;
alter table public.documents  enable row level security;
alter table public.items      enable row level security;
alter table public.leads      enable row level security;
alter table public.access_log enable row level security;

drop policy if exists "properties read" on public.properties;
create policy "properties read" on public.properties for select using (true);

drop policy if exists "documents read" on public.documents;
create policy "documents read" on public.documents for select using (true);

drop policy if exists "items read"   on public.items;
drop policy if exists "items insert" on public.items;
drop policy if exists "items delete" on public.items;
create policy "items read"   on public.items for select using (true);
create policy "items insert" on public.items for insert with check (true);
create policy "items delete" on public.items for delete using (true);

drop policy if exists "leads insert" on public.leads;
create policy "leads insert" on public.leads for insert with check (true);

drop policy if exists "access insert" on public.access_log;
create policy "access insert" on public.access_log for insert with check (true);

-- ============================================================
--  Storage — bucket privato "casa-files" (documenti agenzia + upload utente)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('casa-files', 'casa-files', false)
on conflict (id) do nothing;

drop policy if exists "casa-files read"   on storage.objects;
drop policy if exists "casa-files insert" on storage.objects;
drop policy if exists "casa-files delete" on storage.objects;
create policy "casa-files read"   on storage.objects for select using (bucket_id = 'casa-files');
create policy "casa-files insert" on storage.objects for insert with check (bucket_id = 'casa-files');
create policy "casa-files delete" on storage.objects for delete using (bucket_id = 'casa-files');
