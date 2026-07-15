create extension if not exists pgcrypto;

create table if not exists public.processos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  numero_processo text not null check (numero_processo ~ '^[A-Z0-9]+$'),
  atuacao text not null default 'Titularidade' check (atuacao in ('Titularidade', 'Substituição')),
  tipo text not null check (tipo in ('Inquérito', 'Ação Penal', 'Medida Cautelar')),
  subtipo text not null,
  data_prazo date not null,
  criado_em timestamptz not null default now()
);

-- Migração segura para projetos que já possuíam a tabela.
alter table public.processos add column if not exists atuacao text not null default 'Titularidade';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'processos_atuacao_check') then
    alter table public.processos add constraint processos_atuacao_check
      check (atuacao in ('Titularidade', 'Substituição'));
  end if;
end $$;

create index if not exists processos_user_prazo_idx on public.processos (user_id, data_prazo);
alter table public.processos enable row level security;

drop policy if exists "usuarios leem seus processos" on public.processos;
drop policy if exists "usuarios criam seus processos" on public.processos;
drop policy if exists "usuarios excluem seus processos" on public.processos;
drop policy if exists "equipe le acervo compartilhado" on public.processos;
drop policy if exists "equipe cria no acervo compartilhado" on public.processos;
drop policy if exists "equipe exclui do acervo compartilhado" on public.processos;

-- Acervo único: qualquer usuário autenticado neste projeto integra a equipe.
-- O user_id registra quem incluiu o processo, sem restringir a leitura da equipe.
create policy "equipe le acervo compartilhado" on public.processos
  for select to authenticated using (true);
create policy "equipe cria no acervo compartilhado" on public.processos
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "equipe exclui do acervo compartilhado" on public.processos
  for delete to authenticated using (true);

-- Habilita eventos de inclusão e exclusão para as telas conectadas.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'processos'
  ) then
    alter publication supabase_realtime add table public.processos;
  end if;
end $$;
