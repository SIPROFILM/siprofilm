-- ============================================================
-- SIPROFILM — Schema inicial
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- Extensión para UUIDs
create extension if not exists "uuid-ossp";

-- ============================================================
-- PARTICIPANTS — Equipo de producción
-- ============================================================
create table public.participants (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  role       text,
  email      text unique,
  is_active  boolean default true,
  created_at timestamptz default now()
);

-- ============================================================
-- PROGRAMS — Proyectos de producción
-- ============================================================
create table public.programs (
  id                uuid primary key default uuid_generate_v4(),
  name              text not null unique,
  start_date        date not null,
  work_modality     text default 'Lunes a Viernes',
  status            text default 'active'
                    check (status in ('active','paused','completed','cancelled')),
  notes             text,
  slack_webhook_url text,
  created_by        uuid references auth.users(id),
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- ============================================================
-- ACTIVITY_CATALOG — Biblioteca de actividades reutilizables
-- (equivalente al catálogo base del Excel)
-- ============================================================
create table public.activity_catalog (
  id                   uuid primary key default uuid_generate_v4(),
  name                 text not null unique,
  default_duration     integer default 1,
  default_daily_cost   numeric(12,2) default 0,
  notes                text,
  created_at           timestamptz default now()
);

-- ============================================================
-- ACTIVITIES — Actividades dentro de un programa
-- ============================================================
create table public.activities (
  id              uuid primary key default uuid_generate_v4(),
  program_id      uuid not null references public.programs(id) on delete cascade,
  name            text not null,
  predecessor_id  uuid references public.activities(id) on delete set null,
  responsible_id  uuid references public.participants(id) on delete set null,
  duration_days   integer not null default 1,
  daily_cost      numeric(12,2) default 0,
  status          text default 'pending'
                  check (status in ('pending','in_progress','delivered','blocked')),
  start_date      date,
  end_date        date,
  order_index     integer default 0,
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique(program_id, name)
);

-- ============================================================
-- ACTIVITY_LOG — Historial de cambios por actividad
-- (el módulo CAMBIOS que faltaba en el Excel)
-- ============================================================
create table public.activity_log (
  id            uuid primary key default uuid_generate_v4(),
  activity_id   uuid not null references public.activities(id) on delete cascade,
  changed_by    uuid references auth.users(id),
  field_changed text not null,
  old_value     text,
  new_value     text,
  comment       text,
  created_at    timestamptz default now()
);

-- ============================================================
-- ÍNDICES para performance
-- ============================================================
create index on public.activities(program_id);
create index on public.activities(predecessor_id);
create index on public.activity_log(activity_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) — Todos los usuarios autenticados
-- pueden ver y editar. Ajustar por roles más adelante.
-- ============================================================
alter table public.programs         enable row level security;
alter table public.activities       enable row level security;
alter table public.participants     enable row level security;
alter table public.activity_catalog enable row level security;
alter table public.activity_log     enable row level security;

-- Políticas: usuario autenticado = acceso completo (MVP)
create policy "auth_full_access" on public.programs
  for all using (auth.role() = 'authenticated');

create policy "auth_full_access" on public.activities
  for all using (auth.role() = 'authenticated');

create policy "auth_full_access" on public.participants
  for all using (auth.role() = 'authenticated');

create policy "auth_full_access" on public.activity_catalog
  for all using (auth.role() = 'authenticated');

create policy "auth_full_access" on public.activity_log
  for all using (auth.role() = 'authenticated');

-- ============================================================
-- SEED — Catálogo base de actividades (del Excel original)
-- ============================================================
insert into public.activity_catalog (name, default_duration, default_daily_cost) values
  ('Adquisición del proyecto',        1,  0),
  ('Definición estratégica',          10, 2000),
  ('Investigación',                   30, 2000),
  ('Desarrollo narrativo',            30, 0),
  ('Guión',                           90, 3333),
  ('Conceptualización',               15, 0),
  ('Diseño del proyecto',             15, 0),
  ('Armado del proyecto',             15, 0),
  ('Plan de financiamiento',          15, 0),
  ('Proceso de ventas',               15, 0),
  ('Desarrollo legal',                10, 1000),
  ('Scouting',                        10, 0),
  ('Diseño de producción',            15, 0),
  ('Propuesta de casting',            10, 0),
  ('Casting',                         15, 0),
  ('Firma de contratos',              5,  0),
  ('Scouting técnico',                5,  0),
  ('Ensayo con actores',              5,  0),
  ('Pruebas de cámara',               3,  0),
  ('Renta de equipo',                 3,  0),
  ('Rodaje',                          15, 5000),
  ('Edición',                         30, 3000),
  ('Directors cut',                   10, 0),
  ('Notas directors cut',             5,  0),
  ('Edición primer corte',            20, 3000),
  ('Notas primer corte',              5,  0),
  ('Edición segundo corte',           15, 3000),
  ('Notas segundo corte',             5,  0),
  ('Edición tercer corte',            10, 3000),
  ('Notas tercer corte',              5,  0),
  ('Edición cuarto corte',            10, 3000),
  ('Notas cuarto corte',              5,  0),
  ('Edición picture lock',            5,  3000),
  ('Entrega final de guiones',        3,  0),
  ('Revisión propuesta visual y sonora', 5, 0);
