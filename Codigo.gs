/**
 * GOLDEN VISION · Servidor do app (Google Apps Script + Google Planilhas)
 *
 * Cole este código em Extensões > Apps Script da planilha "Golden Vision - Dados".
 * 1) Troque o PIN na função definirPin() abaixo, selecione "definirPin" e clique em Executar.
 * 2) Depois apague o número que você digitou e salve (o PIN fica guardado de forma protegida).
 * 3) Implantar > Nova implantação > App da Web · Executar como: Eu · Quem pode acessar: Qualquer pessoa.
 * 4) Copie o endereço que termina em /exec e cole no app, na tela do PIN.
 */

const ABA_DADOS = 'dados';
const COLECOES = ['proprietarios', 'imoveis', 'servicos', 'lancamentos', 'repasses', 'config'];
const MAX_TENTATIVAS = 5;          // erros de PIN antes de bloquear
const BLOQUEIO_MIN = 15;           // minutos de bloqueio
const SESSAO_CURTA_H = 12;         // "manter conectado" desmarcado
const SESSAO_LONGA_DIAS = 30;      // "manter conectado" marcado

/* ---------- configuração (rodar uma vez) ---------- */
function definirPin() {
  const PIN = '0000'; // <-- troque pelo PIN da equipe (só números, de 4 a 12 dígitos) e execute
  if (!/^\d{4,12}$/.test(PIN)) throw new Error('O PIN precisa ter de 4 a 12 números.');
  const props = PropertiesService.getScriptProperties();
  const sal = Utilities.getUuid();
  props.setProperty('PIN_SAL', sal);
  props.setProperty('PIN_HASH', hash_(sal + PIN));
  // derruba todas as sessões antigas
  Object.keys(props.getProperties()).filter(k => k.indexOf('S_') === 0).forEach(k => props.deleteProperty(k));
  aba_();
  Logger.log('PIN definido. Agora apague o número desta função e salve.');
}

