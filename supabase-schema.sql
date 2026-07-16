create extension if not exists pgcrypto;
create extension if not exists pg_net with schema extensions;

create table if not exists public.processos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  numero_processo text not null check (numero_processo ~ '^[A-Z0-9]+$'),
  atuacao text not null default 'Titularidade' check (atuacao in ('Titularidade', 'Substituição')),
  tipo text not null check (tipo in ('Inquérito', 'APF', 'Ação Penal', 'Medida Cautelar')),
  subtipo text not null,
  situacao_pessoa text not null default 'Solto' check (situacao_pessoa in ('Preso', 'Solto')),
  situacao_envio text not null default 'Pendente' check (situacao_envio in ('Pendente', 'Enviado')),
  data_prazo date not null,
  criado_em timestamptz not null default now()
);

-- Migração segura para projetos que já possuíam a tabela.
alter table public.processos add column if not exists atuacao text not null default 'Titularidade';
alter table public.processos add column if not exists situacao_pessoa text not null default 'Solto';
alter table public.processos add column if not exists situacao_envio text not null default 'Pendente';
alter table public.processos drop constraint if exists processos_tipo_check;
alter table public.processos add constraint processos_tipo_check
  check (tipo in ('Inquérito', 'APF', 'Ação Penal', 'Medida Cautelar'));
alter table public.processos drop constraint if exists processos_situacao_pessoa_check;
alter table public.processos add constraint processos_situacao_pessoa_check
  check (situacao_pessoa in ('Preso', 'Solto'));
alter table public.processos drop constraint if exists processos_situacao_envio_check;
alter table public.processos add constraint processos_situacao_envio_check
  check (situacao_envio in ('Pendente', 'Enviado'));
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
drop policy if exists "equipe atualiza acervo compartilhado" on public.processos;
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
create policy "equipe atualiza acervo compartilhado" on public.processos
  for update to authenticated using (true) with check (true);

-- Para ativar o Telegram, crie no Supabase Vault os segredos
-- telegram_bot_token e telegram_chat_id. Nunca coloque os valores neste arquivo.
create or replace function public.notificar_telegram_processo_enviado()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  bot_token text;
  chat_id text;
  mensagem text;
begin
  if old.situacao_envio is distinct from 'Enviado'
     and new.situacao_envio = 'Enviado' then
    select decrypted_secret into bot_token
      from vault.decrypted_secrets where name = 'telegram_bot_token' limit 1;
    select decrypted_secret into chat_id
      from vault.decrypted_secrets where name = 'telegram_chat_id' limit 1;

    if bot_token is null or chat_id is null then
      raise warning 'Telegram não configurado: segredos ausentes no Vault.';
      return new;
    end if;

    mensagem := concat(
      'Processo marcado como enviado', E'\n',
      'Número: ', new.numero_processo, E'\n',
      'Atuação: ', new.atuacao, E'\n',
      'Tipo: ', new.tipo, ' — ', new.subtipo, E'\n',
      'Situação: ', new.situacao_pessoa, E'\n',
      'Prazo: ', to_char(new.data_prazo, 'DD/MM/YYYY')
    );

    perform net.http_post(
      url := 'https://api.telegram.org/bot' || bot_token || '/sendMessage',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('chat_id', chat_id, 'text', mensagem),
      timeout_milliseconds := 15000
    );
  end if;
  return new;
end;
$$;

revoke all on function public.notificar_telegram_processo_enviado() from public, anon, authenticated;

drop trigger if exists processos_notifica_telegram_enviado on public.processos;
create trigger processos_notifica_telegram_enviado
  after update of situacao_envio on public.processos
  for each row execute function public.notificar_telegram_processo_enviado();

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
