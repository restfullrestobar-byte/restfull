-- ============================================================
--  RESTFUL RESTOBAR — Esquema del dashboard de menú
--  Correr en: Supabase → SQL Editor → New query → Run
-- ============================================================

-- ---------- TABLAS ----------

create table if not exists perfiles (
  id         uuid primary key references auth.users on delete cascade,
  email      text,
  rol        text not null default 'dueno' check (rol in ('dueno','admin')),
  creado_en  timestamptz not null default now()
);

create table if not exists secciones (
  id        text primary key,            -- 'entradas', 'cocktails', ...
  nombre    text not null,               -- 'Entradas Restful'
  subtitulo text default '',
  orden     int  not null default 0,
  activo    bool not null default true
);

create table if not exists menu_items (
  id             bigint generated always as identity primary key,
  seccion        text not null references secciones(id) on delete cascade,
  categoria      text not null default '',   -- subtítulo dentro de la sección
  nombre         text not null,
  descripcion    text not null default '',
  peso           text not null default '',   -- '250g'
  precio         numeric(10,2) not null,
  precio2        numeric(10,2),              -- segundo precio (trago / botella)
  decimales      bool not null default true, -- mostrar ',00'
  agotado        bool not null default false,
  activo         bool not null default true,
  orden          int  not null default 0,
  actualizado_en timestamptz not null default now()
);

create index if not exists menu_items_seccion_orden_idx on menu_items (seccion, orden);

create table if not exists suscripciones (
  mes         date primary key,           -- siempre el día 1: 2026-10-01
  estado      text not null default 'pendiente' check (estado in ('pendiente','pagado')),
  monto       numeric(10,2) not null default 25,
  referencia  text,                       -- nro de transferencia Banco Pichincha
  fecha_pago  timestamptz,
  marcado_por uuid references auth.users,
  nota        text
);

create table if not exists config (
  clave text primary key,
  valor text not null
);

insert into config (clave, valor) values
  ('dias_gracia','5'),
  ('monto_mensual','25'),
  ('contacto_soporte','Bryan')
on conflict (clave) do nothing;

-- ---------- FUNCIONES DE PERMISO ----------

create or replace function es_admin() returns boolean
  language sql security definer stable
  set search_path = public, pg_temp
as $$
  select exists (select 1 from perfiles where id = auth.uid() and rol = 'admin');
$$;

create or replace function mes_pagado() returns boolean
  language sql security definer stable
  set search_path = public, pg_temp
as $$
  select exists (
    select 1 from suscripciones
    where mes = date_trunc('month', now())::date
      and estado = 'pagado'
  );
$$;

-- Puede editar el menú si: es admin, o el mes está pagado,
-- o todavía estamos dentro de los días de gracia del mes.
create or replace function puede_editar() returns boolean
  language sql security definer stable
  set search_path = public, pg_temp
as $$
  select es_admin()
      or mes_pagado()
      or extract(day from now())::int
         <= coalesce((select valor::int from config where clave = 'dias_gracia'), 5);
$$;

-- ---------- RLS ----------

alter table perfiles      enable row level security;
alter table secciones     enable row level security;
alter table menu_items    enable row level security;
alter table suscripciones enable row level security;
alter table config        enable row level security;

-- PERFILES: cada quien ve el suyo; el admin ve todos
drop policy if exists perfiles_select on perfiles;
create policy perfiles_select on perfiles for select
  using (id = auth.uid() or es_admin());

drop policy if exists perfiles_admin_write on perfiles;
create policy perfiles_admin_write on perfiles for all
  using (es_admin()) with check (es_admin());

-- SECCIONES y MENU_ITEMS: lectura pública (el menú de los clientes)
drop policy if exists secciones_public_read on secciones;
create policy secciones_public_read on secciones for select using (true);

drop policy if exists menu_public_read on menu_items;
create policy menu_public_read on menu_items for select using (true);

-- Escritura: solo logueado Y con permiso de edición (admin o mes al día)
drop policy if exists secciones_write on secciones;
create policy secciones_write on secciones for all
  to authenticated using (puede_editar()) with check (puede_editar());

drop policy if exists menu_write on menu_items;
create policy menu_write on menu_items for all
  to authenticated using (puede_editar()) with check (puede_editar());

-- SUSCRIPCIONES: cualquier logueado ve el estado; solo admin lo cambia
drop policy if exists susc_select on suscripciones;
create policy susc_select on suscripciones for select to authenticated using (true);

drop policy if exists susc_admin_write on suscripciones;
create policy susc_admin_write on suscripciones for all
  to authenticated using (es_admin()) with check (es_admin());

-- CONFIG: lectura logueada, escritura admin
drop policy if exists config_select on config;
create policy config_select on config for select to authenticated using (true);

drop policy if exists config_admin_write on config;
create policy config_admin_write on config for all
  to authenticated using (es_admin()) with check (es_admin());

-- ---------- AUTOMATISMOS ----------

-- Al registrarse un usuario, crear su perfil (rol 'dueno' por defecto)
create or replace function on_auth_user_created() returns trigger
  language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  insert into perfiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_auth_user_created on auth.users;
create trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function on_auth_user_created();

-- Marcar fecha de actualización en cada cambio de plato
create or replace function touch_actualizado() returns trigger
  language plpgsql as $$
begin new.actualizado_en = now(); return new; end;
$$;

drop trigger if exists trg_menu_touch on menu_items;
create trigger trg_menu_touch before update on menu_items
  for each row execute function touch_actualizado();
