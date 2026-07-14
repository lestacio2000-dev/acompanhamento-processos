# Acompanhamento de Processos

PWA estática multiusuário, integrada diretamente ao Supabase, com acervo institucional compartilhado e atualização em tempo real.

## Configuração

1. Crie um projeto no Supabase e execute `supabase-schema.sql` no SQL Editor.
2. Sirva esta pasta por HTTP (por exemplo, `python3 -m http.server 8080`).
3. Abra `http://localhost:8080`, informe a URL do projeto e a chave pública `anon`.
4. Cadastre um usuário. Se a confirmação de e-mail estiver ativa, confirme antes de entrar.

Para recuperar uma senha, informe o e-mail no formulário e clique em **Esqueci minha senha**. Abra o link recebido no mesmo computador para definir a nova senha. Em produção, cadastre a URL publicada em **Authentication > URL Configuration > Redirect URLs** no painel do Supabase.

Nunca use a chave `service_role` no aplicativo. As políticas RLS permitem acesso ao acervo somente a usuários autenticados. Cada pessoa usa seu próprio login, mas todos os usuários cadastrados neste projeto Supabase compartilham os mesmos processos.

> Segurança: como todos os usuários autenticados integram o acervo, desative novos cadastros públicos em produção e crie manualmente apenas os usuários autorizados do gabinete.

## Dados aceitos

- CNJ: `8120938-59.2026.8.05.0001`
- IDEA/MPBA: `003.9.323097/2026`
- Planilha: colunas `Numero`, `Tipo`, `Subtipo` e `Prazo`.

Os sinais dos números são removidos antes da gravação e recompostos na exibição. Isso permite pesquisa e armazenamento consistentes sem perder o padrão visual oficial.

## Testes

Execute `node tests/app.test.js`.
