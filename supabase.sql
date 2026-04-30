create table if not exists public.eventos (
  id text primary key,
  nombre text not null,
  "equipoLocal" text,
  "equipoVisitante" text,
  fecha text,
  categoria text,
  monto numeric not null,
  alias text,
  cobradores jsonb default '[]',
  estado text not null default 'ACTIVO',
  "creadoEn" timestamptz default now(),
  "finalizadoEn" timestamptz
);

create table if not exists public.tickets (
  id text primary key,
  "eventoId" text not null references public.eventos(id) on delete cascade,
  "numeroTicket" text not null,
  "metodoPago" text not null,
  "cobradorNombre" text,
  "cobradorDocumento" text,
  patente text,
  "nombreGratis" text,
  "razonGratis" text,
  "creadoEn" timestamptz default now(),
  unique ("eventoId", "numeroTicket")
);

alter table public.eventos enable row level security;
alter table public.tickets enable row level security;

drop policy if exists "lectura publica eventos" on public.eventos;
drop policy if exists "insert publico eventos" on public.eventos;
drop policy if exists "update publico eventos" on public.eventos;
drop policy if exists "delete publico eventos" on public.eventos;

drop policy if exists "lectura publica tickets" on public.tickets;
drop policy if exists "insert publico tickets" on public.tickets;
drop policy if exists "delete publico tickets" on public.tickets;

create policy "lectura publica eventos"
on public.eventos for select
to anon
using (true);

create policy "insert publico eventos"
on public.eventos for insert
to anon
with check (true);

create policy "update publico eventos"
on public.eventos for update
to anon
using (true)
with check (true);

create policy "delete publico eventos"
on public.eventos for delete
to anon
using (true);

create policy "lectura publica tickets"
on public.tickets for select
to anon
using (true);

create policy "insert publico tickets"
on public.tickets for insert
to anon
with check (true);

create policy "delete publico tickets"
on public.tickets for delete
to anon
using (true);