/* ---------- entrada HTTP ---------- */
function doGet() {
  return ContentService.createTextOutput('Servidor da Golden Vision ativo.');
}
function doPost(e) {
  let out;
  try {
    const req = JSON.parse(e.postData.contents);
    const fn = API[req.fn];
    if (!fn) throw new Error('funcao_invalida');
    out = { ok: true, r: fn.apply(null, Array.isArray(req.args) ? req.args : []) };
  } catch (err) {
    out = { ok: false, err: String(err && err.message || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- funções chamadas pelo app ---------- */
const API = {
  entrar(pin, lembrar) {
    const props = PropertiesService.getScriptProperties();
    const cache = CacheService.getScriptCache();
    if (!props.getProperty('PIN_HASH')) return { ok: false, msg: 'O servidor ainda não tem PIN. Rode a função definirPin no Apps Script.' };
    const falhas = Number(cache.get('falhas') || 0);
    if (falhas >= MAX_TENTATIVAS) return { ok: false, msg: 'Muitas tentativas erradas. Aguarde ' + BLOQUEIO_MIN + ' minutos.' };
    if (typeof pin !== 'string' || hash_(props.getProperty('PIN_SAL') + pin) !== props.getProperty('PIN_HASH')) {
      cache.put('falhas', String(falhas + 1), BLOQUEIO_MIN * 60);
      const resta = MAX_TENTATIVAS - falhas - 1;
      return { ok: false, msg: resta > 0 ? 'PIN incorreto. ' + resta + (resta === 1 ? ' tentativa restante.' : ' tentativas restantes.') : 'Muitas tentativas erradas. Aguarde ' + BLOQUEIO_MIN + ' minutos.' };
    }
    cache.remove('falhas');
    limparSessoes_();
    const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    const expira = Date.now() + (lembrar ? SESSAO_LONGA_DIAS * 864e5 : SESSAO_CURTA_H * 36e5);
    props.setProperty('S_' + hash_(token), String(expira));
    return { ok: true, token: token };
  },
  carregar(tok) {
    sessao_(tok);
    const v = aba_().getDataRange().getValues();
    const docs = [];
    for (let i = 1; i < v.length; i++) if (v[i][0] && v[i][1]) docs.push({ col: String(v[i][0]), id: String(v[i][1]), json: String(v[i][2]) });
    return { docs: docs, versao: versao_() };
  },
  versao(tok) { sessao_(tok); return versao_(); },
  salvar(tok, col, id, json) {
    sessao_(tok); valida_(col, id, json);
    comTrava_(() => gravar_([{ col: col, id: id, json: json }]));
    return true;
  },
  excluir(tok, col, id) {
    sessao_(tok); valida_(col, id, '{}');
    comTrava_(() => {
      const sh = aba_(), v = sh.getDataRange().getValues();
      for (let i = v.length - 1; i >= 1; i--) if (v[i][0] === col && String(v[i][1]) === id) sh.deleteRow(i + 1);
      novaVersao_();
    });
    return true;
  },
  importar(tok, docs) {
    sessao_(tok);
    if (!Array.isArray(docs) || docs.length > 20000) throw new Error('backup_invalido');
    docs.forEach(d => valida_(d.col, d.id, d.json));
    comTrava_(() => gravar_(docs));
    return docs.length;
  },
  sair(tok) {
    if (typeof tok === 'string') PropertiesService.getScriptProperties().deleteProperty('S_' + hash_(tok));
    return true;
  }
};

/* ---------- apoio ---------- */
function aba_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(ABA_DADOS);
  if (!sh) {
    sh = ss.insertSheet(ABA_DADOS);
    sh.getRange(1, 1, 1, 4).setValues([['coleção', 'id', 'dados (json)', 'atualizado em']]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.setColumnWidth(3, 520);
  }
  return sh;
}
function gravar_(docs) {
  const sh = aba_(), v = sh.getDataRange().getValues(), idx = {};
  for (let i = 1; i < v.length; i++) idx[v[i][0] + '|' + v[i][1]] = i + 1;
  const agora = new Date(), novos = [];
  docs.forEach(d => {
    const linha = [d.col, d.id, d.json, agora];
    const r = idx[d.col + '|' + d.id];
    if (r) sh.getRange(r, 1, 1, 4).setValues([linha]);
    else { novos.push(linha); idx[d.col + '|' + d.id] = -1; }
  });
  if (novos.length) sh.getRange(sh.getLastRow() + 1, 1, novos.length, 4).setValues(novos);
  novaVersao_();
}
function valida_(col, id, json) {
  if (COLECOES.indexOf(col) < 0) throw new Error('colecao_invalida');
  if (typeof id !== 'string' || !/^[A-Za-z0-9_.:-]{1,80}$/.test(id)) throw new Error('id_invalido');
  if (typeof json !== 'string' || json.length > 45000) throw new Error('dados_invalidos');
  const o = JSON.parse(json);
  if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error('dados_invalidos');
}
function sessao_(tok) {
  if (typeof tok !== 'string' || tok.length < 40) throw new Error('sessao');
  const props = PropertiesService.getScriptProperties();
  const k = 'S_' + hash_(tok), exp = Number(props.getProperty(k) || 0);
  if (!exp || exp < Date.now()) { if (exp) props.deleteProperty(k); throw new Error('sessao'); }
}
function limparSessoes_() {
  const props = PropertiesService.getScriptProperties(), all = props.getProperties(), agora = Date.now();
  Object.keys(all).forEach(k => { if (k.indexOf('S_') === 0 && Number(all[k]) < agora) props.deleteProperty(k); });
}
function versao_() { return PropertiesService.getScriptProperties().getProperty('VERSAO') || '0'; }
function novaVersao_() { PropertiesService.getScriptProperties().setProperty('VERSAO', String(Date.now())); }
function comTrava_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('ocupado');
  try { return fn(); } finally { lock.releaseLock(); }
}
function hash_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('');
}
