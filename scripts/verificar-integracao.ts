import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { io } from 'socket.io-client';

const api = process.env.API_URL ?? 'http://localhost:3001';
type Registro = Record<string, any>;
async function chamar(rota: string, token?: string, dados?: unknown, metodo = dados ? 'POST' : 'GET'): Promise<Registro> {
  const r = await fetch(api + rota, { method: metodo, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: dados ? JSON.stringify(dados) : undefined, signal: AbortSignal.timeout(10000) });
  const resposta = r.status === 204 ? {} : await r.json() as Registro;
  if (!r.ok) throw new Error(`${metodo} ${rota}: ${r.status} ${JSON.stringify(resposta)}`);
  return resposta;
}
const entrar = (email: string, senha: string) => chamar('/autenticacao/entrar', undefined, { eml_usr: email, senha });
const sufixo = randomBytes(5).toString('hex');
const senha = randomBytes(24).toString('hex');
const documento = () => Array.from(randomBytes(14), b => b % 10).join('');
assert.equal((await chamar('/saude')).st, 'disponivel');
const admin = await entrar(process.env.ADMIN_EMAIL ?? 'admin@rotaja.local', process.env.ADMIN_SENHA ?? '');
const loja = await chamar('/usuarios', admin.token, { nom_usr: 'Loja de teste integrado', eml_usr: `loja.${sufixo}@teste.local`, senha, tp_usr: 'REMETENTE' });
const motoboy = await chamar('/usuarios', admin.token, { nom_usr: 'Entregador de teste integrado', eml_usr: `ent.${sufixo}@teste.local`, senha, tp_usr: 'ENTREGADOR' });
const empresa = await chamar('/empresas', admin.token, { id_usr: loja.id_usr, tp_pes: 'JURIDICA', raz_soc: `Empresa teste ${sufixo}`, nom_fan: 'Loja teste integrado', doc_emp: documento(), log_emp: 'Rua de teste', num_emp: '1', bai_emp: 'Centro', cid_emp: 'Floriano', uf_emp: 'PI', tel_emp: '5589999990000' });
const ent = await chamar('/entregadores', admin.token, { id_usr: motoboy.id_usr, doc_cpf: documento().slice(0, 11), pla_moto: 'TST1A23', tel_ent: '5589999990001' });
const bairro = await chamar('/bairros', admin.token, { nom_bai: `Bairro teste ${sufixo}`, cid_bai: 'Floriano', uf_bai: 'PI', vlr_tx_ent: '7.00', vlr_ganho_ent: '7.00', vlr_tx_ret: '3.00', vlr_ganho_ret: '3.00' });
const cliente = await entrar(`loja.${sufixo}@teste.local`, senha);
const entregador = await entrar(`ent.${sufixo}@teste.local`, senha);
const dados = { id_bai: bairro.id_bai, chave_idem: randomUUID(), nom_dest: 'Destinatário teste integrado', tel_dest: '5589999990002', log_dest: 'Rua de destino', num_dest: '20', tp_end: 'ENTREGA', st_ret: false, st_pag: 'A_RECEBER', vlr_cobrar: '100.00', tp_pag_prev: 'DINHEIRO' };
// Regressões: tarifas por loja, exclusividade do ADM e cobrança total inclusiva.
const negar = async (rota: string, token: string, corpo: unknown, metodo = 'POST', esperado = 403) => {
  const r = await fetch(api + rota, { method: metodo, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
  assert.equal(r.status, esperado, rota);
};
const op = await chamar('/usuarios', admin.token, { nom_usr: 'Operador de teste', eml_usr: `op.${sufixo}@teste.local`, senha, tp_usr: 'OPERADOR' });
const operador = await entrar(`op.${sufixo}@teste.local`, senha);
const rotaTaxa = `/empresas/${empresa.id_emp}/tarifas/${bairro.id_bai}`;
await negar('/pedidos', admin.token, dados);
await negar('/operacao/pedidos', admin.token, { id_emp: empresa.id_emp, pedido: dados });
await negar(rotaTaxa, cliente.token, { vlr_tx_ent: '1', vlr_tx_ret: '0' }, 'PUT');
await negar(rotaTaxa, operador.token, { vlr_tx_ent: '1', vlr_tx_ret: '0' }, 'PUT');
await negar(`/bairros/${bairro.id_bai}`, operador.token, { vlr_tx_ent: '1' }, 'PATCH');
await chamar(rotaTaxa, admin.token, { vlr_tx_ent: '9.00', vlr_tx_ret: '4.00' }, 'PUT');
const listaBairros = await chamar('/bairros', cliente.token);
assert.equal(listaBairros.find((b: Registro) => b.id_bai === bairro.id_bai).vlr_tx_ent, '9');
const segunda = await chamar('/cadastros/empresa', admin.token, { nom_usr: 'Segunda loja', eml_usr: `segunda.${sufixo}@teste.local`, senha, tp_pes: 'JURIDICA', raz_soc: 'Segunda loja teste', nom_fan: 'Segunda loja teste', doc_emp: documento(), log_emp: 'Rua de teste', num_emp: '2', bai_emp: 'Centro', cid_emp: 'Floriano', uf_emp: 'PI', tel_emp: '5589999990000' });
const outroCliente = await entrar(`segunda.${sufixo}@teste.local`, senha);
assert.equal((await chamar('/bairros', outroCliente.token)).find((b: Registro) => b.id_bai === bairro.id_bai).vlr_tx_ent, '7');
const { vlr_cobrar, tp_pag_prev, ...semCobranca } = dados;
const pago = await chamar('/pedidos', cliente.token, { ...semCobranca, chave_idem: randomUUID(), st_pag: 'PAGO', st_ret: true });
assert.equal(pago.vlr_tx, '13'); assert.equal(pago.vlr_cobrar, '0'); assert.equal(pago.tp_pag_prev, null);
await negar('/pedidos', cliente.token, { ...dados, chave_idem: randomUUID(), st_pag: 'PAGO' }, 'POST', 422);
await negar('/pedidos', cliente.token, { ...dados, chave_idem: randomUUID(), vlr_cobrar: '8' }, 'POST', 422);
const inclusivo = await chamar('/pedidos', cliente.token, { ...dados, chave_idem: randomUUID() });
assert.equal(inclusivo.vlr_cobrar, '100'); assert.equal(inclusivo.vlr_prod, '91'); assert.equal(inclusivo.tp_pag_prev, 'DINHEIRO');
await chamar(rotaTaxa, admin.token, { vlr_tx_ent: '7', vlr_tx_ret: '3' }, 'PUT');
assert.equal((await chamar('/pedidos/' + inclusivo.id_ped, cliente.token)).vlr_tx, '9');
for (const p of [pago, inclusivo]) await chamar('/pedidos/status', admin.token, { id_ped: p.id_ped, versao: p.versao, st_ped: 'CANCELADO' });
const inicio = new Date().toISOString();
let pedido = await chamar('/pedidos', cliente.token, dados);
assert.equal(pedido.vlr_cobrar, '100');
assert.equal((await chamar('/pedidos', cliente.token, dados)).id_ped, pedido.id_ped);
const negado = await fetch(api + '/pedidos', { method: 'POST', headers: { Authorization: `Bearer ${cliente.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...dados, chave_idem: randomUUID(), id_bai: randomUUID() }) });
assert.equal(negado.status, 422);
const socket = io(api, { auth: { token: admin.token }, transports: ['websocket'], reconnection: false });
try {
  await new Promise<void>((resolve, reject) => { const limite = setTimeout(() => reject(Error('Tempo excedido ao conectar socket')), 10000); socket.once('connect', () => { clearTimeout(limite); resolve(); }); socket.once('connect_error', e => { clearTimeout(limite); reject(e); }); });
  pedido = await new Promise<Registro>((resolve, reject) => socket.timeout(10000).emit('pedido:despachar', { id_ped: pedido.id_ped, id_ent: ent.id_ent, versao: pedido.versao }, (erro: unknown, r: Registro) => { if (erro || !r?.ok) reject(Error(r?.mensagem ?? 'Falha no despacho')); else resolve(r.pedido); }));
  for (const st_ped of ['ACEITO','EM_COLETA','NO_LOCAL','EM_ENTREGA','CONCLUIDO']) {
    pedido = await chamar('/pedidos/status', entregador.token, { id_ped: pedido.id_ped, versao: pedido.versao, st_ped, ...(st_ped === 'CONCLUIDO' ? { tp_rec: 'DINHEIRO' } : {}) });
  }
  const consultarPortal = (token = cliente.token) => chamar('/portal/resumo?' + new URLSearchParams({ inicio, fim: new Date(Date.now()+60000).toISOString() }), token);
  const abertoPortal = await consultarPortal();
  assert.equal(abertoPortal.total_chamadas, 3); assert.equal(abertoPortal.chamadas_periodo, 1);
  assert.equal(abertoPortal.taxas_periodo, '7'); assert.equal(abertoPortal.a_receber, '93'); assert.equal(abertoPortal.sem_fechamento, '93');
  assert.equal((await consultarPortal(outroCliente.token)).total_chamadas, 0);
  assert.equal((await consultarPortal(outroCliente.token)).a_receber, '0');
  const tentarEscopo = await fetch(api + '/portal/resumo?' + new URLSearchParams({ inicio, fim: new Date().toISOString(), id_emp: segunda.id_emp }), { headers: { Authorization: `Bearer ${cliente.token}` } });
  assert.equal(tentarEscopo.status, 422);
  const periodo = { dt_ini: inicio, dt_fim: new Date().toISOString() };
  const caixa = await chamar('/caixas/fechar', entregador.token, { id_ent: ent.id_ent, ...periodo });
  assert.equal(caixa.vlr_saldo_rep_adm, '93');
  assert.equal((await chamar('/caixas/fechar', entregador.token, { id_ent: ent.id_ent, ...periodo })).id_cx, caixa.id_cx);
  await chamar(`/caixas/${caixa.id_cx}/quitar`, admin.token, { ref_comprovante: `teste-integrado-${sufixo}` });
  const repasse = await chamar('/repasses', admin.token, { id_emp: empresa.id_emp, ...periodo });
  assert.equal(repasse.vlr_rep, '93');
  const fechadoPortal = await consultarPortal(); assert.equal(fechadoPortal.a_receber, '93'); assert.equal(fechadoPortal.sem_fechamento, '0'); assert.equal(fechadoPortal.em_fechamento, '93');
  await chamar(`/repasses/${repasse.id_rep}/quitar`, admin.token, { ref_comprovante: `teste-integrado-${sufixo}` });
  const quitadoPortal = await consultarPortal(); assert.equal(quitadoPortal.a_receber, '0'); assert.equal(quitadoPortal.recebido_periodo, '93');
  const historico = await chamar(`/pedidos/${pedido.id_ped}/historico`, admin.token);
  assert.equal((historico as unknown as unknown[]).length, 7);
  const tokenRevogado = cliente.token;
  await chamar('/autenticacao/sair', cliente.token, {});
  assert.equal((await fetch(api + '/pedidos', { headers: { Authorization: `Bearer ${tokenRevogado}` } })).status, 401);
  console.log('Integração aprovada: autenticação, cadastros, bairro restrito, idempotência, despacho WebSocket, corrida, caixa, repasse, auditoria e logout.');
  console.log(`Dados sintéticos preservados para inspeção: pedido #${pedido.num_ped}.`);
} finally { socket.disconnect(); }
