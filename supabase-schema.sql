create extension if not exists pgcrypto;

create table if not exists public.processos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  numero_processo text not null check (numero_processo ~ '^[A-Z0-9]+$'),
  tipo text not null check (tipo in ('Inquérito', 'Ação Penal', 'Medida Cautelar')),
  subtipo text not null,
  data_prazo date not null,
  criado_em timestamptz not null default now()
);

create index if not exists processos_user_prazo_idx on public.processos (user_id, data_prazo);
alter table public.processos enable row level security;

drop policy if exists "usuarios leem seus processos" on public.processos;
drop policy if exists "usuarios criam seus processos" on public.processos;
drop policy if exists "usuarios excluem seus processos" on public.processos;
create policy "usuarios leem seus processos" on public.processos for select using ((select auth.uid()) = user_id);
create policy "usuarios criam seus processos" on public.processos for insert with check ((select auth.uid()) = user_id);
create policy "usuarios excluem seus processos" on public.processos for delete using ((select auth.uid()) = user_id);
