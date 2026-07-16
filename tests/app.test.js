const assert = require('node:assert/strict');
const fs = require('node:fs');
const { SUBTIPOS, normalizeNumero, formatNumero, isValidNumero, filterByDate, filterByAtuacao } = require('../app.js');

assert.deepEqual(SUBTIPOS['Inquérito'], ['Declínio', 'Arquivamento', 'Retorno à DEPOL']);
assert.deepEqual(SUBTIPOS.APF, ['Não se aplica']);
assert.deepEqual(SUBTIPOS['Ação Penal'], ['Ciência', 'Manifestação', 'ANPP', 'Alegações Finais', 'Recursos']);
assert.deepEqual(SUBTIPOS['Medida Cautelar'], ['Ciência', 'Diligência', 'Manifestação']);
assert.notDeepEqual(SUBTIPOS['Inquérito'], SUBTIPOS['Ação Penal'], 'A troca de tipo deve trocar imediatamente o conjunto de subtipos');

const items = [
  { id: 1, data_prazo: '2026-01-10' },
  { id: 2, data_prazo: '2026-02-15' },
  { id: 3, data_prazo: '2026-03-20' }
];
assert.deepEqual(filterByDate(items, '2026-02-01', '2026-02-28').map(p => p.id), [2], 'O relatório deve ocultar prazos fora do intervalo');
const porAtuacao = [{ id: 1, atuacao: 'Titularidade' }, { id: 2, atuacao: 'Substituição' }];
assert.deepEqual(filterByAtuacao(porAtuacao, 'Substituição').map(p => p.id), [2], 'O relatório deve separar titularidade e substituição');
assert.equal(normalizeNumero('8120938-59.2026.8.05.0001'), '81209385920268050001');
assert.equal(formatNumero('81209385920268050001'), '8120938-59.2026.8.05.0001');
assert.equal(normalizeNumero('003.9.323097/2026'), '00393230972026');
assert.equal(formatNumero('00393230972026'), '003.9.323097/2026');
assert.equal(isValidNumero('8120938-59.2026.8.05.0001'), true);
assert.equal(isValidNumero('003.9.323097/2026'), true);
assert.equal(isValidNumero('12345'), false);

const source = fs.readFileSync(require.resolve('../app.js'), 'utf8');
assert.match(source, /channel\('acervo-processos'\)/, 'O aplicativo deve assinar o canal Realtime do acervo');
assert.match(source, /event: '\*', schema: 'public', table: 'processos'/, 'O canal deve acompanhar todas as mudanças em processos');
assert.doesNotMatch(source, /select\('\*'\)\.eq\('user_id'/, 'A consulta não deve limitar o acervo ao criador do registro');
assert.match(source, /text-red-700[^<]*">Preso/, 'A situação Preso deve ser exibida em vermelho');
assert.match(source, /data-mark-sent=/, 'Processos pendentes devem oferecer a ação Marcar como enviado');
assert.match(source, /update\(\{ situacao_envio: 'Enviado' \}\)/, 'A ação deve atualizar o processo para Enviado');

const schema = fs.readFileSync(require.resolve('../supabase-schema.sql'), 'utf8');
assert.match(schema, /for update to authenticated/, 'Usuários autenticados devem poder marcar processos como enviados');
assert.match(schema, /telegram_bot_token/, 'O token do Telegram deve ser lido do Supabase Vault');
assert.match(schema, /timeout_milliseconds := 15000/, 'O Telegram deve tolerar latência de até 15 segundos');
assert.doesNotMatch(schema, /bot\d+:[A-Za-z0-9_-]+/, 'O schema não deve conter token real de bot');
console.log('Todos os testes passaram.');
