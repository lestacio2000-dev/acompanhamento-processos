# Acompanhamento de Processos

PWA estática multiusuário, integrada diretamente ao Supabase.

## Configuração

1. Crie um projeto no Supabase e execute `supabase-schema.sql` no SQL Editor.
2. Sirva esta pasta por HTTP (por exemplo, `python3 -m http.server 8080`).
3. Abra `http://localhost:8080`, informe a URL do projeto e a chave pública `anon`.
4. Cadastre um usuário. Se a confirmação de e-mail estiver ativa, confirme antes de entrar.

Para recuperar uma senha, informe o e-mail no formulário e clique em **Esqueci minha senha**. Abra o link recebido no mesmo computador para definir a nova senha. Em produção, cadastre a URL publicada em **Authentication > URL Configuration > Redirect URLs** no painel do Supabase.

Nunca use a chave `service_role` no aplicativo. O isolamento entre usuários é garantido pelas políticas RLS e reforçado pelos filtros explícitos no cliente.

## Dados aceitos

- CNJ: `8120938-59.2026.8.05.0001`
- IDEA/MPBA: `003.9.323097/2026`
- Planilha: colunas `Numero`, `Tipo`, `Subtipo` e `Prazo`.

Os sinais dos números são removidos antes da gravação e recompostos na exibição. Isso permite pesquisa e armazenamento consistentes sem perder o padrão visual oficial.

## Testes

Execute `node tests/app.test.js`.
