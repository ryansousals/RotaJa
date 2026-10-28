import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import { createServer } from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { compare, hash } from 'bcryptjs';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { Redis } from 'ioredis';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Prisma } from '@prisma/client';
import { z, ZodError } from 'zod';
import { Falha, operador } from './dominio.js';
import { banco, criarPedido, despachar, mudarStatus, fecharCaixa, transacao, type Ator } from './servicos.js';
import { registrarPainel } from './painel.js';
const app = express(), http = createServer(app);
const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
redis.on('error', () => console.error('Falha de conexão com Redis'));
const sub = redis.duplicate();
sub.on('error', () => console.error('Falha no assinante Redis'));
const origens = (process.env.WEB_ORIGINS ?? 'http://localhost:3000').split(',');
const io = new Server(http, { cors: { origin: origens }, transports: ['websocket'], allowRequest: (req, cb) => cb(null, !req.headers.origin || origens.includes(req.headers.origin)) });
io.adapter(createAdapter(redis, sub));
app.use(helmet(), cors({ origin: origens }), express.json({ limit: '32kb' }));
app.use(rateLimit({ windowMs: 60_000, limit: 120 }));
app.use((req, _res, next) => {
  if (!['GET','HEAD','OPTIONS'].includes(req.method) && req.headers.origin && !origens.includes(req.headers.origin)) { next(new Falha(403, 'Origem não permitida')); return; }
  next();
});
const chaveSessao = (token: string) => `sessao:${createHash('sha256').update(token).digest('hex')}`;
const tokenRequisicao = (req: { headers: { authorization?: string; cookie?: string } }) => req.headers.authorization?.replace(/^Bearer /, '') ?? req.headers.cookie?.split(';').map(c => c.trim()).find(c => c.startsWith('rotaja_sessao='))?.slice('rotaja_sessao='.length);
const cookieOpcoes = { httpOnly: true, sameSite: 'strict' as const, secure: process.env.COOKIE_SEGURO === 'true', path: '/' };
async function autenticar(token?: string): Promise<Ator> {
  if (!token || token.length > 256) throw new Falha(401, 'Sessão inválida');
  const id = await redis.get(chaveSessao(token));
  if (!id) throw new Falha(401, 'Sessão expirada');
  const u = await banco.usr_usuarios.findUnique({ where: { id_usr: id } });
  if (!u?.st_atv) throw new Falha(401, 'Usuário inativo');
  return { id_usr: u.id_usr, tp_usr: u.tp_usr };
}
const ator = (r: Response) => r.locals.ator as Ator;
const exigirOperador = (a: Ator) => { if (!operador(a.tp_usr)) throw new Falha(403, 'Acesso restrito à operação'); };
app.get('/saude', async (_req, res) => { await banco.$queryRaw`SELECT 1`; await redis.ping(); res.json({ st: 'disponivel' }); });
app.post('/autenticacao/entrar', rateLimit({ windowMs: 900_000, limit: 20 }), async (req, res) => {
  const d = z.object({ eml_usr: z.string().email(), senha: z.string().max(200) }).parse(req.body);
  const u = await banco.usr_usuarios.findUnique({ where: { eml_usr: d.eml_usr.toLowerCase() } });
  if (!u?.st_atv || !await compare(d.senha, u.sen_hash)) throw new Falha(401, 'Credenciais inválidas');
  const token = randomBytes(32).toString('hex');
  await redis.set(chaveSessao(token), u.id_usr, 'EX', 3600);
  res.cookie('rotaja_sessao', token, { ...cookieOpcoes, maxAge: 3600_000 });
  res.json({ token, expira_em: 3600, usuario: { id_usr: u.id_usr, nom_usr: u.nom_usr, tp_usr: u.tp_usr } });
});
app.use(async (req, res, next) => { try {
  if (!['GET','HEAD','OPTIONS'].includes(req.method) && req.headers.origin && !origens.includes(req.headers.origin)) throw new Falha(403, 'Origem não permitida');
  res.locals.ator = await autenticar(tokenRequisicao(req)); next();
} catch (e) { next(e); } });
app.post('/autenticacao/sair', async (req, res) => {
  const token = tokenRequisicao(req)!;
  await redis.del(chaveSessao(token));
  io.in(`sessao:${chaveSessao(token)}`).disconnectSockets(true);
  res.clearCookie('rotaja_sessao', cookieOpcoes).sendStatus(204);
});
registrarPainel(app, redis);
app.post('/usuarios', async (req, res) => {
  exigirOperador(ator(res));
  const d = z.object({ nom_usr: z.string().min(3).max(150), eml_usr: z.string().email(), senha: z.string().min(16).max(100), tp_usr: z.enum(['OPERADOR','REMETENTE','ENTREGADOR']) }).parse(req.body);
  if (d.tp_usr === 'OPERADOR' && ator(res).tp_usr !== 'ADMINISTRADOR') throw new Falha(403, 'Somente administrador cria operadores');
  const { senha, ...dados } = d;
  res.status(201).json(await banco.usr_usuarios.create({ data: { ...dados, eml_usr: dados.eml_usr.toLowerCase(), sen_hash: await hash(senha, 12) }, select: { id_usr: true, nom_usr: true, tp_usr: true } }));
});
const empresaSchema = z.object({ id_usr: z.string().uuid(), tp_pes: z.enum(['FISICA','JURIDICA']), raz_soc: z.string().min(3), nom_fan: z.string().min(2), doc_emp: z.string().regex(/^(\d{11}|\d{14})$/), log_emp: z.string().min(3), num_emp: z.string().min(1), cmp_emp: z.string().optional(), bai_emp: z.string().min(2), cid_emp: z.string().min(2), uf_emp: z.string().length(2), tel_emp: z.string().regex(/^\+?\d{10,15}$/) }).strict();
app.post('/empresas', async (req, res) => {
  exigirOperador(ator(res)); const d = empresaSchema.parse(req.body);
  if (d.doc_emp.length !== (d.tp_pes === 'FISICA' ? 11 : 14)) throw new Falha(422, 'Documento incompatível com tipo de pessoa');
  const u = await banco.usr_usuarios.findUnique({ where: { id_usr: d.id_usr } });
  if (u?.tp_usr !== 'REMETENTE') throw new Falha(422, 'Selecione um usuário remetente');
  res.status(201).json(await banco.emp_empresas.create({ data: d }));
});
app.get('/empresas', async (_req, res) => { exigirOperador(ator(res)); res.json(await banco.emp_empresas.findMany({ take: 100, orderBy: { nom_fan: 'asc' } })); });
app.patch('/empresas/:id', async (req, res) => { exigirOperador(ator(res)); const dados = empresaSchema.omit({ id_usr: true }).partial().extend({ st_atv: z.boolean().optional() }).parse(req.body); res.json(await banco.emp_empresas.update({ where: { id_emp: z.string().uuid().parse(req.params.id) }, data: dados })); });
app.post('/entregadores', async (req, res) => {
  exigirOperador(ator(res)); const d = z.object({ id_usr: z.string().uuid(), doc_cpf: z.string().regex(/^\d{11}$/), pla_moto: z.string().min(7).max(8), tel_ent: z.string().regex(/^\+?\d{10,15}$/) }).parse(req.body);
  const u = await banco.usr_usuarios.findUnique({ where: { id_usr: d.id_usr } });
  if (u?.tp_usr !== 'ENTREGADOR') throw new Falha(422, 'Usuário deve ter perfil entregador');
  res.status(201).json(await banco.ent_entregadores.create({ data: d }));
});
app.get('/entregadores', async (_req, res) => { exigirOperador(ator(res)); res.json(await banco.ent_entregadores.findMany({ include: { usuario: { select: { nom_usr: true, eml_usr: true, st_atv: true } } }, orderBy: { usuario: { nom_usr: 'asc' } } })); });
app.get('/bairros', async (_req, res) => { res.json(await banco.bai_bairros.findMany({ where: operador(ator(res).tp_usr) ? {} : { st_atv: true }, orderBy: { nom_bai: 'asc' } })); });
app.post('/bairros', async (req, res) => {
  exigirOperador(ator(res)); const moeda = z.string().regex(/^\d{1,9}(\.\d{1,2})?$/);
  const dados = z.object({ nom_bai: z.string().min(2), cid_bai: z.string().min(2), uf_bai: z.string().length(2), vlr_tx_ent: moeda, vlr_ganho_ent: moeda, vlr_tx_ret: moeda, vlr_ganho_ret: moeda }).parse(req.body);
  res.status(201).json(await banco.bai_bairros.create({ data: dados }));
});
function publicar(p: { id_usr: string; id_ped: string; versao: number; st_ped: string }) {
  // Apenas metadados: dados pessoais são consultados via HTTP com autorização atual.
  io.to('operacao').to(`usr:${p.id_usr}`).emit('pedido:atualizado', { id_ped: p.id_ped, versao: p.versao, st_ped: p.st_ped });
  banco.ped_pedidos.findUnique({ where: { id_ped: p.id_ped }, select: { entregador: { select: { id_usr: true } } } }).then(r => {
    if (r?.entregador) io.to(`usr:${r.entregador.id_usr}`).emit('pedido:atualizado', { id_ped: p.id_ped });
  }).catch(() => console.error('Falha ao notificar entregador'));
}
app.post('/pedidos', async (req, res) => { const p = await criarPedido(ator(res), req.body); publicar(p); res.status(201).json(p); });
app.post('/operacao/pedidos', async (req, res) => {
  exigirOperador(ator(res));
  const d = z.object({ id_emp: z.string().uuid(), pedido: z.unknown() }).parse(req.body);
  const emp = await banco.emp_empresas.findUniqueOrThrow({ where: { id_emp: d.id_emp }, include: { usuario: { select: { st_atv: true } } } });
  if (!emp.usuario.st_atv) throw new Falha(422, 'Usuário da empresa inativo');
  const p = await criarPedido({ id_usr: emp.id_usr, tp_usr: 'REMETENTE' }, d.pedido, ator(res).id_usr);
  publicar(p); res.status(201).json(p);
});
async function escopo(a: Ator): Promise<Prisma.ped_pedidosWhereInput> {
  if (operador(a.tp_usr)) return {};
  if (a.tp_usr === 'REMETENTE') return { id_usr: a.id_usr };
  return { entregador: { id_usr: a.id_usr } };
}
app.get('/pedidos', async (req, res) => {
  const pagina = z.coerce.number().int().min(1).max(100000).default(1).parse(req.query.pagina);
  const where = await escopo(ator(res));
  const filtro = z.object({ busca: z.string().max(120).optional(), status: z.enum(['PREPARANDO','ATRIBUIDO','ACEITO','EM_COLETA','NO_LOCAL','EM_ENTREGA','EM_RETORNO','CONCLUIDO','CANCELADO','ATIVOS']).optional() }).parse(req.query);
  if (filtro.status) where.st_ped = filtro.status === 'ATIVOS' ? { notIn: ['CONCLUIDO','CANCELADO'] } : filtro.status;
  if (filtro.busca) where.OR = [{ nom_dest: { contains: filtro.busca, mode: 'insensitive' } }, { empresa: { nom_fan: { contains: filtro.busca, mode: 'insensitive' } } }, ...( /^\d{1,9}$/.test(filtro.busca) ? [{ num_ped: Number(filtro.busca) }] : [])];
  const [total, itens] = await banco.$transaction([banco.ped_pedidos.count({ where }), banco.ped_pedidos.findMany({ where, take: 20, skip: (pagina - 1) * 20, orderBy: { dt_cad: 'desc' }, include: { bairro: true, empresa: { select: { nom_fan: true } }, entregador: { select: { id_ent: true, usuario: { select: { nom_usr: true } } } } } })]);
  res.json({ pagina, total, paginas: Math.max(1, Math.ceil(total / 20)), itens });
});
app.get('/pedidos/:id', async (req, res) => {
  const p = await banco.ped_pedidos.findFirst({ where: { ...await escopo(ator(res)), id_ped: z.string().uuid().parse(req.params.id) }, include: { bairro: true, empresa: { select: { nom_fan: true } }, entregador: { select: { id_ent: true, usuario: { select: { nom_usr: true } } } } } });
  if (!p) throw new Falha(404, 'Pedido não encontrado');
  res.json(p);
});
app.get('/pedidos/:id/historico', async (req, res) => { exigirOperador(ator(res)); res.json(await banco.log_historico_pedidos.findMany({ where: { id_ped: z.string().uuid().parse(req.params.id) }, orderBy: { dt_cad: 'asc' } })); });
app.post('/pedidos/status', async (req, res) => { const p = await mudarStatus(ator(res), req.body); publicar(p); res.json(p); });
app.patch('/pedidos/:id', async (req, res) => {
  exigirOperador(ator(res));
  const d = z.object({ versao: z.number().int().nonnegative(), motivo: z.string().min(10).max(500), nom_dest: z.string().min(1).optional(), log_dest: z.string().min(1).optional(), num_dest: z.string().min(1).optional(), cmp_dest: z.string().optional(), ref_dest: z.string().optional(), tel_dest: z.string().regex(/^\+?\d{10,15}$/).optional(), vlr_prod: z.string().regex(/^\d{1,9}(\.\d{1,2})?$/).optional(), vlr_tx: z.string().regex(/^\d{1,9}(\.\d{1,2})?$/).optional(), vlr_ganho_ent: z.string().regex(/^\d{1,9}(\.\d{1,2})?$/).optional(), id_bai: z.string().uuid().optional() }).strict().parse(req.body);
  const p = await transacao(async tx => {
    const id_ped = z.string().uuid().parse(req.params.id);
    const antes = await tx.ped_pedidos.findUniqueOrThrow({ where: { id_ped } });
    if (antes.id_cx || antes.id_rep || ['CONCLUIDO','CANCELADO'].includes(antes.st_ped)) throw new Falha(409, 'Pedido encerrado exige lançamento de ajuste financeiro; não reescreva o histórico');
    if (d.id_bai && !await tx.bai_bairros.findFirst({ where: { id_bai: d.id_bai, st_atv: true } })) throw new Falha(422, 'Bairro não permitido');
    const { versao, motivo, ...campos } = d;
    const vlr_cobrar = antes.st_pag === 'A_RECEBER' ? new Prisma.Decimal(d.vlr_prod ?? antes.vlr_prod).plus(d.vlr_tx ?? antes.vlr_tx) : new Prisma.Decimal(0);
    const r = await tx.ped_pedidos.updateMany({ where: { id_ped, versao }, data: { ...campos, vlr_cobrar, versao: { increment: 1 } } });
    if (!r.count) throw new Falha(409, 'Versão desatualizada');
    const depois = await tx.ped_pedidos.findUniqueOrThrow({ where: { id_ped } });
    await tx.log_historico_pedidos.create({ data: { id_ped, id_usr: ator(res).id_usr, acao: 'EDICAO_ADMINISTRATIVA', dados_ant: JSON.parse(JSON.stringify(antes)), dados_nov: { motivo, pedido: JSON.parse(JSON.stringify(depois)) } } });
    return depois;
  }); publicar(p); res.json(p);
});
app.post('/repasses', async (req, res) => {
  exigirOperador(ator(res));
  const d = z.object({ id_emp: z.string().uuid(), dt_ini: z.string().datetime({ offset: true }), dt_fim: z.string().datetime({ offset: true }) }).parse(req.body);
  const inicio = new Date(d.dt_ini), fim = new Date(d.dt_fim);
  if (inicio >= fim || fim > new Date()) throw new Falha(422, 'Período inválido');
  res.status(201).json(await transacao(async tx => {
    const existente = await tx.rep_repasses_lojas.findUnique({ where: { id_emp_dt_ini_dt_fim: { id_emp: d.id_emp, dt_ini: inicio, dt_fim: fim } } });
    if (existente) return existente;
    const pedidos = await tx.ped_pedidos.findMany({ where: { id_emp: d.id_emp, st_ped: 'CONCLUIDO', dt_conc: { gte: inicio, lt: fim } } });
    if (pedidos.some(p => p.id_rep)) throw new Falha(409, 'Período sobrepõe repasse já gerado');
    // Convenção: o ADM retém o frete. PIX/CARTAO pagos direto à loja já estão liquidados.
    const valor = pedidos.reduce((s, p) => s.plus(p.vlr_rec_din).minus(p.vlr_tx), new Prisma.Decimal(0));
    const repasse = await tx.rep_repasses_lojas.create({ data: { id_emp: d.id_emp, dt_ini: inicio, dt_fim: fim, vlr_rep: valor } });
    await tx.ped_pedidos.updateMany({ where: { id_ped: { in: pedidos.map(p => p.id_ped) } }, data: { id_rep: repasse.id_rep } });
    return repasse;
  }));
});
app.post('/repasses/:id/quitar', async (req, res) => {
  exigirOperador(ator(res)); const d = z.object({ ref_comprovante: z.string().min(5).max(200) }).parse(req.body);
  const r = await banco.rep_repasses_lojas.updateMany({ where: { id_rep: z.string().uuid().parse(req.params.id), st_rep: 'PENDENTE' }, data: { ...d, st_rep: 'QUITADO', dt_pag: new Date() } });
  if (!r.count) throw new Falha(409, 'Repasse já quitado ou ausente'); res.sendStatus(204);
});
app.post('/gps', async (req, res) => {
  const a = ator(res); if (a.tp_usr !== 'ENTREGADOR') throw new Falha(403, 'Apenas entregadores enviam GPS');
  const d = z.object({ id_ped: z.string().uuid(), lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), dt: z.string().datetime() }).parse(req.body);
  if (Math.abs(Date.now() - Date.parse(d.dt)) > 60_000) throw new Falha(422, 'Posição antiga');
  const p = await banco.ped_pedidos.findFirst({ where: { id_ped: d.id_ped, entregador: { id_usr: a.id_usr }, st_ped: { in: ['ACEITO','EM_COLETA','NO_LOCAL','EM_ENTREGA','EM_RETORNO'] } } });
  if (!p) throw new Falha(403, 'Sem corrida ativa atribuída');
  if (!await redis.set(`gps:limite:${a.id_usr}`, '1', 'EX', 5, 'NX')) { res.sendStatus(429); return; }
  await redis.set(`gps:${p.id_ped}`, JSON.stringify(d), 'EX', 120);
  io.to('operacao').to(`usr:${p.id_usr}`).emit('gps:posicao', d); res.sendStatus(204);
});
app.post('/caixas/fechar', async (req, res) => { res.json(await fecharCaixa(ator(res), req.body)); });
app.post('/caixas/:id/quitar', async (req, res) => {
  exigirOperador(ator(res)); const d = z.object({ ref_comprovante: z.string().min(5).max(200) }).parse(req.body);
  const r = await banco.cx_caixa_entregador.updateMany({ where: { id_cx: z.string().uuid().parse(req.params.id), st_cx: 'AGUARDANDO_VALIDACAO' }, data: { ...d, st_cx: 'QUITADO', id_usr_val: ator(res).id_usr, dt_val: new Date() } });
  if (!r.count) throw new Falha(409, 'Caixa não está aguardando validação'); res.sendStatus(204);
});
io.use(async (socket, next) => { try {
  const token = socket.handshake.auth.token ?? tokenRequisicao(socket.request);
  socket.data.ator = await autenticar(token); socket.data.token = token; next();
} catch { next(new Error('Sessão inválida')); } });
io.on('connection', socket => {
  const a = socket.data.ator as Ator;
  socket.join(`sessao:${chaveSessao(socket.data.token)}`);
  socket.join(`usr:${a.id_usr}`); if (operador(a.tp_usr)) socket.join('operacao');
  const expirar = setTimeout(() => socket.disconnect(true), 3600_000); socket.on('disconnect', () => clearTimeout(expirar));
  socket.on('pedido:despachar', async (dados, ack) => {
    if (typeof ack !== 'function') return;
    try {
      const atual = await autenticar(socket.data.token);
      const r = await despachar(atual, dados); publicar(r.pedido);
      io.to(`usr:${r.id_usr_ent}`).emit('chamado:atribuido', { id_ped: r.pedido.id_ped });
      ack({ ok: true, pedido: r.pedido });
    } catch (e) { ack({ ok: false, mensagem: e instanceof Falha ? e.message : 'Não foi possível despachar' }); }
  });
  socket.on('gps:atualizar', async dados => {
    try {
      const atual = await autenticar(socket.data.token);
      if (atual.tp_usr !== 'ENTREGADOR') return;
      const d = z.object({ id_ped: z.string().uuid(), lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), dt: z.string().datetime() }).parse(dados);
      if (Math.abs(Date.now() - Date.parse(d.dt)) > 60_000) return;
      if (!await redis.set(`gps:limite:${atual.id_usr}`, '1', 'EX', 5, 'NX')) return;
      const p = await banco.ped_pedidos.findFirst({ where: { id_ped: d.id_ped, entregador: { id_usr: atual.id_usr }, st_ped: { in: ['ACEITO','EM_COLETA','NO_LOCAL','EM_ENTREGA','EM_RETORNO'] } } });
      if (!p) return;
      await redis.set(`gps:${p.id_ped}`, JSON.stringify(d), 'EX', 120);
      io.to('operacao').to(`usr:${p.id_usr}`).emit('gps:posicao', d);
    } catch { /* Pacotes inválidos são descartados sem expor dados internos. */ }
  });
});
app.use((erro: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (erro instanceof ZodError) { res.status(422).json({ erro: 'Dados inválidos', campos: erro.flatten() }); return; }
  if (erro instanceof Falha) { res.status(erro.codigo).json({ erro: erro.message }); return; }
  if (erro instanceof Prisma.PrismaClientKnownRequestError) {
    const codigo = erro.code === 'P2025' ? 404 : ['P2002','P2034'].includes(erro.code) ? 409 : 422;
    res.status(codigo).json({ erro: 'Registro ausente, duplicado ou conflito; atualize e tente novamente' }); return;
  }
  console.error('Falha interna na requisição'); res.status(500).json({ erro: 'Erro interno' });
});
http.listen(Number(process.env.PORT ?? 3001), '0.0.0.0', () => console.log('API RotaJá disponível'));
async function encerrar() { io.close(); http.close(); await banco.$disconnect(); redis.disconnect(); sub.disconnect(); }
process.on('SIGTERM', encerrar); process.on('SIGINT', encerrar);
