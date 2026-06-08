-- CUC Estacionamiento - cierre de permisos y RPC seguras
-- Ejecutar una sola vez en Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.cuc_admin_credentials (
  username text primary key,
  password_hash text not null,
  nombre text not null default 'Administrador',
  updated_at timestamptz not null default now()
);

create table if not exists public.cuc_admin_sessions (
  token text primary key,
  username text not null references public.cuc_admin_credentials(username) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

insert into public.cuc_admin_credentials (username, password_hash, nombre, updated_at)
values ('admin', crypt('scrugby1907', gen_salt('bf')), 'Administrador', now())
on conflict (username) do update set
  password_hash = excluded.password_hash,
  nombre = excluded.nombre,
  updated_at = now();

do $$
declare
  r record;
begin
  for r in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('eventos', 'sesiones', 'tickets', 'cuc_admin_credentials', 'cuc_admin_sessions')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

alter table public.eventos enable row level security;
alter table public.sesiones enable row level security;
alter table public.tickets enable row level security;
alter table public.cuc_admin_credentials enable row level security;
alter table public.cuc_admin_sessions enable row level security;

revoke all on public.eventos from anon, authenticated;
revoke all on public.sesiones from anon, authenticated;
revoke all on public.tickets from anon, authenticated;
revoke all on public.cuc_admin_credentials from anon, authenticated;
revoke all on public.cuc_admin_sessions from anon, authenticated;

do $$
declare
  r record;
begin
  for r in
    select table_name, data_type
    from information_schema.columns
    where table_schema = 'public'
      and column_name = 'id'
      and table_name in ('eventos', 'sesiones', 'tickets')
  loop
    if r.data_type = 'uuid' then
      execute format('alter table public.%I alter column id set default gen_random_uuid()', r.table_name);
    elsif r.data_type in ('text', 'character varying') then
      execute format('alter table public.%I alter column id set default gen_random_uuid()::text', r.table_name);
    end if;
  end loop;
end $$;

create or replace function public.cuc_clean_text(p_value text, p_max int default 80)
returns text
language sql
immutable
as $$
  select left(trim(regexp_replace(coalesce(p_value, ''), '[[:cntrl:]\s]+', ' ', 'g')), p_max);
$$;

create or replace function public.cuc_clean_digits(p_value text, p_max int default 10)
returns text
language sql
immutable
as $$
  select left(regexp_replace(coalesce(p_value, ''), '\D', '', 'g'), p_max);
$$;

create or replace function public.cuc_resumen_json(p_tickets jsonb)
returns jsonb
language sql
immutable
as $$
  with rows as (
    select *
    from jsonb_to_recordset(coalesce(p_tickets, '[]'::jsonb)) as t(
      metodo_pago text,
      monto numeric,
      eliminado boolean
    )
    where coalesce(t.eliminado, false) = false
  )
  select jsonb_build_object(
    'cantidad_total', count(*),
    'cantidad_efectivo', count(*) filter (where metodo_pago = 'efectivo'),
    'cantidad_transferencia', count(*) filter (where metodo_pago = 'transferencia'),
    'cantidad_libres', count(*) filter (where metodo_pago = 'libre'),
    'total_efectivo', coalesce(sum(coalesce(monto, 0)) filter (where metodo_pago = 'efectivo'), 0),
    'total_transferencia', coalesce(sum(coalesce(monto, 0)) filter (where metodo_pago = 'transferencia'), 0),
    'total_recaudado', coalesce(sum(coalesce(monto, 0)) filter (where metodo_pago in ('efectivo', 'transferencia')), 0)
  )
  from rows;
$$;

create or replace function public.cuc_resumen_evento(p_evento_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.cuc_resumen_json(coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb))
  from public.tickets t
  where t.evento_id::text = p_evento_id;
$$;

create or replace function public.cuc_resumen_sesion_privado(p_sesion_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.cuc_resumen_json(coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb))
  from public.tickets t
  where t.sesion_id::text = p_sesion_id;
$$;

create or replace function public.cuc_assert_admin(p_token text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_username text;
begin
  select username into v_username
  from public.cuc_admin_sessions
  where token = p_token
    and expires_at > now();

  if v_username is null then
    raise exception 'No tenés permisos de administrador.';
  end if;

  return v_username;
end;
$$;

create or replace function public.cuc_login_admin(p_usuario text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.cuc_admin_credentials%rowtype;
  v_token text;
begin
  select * into v_user
  from public.cuc_admin_credentials
  where lower(username) = lower(public.cuc_clean_text(p_usuario, 120));

  if v_user.username is null or v_user.password_hash <> crypt(lower(coalesce(p_password, '')), v_user.password_hash) then
    raise exception 'Usuario o contraseña incorrectos.';
  end if;

  v_token := encode(gen_random_bytes(32), 'hex');

  insert into public.cuc_admin_sessions (token, username, expires_at)
  values (v_token, v_user.username, now() + interval '12 hours');

  return jsonb_build_object(
    'id', 'admin',
    'nombre', v_user.nombre,
    'role', 'admin',
    'admin_token', v_token
  );
end;
$$;

create or replace function public.cuc_eventos_activos()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(
    (to_jsonb(e) - 'password_evento') ||
    jsonb_build_object('resumen', public.cuc_resumen_evento(e.id::text))
    order by e.fecha asc
  ), '[]'::jsonb)
  from public.eventos e
  where e.estado = 'activo';
$$;

create or replace function public.cuc_todos_eventos(p_admin_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  perform public.cuc_assert_admin(p_admin_token);

  select coalesce(jsonb_agg(
    to_jsonb(e) ||
    jsonb_build_object('resumen', public.cuc_resumen_evento(e.id::text))
    order by e.fecha desc
  ), '[]'::jsonb)
  into v_result
  from public.eventos e;

  return v_result;
end;
$$;

create or replace function public.cuc_crear_evento(p_admin_token text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_visitante text := public.cuc_clean_text(p_payload->>'visitante', 80);
  v_categoria text := public.cuc_clean_text(p_payload->>'categoria', 40);
  v_fecha text := public.cuc_clean_text(p_payload->>'fecha', 20);
  v_hora text := nullif(public.cuc_clean_text(p_payload->>'hora', 8), '');
  v_precio numeric := nullif(p_payload->>'precio_entrada', '')::numeric;
  v_alias text := public.cuc_clean_text(p_payload->>'alias', 80);
  v_code text;
  v_evento public.eventos%rowtype;
begin
  perform public.cuc_assert_admin(p_admin_token);

  if length(v_visitante) < 2 then raise exception 'Ingresá un visitante válido.'; end if;
  if v_categoria not in ('infantiles', 'juveniles', 'plantel_superior', 'femenino') then raise exception 'Seleccioná una categoría válida.'; end if;
  if v_fecha !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Seleccioná una fecha válida.'; end if;
  if v_hora is not null and v_hora !~ '^\d{2}:\d{2}$' then raise exception 'Ingresá una hora válida.'; end if;
  if v_precio is null or v_precio <= 0 then raise exception 'Ingresá un precio válido.'; end if;

  v_code := (case v_categoria
    when 'infantiles' then 'I'
    when 'juveniles' then 'J'
    when 'plantel_superior' then 'S'
    when 'femenino' then 'F'
    else 'X'
  end) || (floor(random() * 900 + 100))::int::text;

  insert into public.eventos (
    visitante, categoria, fecha, hora, precio_entrada, alias,
    estado, password_evento, created_at, closed_at
  )
  values (
    v_visitante, v_categoria, v_fecha::date, v_hora, v_precio, v_alias,
    'activo', v_code, now(), null
  )
  returning * into v_evento;

  return jsonb_build_object(
    'evento', to_jsonb(v_evento) || jsonb_build_object('resumen', public.cuc_resumen_json('[]'::jsonb)),
    'access_code', v_code
  );
end;
$$;

create or replace function public.cuc_cerrar_evento(p_admin_token text, p_evento_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_evento public.eventos%rowtype;
begin
  perform public.cuc_assert_admin(p_admin_token);

  update public.sesiones
  set estado = 'finalizada',
      hora_cierre = now(),
      cerrada_por_admin = true
  where evento_id::text = p_evento_id
    and estado = 'activa';

  update public.eventos
  set estado = 'cerrado',
      closed_at = now()
  where id::text = p_evento_id
  returning * into v_evento;

  if v_evento.id is null then raise exception 'Evento no encontrado.'; end if;
  return to_jsonb(v_evento);
end;
$$;

create or replace function public.cuc_eliminar_evento(p_admin_token text, p_evento_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.cuc_assert_admin(p_admin_token);
  delete from public.eventos where id::text = p_evento_id;
  return true;
end;
$$;

create or replace function public.cuc_detalle_evento(p_admin_token text, p_evento_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_evento jsonb;
  v_sesiones jsonb;
  v_tickets jsonb;
begin
  perform public.cuc_assert_admin(p_admin_token);

  select to_jsonb(e) || jsonb_build_object('resumen', public.cuc_resumen_evento(e.id::text))
  into v_evento
  from public.eventos e
  where e.id::text = p_evento_id;

  if v_evento is null then raise exception 'Evento no encontrado.'; end if;

  select coalesce(jsonb_agg(to_jsonb(s) order by s.numero_sesion asc), '[]'::jsonb)
  into v_sesiones
  from public.sesiones s
  where s.evento_id::text = p_evento_id;

  select coalesce(jsonb_agg(to_jsonb(t) order by t."timestamp" asc), '[]'::jsonb)
  into v_tickets
  from public.tickets t
  where t.evento_id::text = p_evento_id;

  return jsonb_build_object('evento', v_evento, 'sesiones', v_sesiones, 'tickets', v_tickets);
end;
$$;

create or replace function public.cuc_crear_sesion(
  p_evento_id text,
  p_nombre text,
  p_apellido text,
  p_dni text,
  p_access_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_evento public.eventos%rowtype;
  v_existing public.sesiones%rowtype;
  v_sesion public.sesiones%rowtype;
  v_token text := encode(gen_random_bytes(32), 'hex');
  v_nombre text := public.cuc_clean_text(p_nombre, 60);
  v_apellido text := public.cuc_clean_text(p_apellido, 60);
  v_dni text := public.cuc_clean_digits(p_dni, 10);
  v_count int;
begin
  if length(v_nombre) < 2 then raise exception 'Ingresá un nombre válido.'; end if;
  if length(v_apellido) < 2 then raise exception 'Ingresá un apellido válido.'; end if;
  if v_dni !~ '^\d{6,10}$' then raise exception 'Ingresá un DNI válido.'; end if;

  select * into v_evento
  from public.eventos
  where id::text = p_evento_id;

  if v_evento.id is null or v_evento.estado <> 'activo' then raise exception 'Este partido ya no está activo.'; end if;
  if upper(coalesce(v_evento.password_evento, '')) <> upper(public.cuc_clean_text(p_access_code, 12)) then
    raise exception 'Contraseña incorrecta.';
  end if;

  select * into v_existing
  from public.sesiones
  where evento_id::text = p_evento_id
    and dni = v_dni
    and estado = 'activa'
  limit 1;

  if v_existing.id is not null then
    update public.sesiones
    set session_token = v_token
    where id::text = v_existing.id::text
    returning * into v_sesion;

    return jsonb_build_object('sesion', to_jsonb(v_sesion), 'session_token', v_token, 'reused', true);
  end if;

  select count(*) into v_count
  from public.sesiones
  where evento_id::text = p_evento_id;

  insert into public.sesiones (
    evento_id, nombre, apellido, dni, numero_sesion, estado,
    hora_inicio, hora_cierre, cerrada_por_admin, session_token
  )
  values (
    v_evento.id, v_nombre, v_apellido, v_dni, v_count + 1, 'activa',
    now(), null, false, v_token
  )
  returning * into v_sesion;

  return jsonb_build_object('sesion', to_jsonb(v_sesion), 'session_token', v_token, 'reused', false);
end;
$$;

create or replace function public.cuc_assert_sesion(p_sesion_id text, p_session_token text, p_require_active boolean default true)
returns public.sesiones
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_sesion public.sesiones%rowtype;
begin
  select * into v_sesion
  from public.sesiones
  where id::text = p_sesion_id
    and session_token = p_session_token;

  if v_sesion.id is null then raise exception 'La sesión no está habilitada.'; end if;
  if p_require_active and v_sesion.estado <> 'activa' then raise exception 'La sesión no está habilitada.'; end if;

  return v_sesion;
end;
$$;

create or replace function public.cuc_resumen_sesion(p_sesion_id text, p_session_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_sesion public.sesiones%rowtype;
begin
  v_sesion := public.cuc_assert_sesion(p_sesion_id, p_session_token, false);
  return jsonb_build_object(
    'sesion', to_jsonb(v_sesion),
    'resumen', public.cuc_resumen_sesion_privado(p_sesion_id)
  );
end;
$$;

create or replace function public.cuc_check_duplicado(
  p_evento_id text,
  p_numero text,
  p_sesion_id text,
  p_session_token text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_sesion public.sesiones%rowtype;
  v_ticket public.tickets%rowtype;
  v_cobrador public.sesiones%rowtype;
  v_numero text := public.cuc_clean_digits(p_numero, 8);
begin
  v_sesion := public.cuc_assert_sesion(p_sesion_id, p_session_token, true);
  if v_sesion.evento_id::text <> p_evento_id then raise exception 'La sesión no está habilitada.'; end if;
  if v_numero = '' then return null; end if;

  select * into v_ticket
  from public.tickets
  where evento_id::text = p_evento_id
    and numero_ticket = v_numero
    and coalesce(eliminado, false) = false
  order by "timestamp" asc
  limit 1;

  if v_ticket.id is null then return null; end if;

  select * into v_cobrador
  from public.sesiones
  where id::text = v_ticket.sesion_id::text
  limit 1;

  return jsonb_build_object('ticket', to_jsonb(v_ticket), 'sesion', to_jsonb(v_cobrador));
end;
$$;

create or replace function public.cuc_registrar_ticket(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sesion public.sesiones%rowtype;
  v_evento public.eventos%rowtype;
  v_ticket public.tickets%rowtype;
  v_metodo text := public.cuc_clean_text(p_payload->>'metodo_pago', 30);
  v_numero text := nullif(public.cuc_clean_digits(p_payload->>'numero_ticket', 8), '');
  v_libre_nombre text;
  v_libre_patente text;
  v_libre_motivo text;
  v_libre_descripcion text;
begin
  v_sesion := public.cuc_assert_sesion(p_payload->>'sesion_id', p_payload->>'session_token', true);

  select * into v_evento
  from public.eventos
  where id::text = v_sesion.evento_id::text;

  if v_evento.id is null or v_evento.estado <> 'activo' then raise exception 'El partido ya fue cerrado.'; end if;
  if v_metodo not in ('efectivo', 'transferencia', 'libre') then raise exception 'Seleccioná un método de pago válido.'; end if;

  if v_metodo <> 'libre' then
    if v_numero is null or v_numero !~ '^\d{1,8}$' then raise exception 'Ingresá un número de ticket válido.'; end if;
    if exists (
      select 1 from public.tickets
      where evento_id::text = v_evento.id::text
        and numero_ticket = v_numero
        and coalesce(eliminado, false) = false
    ) then
      raise exception 'Ese ticket ya fue registrado.';
    end if;
  end if;

  if v_metodo = 'libre' then
    v_libre_nombre := public.cuc_clean_text(p_payload->>'libre_nombre', 80);
    v_libre_patente := upper(public.cuc_clean_text(p_payload->>'libre_patente', 12));
    v_libre_motivo := public.cuc_clean_text(p_payload->>'libre_motivo', 80);
    v_libre_descripcion := nullif(public.cuc_clean_text(p_payload->>'libre_descripcion', 120), '');

    if length(v_libre_nombre) < 2 then raise exception 'Ingresá el nombre del pase libre.'; end if;
    if v_libre_patente !~ '^[A-Z0-9 -]{3,12}$' then raise exception 'Ingresá una patente válida.'; end if;
    if length(v_libre_motivo) < 2 then raise exception 'Ingresá el motivo del pase libre.'; end if;
  end if;

  insert into public.tickets (
    evento_id, sesion_id, numero_ticket, metodo_pago, monto,
    libre_nombre, libre_patente, libre_motivo, libre_descripcion,
    eliminado, "timestamp"
  )
  values (
    v_evento.id, v_sesion.id, case when v_metodo = 'libre' then null else v_numero end, v_metodo,
    case when v_metodo = 'libre' then 0 else v_evento.precio_entrada end,
    v_libre_nombre, v_libre_patente, v_libre_motivo, v_libre_descripcion,
    false, now()
  )
  returning * into v_ticket;

  return to_jsonb(v_ticket);
end;
$$;

create or replace function public.cuc_cerrar_sesion(p_sesion_id text, p_session_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sesion public.sesiones%rowtype;
begin
  perform public.cuc_assert_sesion(p_sesion_id, p_session_token, true);

  update public.sesiones
  set estado = 'finalizada',
      hora_cierre = now(),
      cerrada_por_admin = false
  where id::text = p_sesion_id
  returning * into v_sesion;

  return to_jsonb(v_sesion);
end;
$$;

create or replace function public.cuc_borrar_ultimo_ticket_sesion(p_sesion_id text, p_session_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.tickets%rowtype;
begin
  perform public.cuc_assert_sesion(p_sesion_id, p_session_token, true);

  select * into v_ticket
  from public.tickets
  where sesion_id::text = p_sesion_id
    and coalesce(eliminado, false) = false
  order by "timestamp" desc
  limit 1;

  if v_ticket.id is null then raise exception 'No tenés tickets registrados para borrar.'; end if;

  update public.tickets
  set eliminado = true,
      deleted_at = now()
  where id::text = v_ticket.id::text
  returning * into v_ticket;

  return to_jsonb(v_ticket);
end;
$$;

create or replace function public.cuc_borrar_ultimo_ticket(p_admin_token text, p_evento_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.tickets%rowtype;
begin
  perform public.cuc_assert_admin(p_admin_token);

  select * into v_ticket
  from public.tickets
  where evento_id::text = p_evento_id
    and coalesce(eliminado, false) = false
  order by "timestamp" desc
  limit 1;

  if v_ticket.id is null then raise exception 'No tenés tickets registrados para borrar.'; end if;

  update public.tickets
  set eliminado = true,
      deleted_at = now()
  where id::text = v_ticket.id::text
  returning * into v_ticket;

  return to_jsonb(v_ticket);
end;
$$;

grant execute on function public.cuc_login_admin(text, text) to anon, authenticated;
grant execute on function public.cuc_eventos_activos() to anon, authenticated;
grant execute on function public.cuc_crear_sesion(text, text, text, text, text) to anon, authenticated;
grant execute on function public.cuc_resumen_sesion(text, text) to anon, authenticated;
grant execute on function public.cuc_check_duplicado(text, text, text, text) to anon, authenticated;
grant execute on function public.cuc_registrar_ticket(jsonb) to anon, authenticated;
grant execute on function public.cuc_cerrar_sesion(text, text) to anon, authenticated;
grant execute on function public.cuc_borrar_ultimo_ticket_sesion(text, text) to anon, authenticated;

grant execute on function public.cuc_todos_eventos(text) to anon, authenticated;
grant execute on function public.cuc_crear_evento(text, jsonb) to anon, authenticated;
grant execute on function public.cuc_cerrar_evento(text, text) to anon, authenticated;
grant execute on function public.cuc_eliminar_evento(text, text) to anon, authenticated;
grant execute on function public.cuc_detalle_evento(text, text) to anon, authenticated;
grant execute on function public.cuc_borrar_ultimo_ticket(text, text) to anon, authenticated;
