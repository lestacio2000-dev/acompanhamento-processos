# Acompanhamento de Processos

PWA estática multiusuário, integrada diretamente ao Supabase, com acervo institucional compartilhado e atualização em tempo real.

## Configuração

1. Crie um projeto no Supabase e execute `supabase-schema.sql` no SQL Editor.
2. Sirva esta pasta por HTTP (por exemplo, `python3 -m http.server 8080`).
3. Abra `http://localhost:8080`. A URL e a Publishable key já estão configuradas no cliente; a tela técnica só aparece se a conexão automática falhar.
4. Cadastre um usuário. Se a confirmação de e-mail estiver ativa, confirme antes de entrar.

Para recuperar uma senha, informe o e-mail no formulário e clique em **Esqueci minha senha**. Abra o link recebido no mesmo computador para definir a nova senha. Em produção, cadastre a URL publicada em **Authentication > URL Configuration > Redirect URLs** no painel do Supabase.

Nunca use a chave `service_role` no aplicativo. As políticas RLS permitem acesso ao acervo somente a usuários autenticados. Cada pessoa usa seu próprio login, mas todos os usuários cadastrados neste projeto Supabase compartilham os mesmos processos.

> Segurança: como todos os usuários autenticados integram o acervo, desative novos cadastros públicos em produção e crie manualmente apenas os usuários autorizados do gabinete.

## Dados aceitos

- CNJ: `8120938-59.2026.8.05.0001`
- IDEA/MPBA: `003.9.323097/2026`
- Planilha: colunas `Numero`, `Atuacao`, `Tipo`, `Subtipo`, `SituacaoPessoa`, `SituacaoEnvio`, `Prazo` e, opcionalmente, `Observacao`. Em `Atuacao`, use `Titularidade` ou `Substituição`; em `SituacaoPessoa`, `Preso` ou `Solto`; em `SituacaoEnvio`, `Pendente` ou `Enviado`; e limite `Observacao` a 100 caracteres.

O tipo `Inquérito` oferece os subtipos `Declínio`, `Arquivamento`, `Retorno à DEPOL`, `Diligência_Secretaria`, `audiencia ANPP` e `Denúncia`. O tipo `APF` oferece `Ciência` e `Manifestação`. O tipo `Ação Penal` também oferece `Relaxamento` e `Revogação`. A situação `Preso` aparece em vermelho nas listagens e nos relatórios.

Cada processo listado possui a ação **Editar**. Ela carrega o registro no formulário, permitindo alterar a situação da pessoa entre `Preso` e `Solto`, os demais campos e a observação livre de até 100 caracteres, sem criar um novo registro.

Processos pendentes exibem a ação **Marcar como enviado**. A alteração é compartilhada em tempo real e pode disparar uma mensagem pelo Telegram.

## Notificação pelo Telegram

1. Crie o bot pelo `@BotFather` e adicione-o à conversa ou ao grupo destinatário.
2. Descubra o `chat_id` da conversa.
3. No Supabase Vault, crie `telegram_bot_token` com o token do bot e `telegram_chat_id` com o identificador da conversa.
4. Execute novamente `supabase-schema.sql` no SQL Editor para instalar a política de atualização e o gatilho.
5. Cadastre um processo como `Pendente` e use **Marcar como enviado** para testar.

O token é secreto: não o coloque em `app.js`, neste README, no GitHub ou em qualquer arquivo publicado. Se os segredos ainda não estiverem configurados, o processo será atualizado normalmente e nenhuma mensagem será enviada.

O envio é assíncrono pelo `pg_net`, com timeout de 15 segundos para acomodar oscilações de rede entre o Supabase e a API do Telegram.

O acervo é separado logicamente entre **Titularidade — 3ª Promotoria de Tóxicos/4º Promotor** e **Substituição — 3ª Promotoria de Tóxicos/1º Promotor**. A lista identifica a atuação e o relatório permite consultar uma delas ou ambas.

Os sinais dos números são removidos antes da gravação e recompostos na exibição. Isso permite pesquisa e armazenamento consistentes sem perder o padrão visual oficial.

## Testes

Execute `node tests/app.test.js`.
