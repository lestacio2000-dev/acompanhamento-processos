(() => {
  'use strict';

  // A Publishable key é própria para clientes públicos. A segurança dos dados
  // permanece sob responsabilidade do login e das políticas RLS do Supabase.
  const DEFAULT_SUPABASE_URL = 'https://uyukkhfjmpvhkiuftmob.supabase.co';
  const DEFAULT_SUPABASE_KEY = 'sb_publishable_O1y_D3brXF3twhpWhZQ9RQ_mRtIX3yT';

  const SUBTIPOS = Object.freeze({
    'Inquérito': ['Declínio', 'Arquivamento', 'Retorno à DEPOL', 'Diligência_Secretaria', 'audiencia ANPP'],
    'APF': ['Não se aplica'],
    'Ação Penal': ['Ciência', 'Manifestação', 'ANPP', 'Alegações Finais', 'Recursos'],
    'Medida Cautelar': ['Ciência', 'Diligência', 'Manifestação']
  });

  const normalizeNumero = value => String(value ?? '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const formatNumero = value => {
    const normalized = normalizeNumero(value);
    if (/^\d{20}$/.test(normalized)) return normalized.replace(/^(\d{7})(\d{2})(\d{4})(\d)(\d{2})(\d{4})$/, '$1-$2.$3.$4.$5.$6');
    if (/^\d{14}$/.test(normalized)) return normalized.replace(/^(\d{3})(\d)(\d{6})(\d{4})$/, '$1.$2.$3/$4');
    return String(value ?? '').trim();
  };
  const isValidNumero = value => /^\d{20}$|^\d{14}$/.test(normalizeNumero(value));
  const isoDate = value => {
    if (typeof value === 'number' && globalThis.XLSX) {
      const d = XLSX.SSF.parse_date_code(value);
      return d ? `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}` : '';
    }
    const raw = String(value ?? '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const match = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : '';
  };
  const filterByDate = (items, start, end) => items.filter(item => (!start || item.data_prazo >= start) && (!end || item.data_prazo <= end));
  const filterByAtuacao = (items, atuacao) => items.filter(item => !atuacao || item.atuacao === atuacao);
  const pessoaHtml = value => value === 'Preso' ? '<span class="font-semibold text-red-700">Preso</span>' : escapeHtml(value);

  if (typeof module !== 'undefined' && module.exports) module.exports = { SUBTIPOS, normalizeNumero, formatNumero, isValidNumero, isoDate, filterByDate, filterByAtuacao };
  if (typeof document === 'undefined') return;

  const $ = id => document.getElementById(id);
  let db = null;
  let currentUser = null;
  let processos = [];
  let recoveringPassword = false;
  let realtimeChannel = null;

  function status(message, error = false) {
    const box = $('status');
    box.textContent = message;
    box.hidden = false;
    box.className = `rounded-lg border px-4 py-3 text-sm ${error ? 'border-red-300 bg-red-50 text-red-800' : 'border-emerald-300 bg-emerald-50 text-emerald-800'}`;
  }

  function setView(user) {
    currentUser = user;
    $('newPasswordSection').hidden = !recoveringPassword;
    $('authSection').hidden = !!user || recoveringPassword;
    $('appSection').hidden = !user || recoveringPassword;
    $('logoutBtn').hidden = !user || recoveringPassword;
    if (user) {
      loadProcessos();
      subscribeToProcessos();
    } else {
      if (realtimeChannel && db) db.removeChannel(realtimeChannel);
      realtimeChannel = null;
      processos = [];
      render();
    }
  }

  function subscribeToProcessos() {
    if (!db || realtimeChannel) return;
    realtimeChannel = db.channel('acervo-processos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'processos' }, () => loadProcessos())
      .subscribe(statusValue => {
        if (statusValue === 'CHANNEL_ERROR') status('Não foi possível ativar a atualização em tempo real.', true);
      });
  }

  async function connect(url, key) {
    if (!globalThis.supabase?.createClient) throw new Error('SDK do Supabase indisponível. Verifique a conexão.');
    db = globalThis.supabase.createClient(url, key);
    localStorage.setItem('processos.supabaseUrl', url);
    localStorage.setItem('processos.supabaseKey', key);
    const { data, error } = await db.auth.getSession();
    if (error) throw error;
    $('configSection').hidden = true;
    $('authSection').hidden = !!data.session?.user;
    db.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        recoveringPassword = true;
        status('Link confirmado. Agora defina sua nova senha.');
      }
      setView(session?.user ?? null);
    });
    setView(data.session?.user ?? null);
  }

  async function loadProcessos() {
    if (!currentUser) return;
    const { data, error } = await db.from('processos').select('*').order('data_prazo');
    if (error) return status(error.message, true);
    processos = data ?? [];
    render();
  }

  function escapeHtml(value) {
    const div = document.createElement('div'); div.textContent = String(value ?? ''); return div.innerHTML;
  }
  const formatDate = date => date ? new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR') : '—';

  function render() {
    const filtered = filterByAtuacao(filterByDate(processos, $('dataInicio').value, $('dataFim').value), $('reportAtuacao').value);
    $('reportBody').innerHTML = filtered.length ? filtered.map(p => `<tr class="border-b"><td class="p-3">${escapeHtml(formatNumero(p.numero_processo))}</td><td class="p-3">${escapeHtml(p.atuacao)}</td><td class="p-3">${escapeHtml(p.tipo)}</td><td class="p-3">${escapeHtml(p.subtipo)}</td><td class="p-3">${pessoaHtml(p.situacao_pessoa)}</td><td class="p-3">${escapeHtml(p.situacao_envio)}</td><td class="p-3">${formatDate(p.data_prazo)}</td></tr>`).join('') : '<tr><td colspan="7" class="p-6 text-center text-slate-500">Nenhum prazo nos filtros selecionados.</td></tr>';
    const activeList = filterByAtuacao(processos, $('listAtuacao').value);
    $('processList').innerHTML = activeList.length ? activeList.map(p => `<article class="flex flex-col justify-between gap-3 rounded-lg border border-slate-200 p-4 sm:flex-row sm:items-center"><div><strong>${escapeHtml(formatNumero(p.numero_processo))}</strong><p class="text-sm font-medium text-slate-700">${escapeHtml(p.atuacao)} — 3ª Promotoria de Tóxicos</p><p class="text-sm text-slate-600">${escapeHtml(p.tipo)} · ${escapeHtml(p.subtipo)} · ${pessoaHtml(p.situacao_pessoa)} · ${escapeHtml(p.situacao_envio)} · prazo ${formatDate(p.data_prazo)}</p></div><div class="flex flex-wrap gap-2">${p.situacao_envio === 'Pendente' ? `<button data-mark-sent="${p.id}" class="rounded-lg bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800">Marcar como enviado</button>` : ''}<button data-delete="${p.id}" class="rounded-lg bg-red-700 px-3 py-2 text-sm font-medium text-white">Excluir Processo</button></div></article>`).join('') : '<p class="text-sm text-slate-500">Nenhum processo neste acervo.</p>';
  }

  function updateSubtipos() {
    const options = SUBTIPOS[$('tipo').value] ?? [];
    $('subtipo').innerHTML = '<option value="">Selecione</option>' + options.map(v => `<option>${v}</option>`).join('');
    $('subtipo').disabled = !options.length;
  }

  $('configForm').addEventListener('submit', async event => {
    event.preventDefault();
    try { await connect($('supabaseUrl').value.trim(), $('supabaseKey').value.trim()); status('Conexão configurada.'); } catch (error) { status(error.message, true); }
  });

  $('authForm').addEventListener('click', async event => {
    const action = event.target.dataset.auth;
    if (!action) return;
    event.preventDefault();
    if (!$('authForm').reportValidity()) return;
    const credentials = { email: $('email').value.trim(), password: $('password').value };
    const result = action === 'signup' ? await db.auth.signUp(credentials) : await db.auth.signInWithPassword(credentials);
    if (result.error) status(result.error.message, true); else status(action === 'signup' && !result.data.session ? 'Cadastro realizado. Confirme o e-mail para entrar.' : 'Autenticação realizada.');
  });

  $('forgotPasswordBtn').addEventListener('click', async () => {
    const email = $('email').value.trim();
    if (!email || !$('email').checkValidity()) {
      $('email').reportValidity();
      return status('Informe seu e-mail para receber o link de recuperação.', true);
    }
    const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}${location.pathname}` });
    if (error) return status(error.message, true);
    status('E-mail de recuperação enviado. Verifique também a pasta de spam.');
  });

  $('newPasswordForm').addEventListener('submit', async event => {
    event.preventDefault();
    const password = $('newPassword').value;
    if (password !== $('confirmNewPassword').value) return status('As senhas não coincidem.', true);
    const { error } = await db.auth.updateUser({ password });
    if (error) return status(error.message, true);
    recoveringPassword = false;
    event.target.reset();
    status('Senha alterada com sucesso.');
    const { data } = await db.auth.getUser();
    setView(data.user ?? null);
  });

  $('logoutBtn').addEventListener('click', () => db?.auth.signOut());
  $('tipo').addEventListener('change', updateSubtipos);
  $('situacaoPessoa').addEventListener('change', event => {
    event.target.classList.toggle('font-semibold', event.target.value === 'Preso');
    event.target.classList.toggle('text-red-700', event.target.value === 'Preso');
  });
  $('numero').addEventListener('blur', event => { event.target.value = formatNumero(event.target.value); });

  $('processForm').addEventListener('submit', async event => {
    event.preventDefault();
    const row = { user_id: currentUser.id, numero_processo: normalizeNumero($('numero').value), atuacao: $('atuacao').value, tipo: $('tipo').value, subtipo: $('subtipo').value, situacao_pessoa: $('situacaoPessoa').value, situacao_envio: $('situacaoEnvio').value, data_prazo: $('dataPrazo').value };
    if (!isValidNumero($('numero').value)) return status('Número inválido. Use o padrão CNJ 8120938-59.2026.8.05.0001 ou IDEA 003.9.323097/2026.', true);
    const { error } = await db.from('processos').insert(row);
    if (error) return status(error.message, true);
    event.target.reset(); updateSubtipos(); status('Processo cadastrado.'); await loadProcessos();
  });

  $('processList').addEventListener('click', async event => {
    const sentId = event.target.dataset.markSent;
    if (sentId) {
      if (!confirm('Marcar este processo como enviado?')) return;
      const { error } = await db.from('processos').update({ situacao_envio: 'Enviado' }).eq('id', sentId);
      if (error) return status(error.message, true);
      status('Processo marcado como enviado. A notificação será disparada se o Telegram estiver configurado.');
      return loadProcessos();
    }
    const id = event.target.dataset.delete;
    if (!id || !confirm('Excluir este processo definitivamente?')) return;
    const { error } = await db.from('processos').delete().eq('id', id);
    if (error) return status(error.message, true);
    status('Processo excluído.'); await loadProcessos();
  });

  $('xlsxInput').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const raw = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
      const rows = raw.map((r, index) => ({
        user_id: currentUser.id, numero_processo: normalizeNumero(r.Numero), atuacao: String(r.Atuacao ?? r.Atuação).trim(), tipo: String(r.Tipo).trim(), subtipo: String(r.Subtipo).trim(), situacao_pessoa: String(r.SituacaoPessoa ?? r['SituaçãoPessoa']).trim(), situacao_envio: String(r.SituacaoEnvio ?? r['SituaçãoEnvio']).trim(), data_prazo: isoDate(r.Prazo), _line: index + 2
      }));
      const invalid = rows.find(r => !isValidNumero(r.numero_processo) || !['Titularidade', 'Substituição'].includes(r.atuacao) || !SUBTIPOS[r.tipo]?.includes(r.subtipo) || !['Preso', 'Solto'].includes(r.situacao_pessoa) || !['Pendente', 'Enviado'].includes(r.situacao_envio) || !r.data_prazo);
      if (invalid) throw new Error(`Dados inválidos na linha ${invalid._line}. Confira Numero, Atuacao, Tipo, Subtipo, SituacaoPessoa, SituacaoEnvio e Prazo.`);
      if (!rows.length) throw new Error('A planilha não contém registros.');
      rows.forEach(r => delete r._line);
      const { error } = await db.from('processos').insert(rows);
      if (error) throw error;
      status(`${rows.length} processo(s) importado(s).`); await loadProcessos();
    } catch (error) { status(error.message, true); }
    finally { event.target.value = ''; }
  });

  $('dataInicio').addEventListener('change', render);
  $('dataFim').addEventListener('change', render);
  $('reportAtuacao').addEventListener('change', render);
  $('listAtuacao').addEventListener('change', render);
  $('printBtn').addEventListener('click', () => window.print());

  const savedUrl = localStorage.getItem('processos.supabaseUrl') || DEFAULT_SUPABASE_URL;
  const savedKey = localStorage.getItem('processos.supabaseKey') || DEFAULT_SUPABASE_KEY;
  $('supabaseUrl').value = savedUrl;
  $('supabaseKey').value = savedKey;
  connect(savedUrl, savedKey).catch(error => {
    $('configSection').hidden = false;
    status(`Não foi possível conectar automaticamente: ${error.message}`, true);
  });
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
})();
