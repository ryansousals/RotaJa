import { registrarUsuarios } from './usuarios.js';
import { registrarCaixaRegistro } from './caixa-registro.js';
import { registrarRelatorios } from './relatorios.js';
import { registrarCaixaDiario } from './caixa-diario.js';
import 'dotenv/config';
import express from 'express';
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
import { banco, criarPedido, despachar, mudarStatus, fecharCaixa, transacao } from './servicos.js';
import { registrarControle, validarAcessoEmpresa } from './controle.js';
import { registrarPortal } from './portal.js';
import { registrarPainel } from './painel.js';
const aplicacao = express(), http = createServer(aplicacao);
// Em produção, somente o Caddy alcança a API pela rede privada do Docker.
if (process.env.PROXY_CONFIAVEL === 'true') aplicacao.set('trust proxy', 1);
const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
redis.on('error', () => console.error('Falha de conexão com Redis'));
const sub = redis.duplicate();
sub.on('error', () => console.error('Falha no assinante Redis'));
const origens = (process.env.WEB_ORIGINS ?? 'http://localhost:3000').split(',');
const io = new Server(http, { cors: { origin: origens }, transports: ['websocket'], allowRequest: (requisicao, cb) => cb(null, !requisicao.headers.origin || origens.includes(requisicao.headers.origin)) });
io.adapter(createAdapter(redis, sub));
aplicacao.use(helmet(), cors({ origin: origens }), express.json({ limit: '32kb' }));
aplicacao.use(rateLimit({ windowMs: 60_000, limit: 120 }));
aplicacao.use((requisicao, _res, proximo) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(requisicao.method) && requisicao.headers.origin && !origens.includes(requisicao.headers.origin)) {
        proximo(new Falha(403, 'Origem não permitida'));
        return;
    }
    proximo();
});
const chaveSessao = (token) => `sessao:${createHash('sha256').update(token).digest('hex')}`;
const tokenRequisicao = (requisicao) => requisicao.headers.authorization?.replace(/^Bearer /, '') ?? requisicao.headers.cookie?.split(';').map(c => c.trim()).find(c => c.startsWith('rotaja_sessao='))?.slice('rotaja_sessao='.length);
const cookieOpcoes = { httpOnly: true, sameSite: 'strict', secure: process.env.COOKIE_SEGURO === 'true', path: '/' };
async function autenticar(token) {
    if (!token || token.length > 256)
        throw new Falha(401, 'Sessão inválida');
    const id = await redis.get(chaveSessao(token));
    if (!id)
        throw new Falha(401, 'Sessão expirada');
    const u = await banco.usr_usuarios.findUnique({ where: { id_usr: id } });
    if (!u?.st_atv)
        throw new Falha(401, 'Usuário inativo');
    await validarAcessoEmpresa(u);
    return { id_usr: u.id_usr, tp_usr: u.tp_usr };
}
const ator = (r) => r.locals.ator;
const exigirOperador = (a) => { if (!operador(a.tp_usr))
    throw new Falha(403, 'Acesso restrito à operação'); };
aplicacao.get('/saude', async (_req, resposta) => { await banco.$queryRaw `SELECT 1`; await redis.ping(); resposta.json({ st: 'disponivel' }); });
aplicacao.post('/autenticacao/entrar', rateLimit({ windowMs: 900_000, limit: 20 }), async (requisicao, resposta) => {
    const d = z.object({ eml_usr: z.string().trim().email(), senha: z.string().max(200), area: z.enum(['ADM', 'EMPRESA', 'ENTREGADOR']).optional() }).parse(requisicao.body);
    const u = await banco.usr_usuarios.findUnique({ where: { eml_usr: d.eml_usr.toLowerCase() } });
    if (!u?.st_atv || !await compare(d.senha, u.sen_hash))
        throw new Falha(401, 'Credenciais inválidas');
    if (d.area && !(d.area === 'ADM' ? operador(u.tp_usr) : d.area === 'EMPRESA' ? u.tp_usr === 'REMETENTE' : u.tp_usr === 'ENTREGADOR'))
        throw new Falha(403, 'Este usuário não pertence ao acesso selecionado. Escolha a opção correta.');
    await validarAcessoEmpresa(u);
    const token = randomBytes(32).toString('hex');
    await redis.set(chaveSessao(token), u.id_usr, 'EX', 3600);
    resposta.cookie('rotaja_sessao', token, { ...cookieOpcoes, maxAge: 3600_000 });
    resposta.json({ token, expira_em: 3600, usuario: { id_usr: u.id_usr, nom_usr: u.nom_usr, tp_usr: u.tp_usr } });
});
// Logout idempotente também limpa cookies de sessões expiradas ou bloqueadas.
aplicacao.post('/autenticacao/sair', async (requisicao, resposta) => {
    if (requisicao.headers.origin && !origens.includes(requisicao.headers.origin))
        throw new Falha(403, 'Origem não permitida');
    const token = tokenRequisicao(requisicao);
    if (token && token.length <= 256) {
        await redis.del(chaveSessao(token));
        io.in(`sessao:${chaveSessao(token)}`).disconnectSockets(true);
    }
    resposta.clearCookie('rotaja_sessao', cookieOpcoes).sendStatus(204);
});
aplicacao.use(async (requisicao, resposta, proximo) => {
    try {
        if (!['GET', 'HEAD', 'OPTIONS'].includes(requisicao.method) && requisicao.headers.origin && !origens.includes(requisicao.headers.origin))
            throw new Falha(403, 'Origem não permitida');
        resposta.locals.ator = await autenticar(tokenRequisicao(requisicao));
        proximo();
    }
    catch (e) {
        proximo(e);
    }
});
registrarPainel(aplicacao, redis);
registrarUsuarios(aplicacao, redis, io);
registrarRelatorios(aplicacao);
registrarCaixaDiario(aplicacao);
registrarCaixaRegistro(aplicacao);
registrarPortal(aplicacao);
registrarControle(aplicacao, io);
aplicacao.post('/usuarios', async (requisicao, resposta) => {
    exigirOperador(ator(resposta));
    const d = z.object({ nom_usr: z.string().min(3).max(150), eml_usr: z.string().email(), senha: z.string().min(16).max(100), tp_usr: z.enum(['ADMINISTRADOR', 'OPERADOR', 'REMETENTE', 'ENTREGADOR']) }).parse(requisicao.body);
    if (['ADMINISTRADOR', 'OPERADOR'].includes(d.tp_usr) && ator(resposta).tp_usr !== 'ADMINISTRADOR')
        throw new Falha(403, 'Somente administrador cria acessos administrativos');
    const { senha, ...dados } = d;
    resposta.status(201).json(await banco.usr_usuarios.create({ data: { ...dados, eml_usr: dados.eml_usr.toLowerCase(), sen_hash: await hash(senha, 12) }, select: { id_usr: true, nom_usr: true, tp_usr: true } }));
});
const empresaSchema = z.object({ id_usr: z.string().uuid(), tp_pes: z.enum(['FISICA', 'JURIDICA']), raz_soc: z.string().min(3), nom_fan: z.string().min(2), doc_emp: z.string().regex(/^(\d{11}|\d{14})$/), log_emp: z.string().min(3), num_emp: z.string().min(1), cmp_emp: z.string().optional(), bai_emp: z.string().min(2), cid_emp: z.string().min(2), uf_emp: z.string().length(2), tel_emp: z.string().regex(/^\+?\d{10,15}$/) }).strict();
aplicacao.post('/empresas', async (requisicao, resposta) => {
    exigirOperador(ator(resposta));
    const d = empresaSchema.parse(requisicao.body);
    if (d.doc_emp.length !== (d.tp_pes === 'FISICA' ? 11 : 14))
        throw new Falha(422, 'Documento incompatível com tipo de pessoa');
    const u = await banco.usr_usuarios.findUnique({ where: { id_usr: d.id_usr } });
    if (u?.tp_usr !== 'REMETENTE')
        throw new Falha(422, 'Selecione um usuário remetente');
    resposta.status(201).json(await banco.emp_empresas.create({ data: d }));
});
aplicacao.get('/empresas', async (_req, resposta) => { exigirOperador(ator(resposta)); resposta.json(await banco.emp_empresas.findMany({ where: { dt_exc: null }, take: 100, orderBy: { nom_fan: 'asc' } })); });
aplicacao.patch('/empresas/:id', async (requisicao, resposta) => { exigirOperador(ator(resposta)); const dados = empresaSchema.omit({ id_usr: true }).partial().extend({ st_atv: z.boolean().optional() }).parse(requisicao.body); resposta.json(await banco.emp_empresas.update({ where: { id_emp: z.string().uuid().parse(requisicao.params.id), dt_exc: null }, data: dados })); });
aplicacao.post('/entregadores', async (requisicao, resposta) => {
    exigirOperador(ator(resposta));
    const d = z.object({ id_usr: z.string().uuid(), doc_cpf: z.string().regex(/^\d{11}$/), pla_moto: z.string().min(7).max(8), tel_ent: z.string().regex(/^\+?\d{10,15}$/) }).parse(requisicao.body);
    const u = await banco.usr_usuarios.findUnique({ where: { id_usr: d.id_usr } });
    if (u?.tp_usr !== 'ENTREGADOR')
        throw new Falha(422, 'Usuário deve ter perfil entregador');
    resposta.status(201).json(await banco.ent_entregadores.create({ data: d }));
});
aplicacao.get('/entregadores', async (requisicao, resposta) => { exigirOperador(ator(resposta)); resposta.json(await banco.ent_entregadores.findMany({ where: { dt_exc: null, ...(requisicao.query.caixa_aberto === 'true' ? { st_atv: true, usuario: { st_atv: true }, aberturas: { some: { id_cx: null, dt_ab: { lte: new Date() } } } } : {}) }, include: { usuario: { select: { nom_usr: true, eml_usr: true, st_atv: true } } }, orderBy: { usuario: { nom_usr: 'asc' } } })); });
aplicacao.get('/bairros', async (_req, resposta) => {
    const a = ator(resposta);
    const emp = a.tp_usr === 'REMETENTE' ? await banco.emp_empresas.findUnique({ where: { id_usr: a.id_usr } }) : null;
    const bairros = await banco.bai_bairros.findMany({ where: { dt_exc: null, ...(operador(a.tp_usr) ? {} : { st_atv: true }) }, orderBy: { nom_bai: 'asc' }, include: { tarifas: { where: { id_emp: emp?.id_emp ?? '00000000-0000-0000-0000-000000000000' } } } });
    resposta.json(bairros.map(({ tarifas, ...b }) => ({ ...b, vlr_tx_ret: b.vlr_tx_ent, ...(tarifas[0] ? { vlr_tx_ent: tarifas[0].vlr_tx_ent, vlr_tx_ret: tarifas[0].vlr_tx_ent } : {}) })));
});
aplicacao.post('/bairros', async (requisicao, resposta) => {
    if (ator(resposta).tp_usr !== 'ADMINISTRADOR')
        throw new Falha(403, 'Somente o administrador define tarifas');
    const moeda = z.string().regex(/^\d{1,9}(\.\d{1,2})?$/);
    const dados = z.object({ nom_bai: z.string().min(2), cid_bai: z.string().min(2), uf_bai: z.string().length(2), vlr_tx_ent: moeda, vlr_ganho_ent: moeda, vlr_tx_ret: moeda, vlr_ganho_ret: moeda, st_sob_consulta: z.boolean().default(false) }).parse(requisicao.body);
    resposta.status(201).json(await banco.bai_bairros.create({ data: dados }));
});
function publicar(p) {
    // Apenas metadados: dados pessoais são consultados via HTTP com autorização atual.
    io.to('operacao').to(`usr:${p.id_usr}`).emit('pedido:atualizado', { id_ped: p.id_ped, versao: p.versao, st_ped: p.st_ped });
    banco.ped_pedidos.findUnique({ where: { id_ped: p.id_ped }, select: { entregador: { select: { id_usr: true } } } }).then(r => {
        if (r?.entregador)
            io.to(`usr:${r.entregador.id_usr}`).emit('pedido:atualizado', { id_ped: p.id_ped });
    }).catch(() => console.error('Falha ao notificar entregador'));
}
aplicacao.post('/pedidos', async (requisicao, resposta) => { const p = await criarPedido(ator(resposta), requisicao.body); publicar(p); resposta.status(201).json(p); });
aplicacao.post('/operacao/pedidos', (_req, _res) => { throw new Falha(403, 'Somente lojas podem abrir chamadas'); });
async function escopo(a) {
    if (operador(a.tp_usr))
        return {};
    if (a.tp_usr === 'REMETENTE')
        return { id_usr: a.id_usr };
    return { entregador: { id_usr: a.id_usr } };
}
aplicacao.get('/pedidos', async (requisicao, resposta) => {
    const pagina = z.coerce.number().int().min(1).max(100000).default(1).parse(requisicao.query.pagina);
    const where = await escopo(ator(resposta));
    const filtro = z.object({ busca: z.string().max(120).optional(), status: z.enum(['PRONTO', 'ATRIBUIDO', 'ACEITO', 'EM_COLETA', 'NO_LOCAL', 'EM_ENTREGA', 'EM_RETORNO', 'CONCLUIDO', 'CANCELADO', 'ATIVOS']).optional() }).parse(requisicao.query);
    if (filtro.status)
        where.st_ped = filtro.status === 'ATIVOS' ? { notIn: ['CONCLUIDO', 'CANCELADO'] } : filtro.status;
    if (filtro.busca)
        where.OR = [{ nom_dest: { contains: filtro.busca, mode: 'insensitive' } }, { empresa: { nom_fan: { contains: filtro.busca, mode: 'insensitive' } } }, ...(/^\d{1,9}$/.test(filtro.busca) ? [{ num_ped: Number(filtro.busca) }] : [])];
    const [total, itens] = await banco.$transaction([banco.ped_pedidos.count({ where }), banco.ped_pedidos.findMany({ where, take: 20, skip: (pagina - 1) * 20, orderBy: { dt_cad: 'desc' }, include: { bairro: true, empresa: { select: { nom_fan: true } }, entregador: { select: { id_ent: true, usuario: { select: { nom_usr: true } } } } } })]);
    resposta.json({ pagina, total, paginas: Math.max(1, Math.ceil(total / 20)), itens });
});
aplicacao.get('/pedidos/:id', async (requisicao, resposta) => {
    const p = await banco.ped_pedidos.findFirst({ where: { ...await escopo(ator(resposta)), id_ped: z.string().uuid().parse(requisicao.params.id) }, include: { bairro: true, empresa: { select: { nom_fan: true } }, entregador: { select: { id_ent: true, usuario: { select: { nom_usr: true } } } } } });
    if (!p)
        throw new Falha(404, 'Pedido não encontrado');
    resposta.json(p);
});
aplicacao.get('/pedidos/:id/historico', async (requisicao, resposta) => { exigirOperador(ator(resposta)); resposta.json(await banco.log_historico_pedidos.findMany({ where: { id_ped: z.string().uuid().parse(requisicao.params.id) }, orderBy: { dt_cad: 'asc' } })); });
aplicacao.post('/pedidos/status', async (requisicao, resposta) => { const p = await mudarStatus(ator(resposta), requisicao.body); publicar(p); resposta.json(p); });
aplicacao.patch('/pedidos/:id', async (requisicao, resposta) => {
    exigirOperador(ator(resposta));
    const d = z.object({ versao: z.number().int().nonnegative(), motivo: z.string().min(10).max(500), nom_dest: z.string().min(1).optional(), log_dest: z.string().min(1).optional(), num_dest: z.string().min(1).optional(), cmp_dest: z.string().optional(), ref_dest: z.string().optional(), tel_dest: z.string().regex(/^\+?\d{10,15}$/).optional(), vlr_cobrar: z.string().regex(/^\d{1,9}(\.\d{1,2})?$/).optional(), vlr_tx: z.string().regex(/^\d{1,9}(\.\d{1,2})?$/).optional(), vlr_ganho_ent: z.string().regex(/^\d{1,9}(\.\d{1,2})?$/).optional(), id_bai: z.string().uuid().optional() }).strict().parse(requisicao.body);
    if (ator(resposta).tp_usr !== 'ADMINISTRADOR' && (d.vlr_tx !== undefined || d.vlr_ganho_ent !== undefined || d.vlr_cobrar !== undefined))
        throw new Falha(403, 'Somente o administrador altera valores');
    const p = await transacao(async (tx) => {
        const id_ped = z.string().uuid().parse(requisicao.params.id);
        const antes = await tx.ped_pedidos.findUniqueOrThrow({ where: { id_ped } });
        if (antes.id_cx || antes.id_rep || ['CONCLUIDO', 'CANCELADO'].includes(antes.st_ped))
            throw new Falha(409, 'Pedido encerrado exige lançamento de ajuste financeiro; não reescreva o histórico');
        if (d.id_bai && !await tx.bai_bairros.findFirst({ where: { id_bai: d.id_bai, st_atv: true, dt_exc: null } }))
            throw new Falha(422, 'Bairro não permitido');
        const { versao, motivo, ...campos } = d;
        if (antes.st_pag === 'PAGO' && d.vlr_cobrar !== undefined)
            throw new Falha(422, 'Pedido pago não recebe cobrança');
        const vlr_cobrar = new Prisma.Decimal(d.vlr_cobrar ?? antes.vlr_cobrar);
        const taxa = new Prisma.Decimal(d.vlr_tx ?? antes.vlr_tx);
        if (antes.st_pag === 'A_RECEBER' && vlr_cobrar.lessThan(taxa))
            throw new Falha(422, 'O total deve incluir a taxa');
        const vlr_prod = antes.st_pag === 'A_RECEBER' ? vlr_cobrar.minus(taxa) : antes.vlr_prod;
        const r = await tx.ped_pedidos.updateMany({ where: { id_ped, versao }, data: { ...campos, vlr_cobrar, vlr_prod, versao: { increment: 1 } } });
        if (!r.count)
            throw new Falha(409, 'Versão desatualizada');
        const depois = await tx.ped_pedidos.findUniqueOrThrow({ where: { id_ped } });
        await tx.log_historico_pedidos.create({ data: { id_ped, id_usr: ator(resposta).id_usr, acao: 'EDICAO_ADMINISTRATIVA', dados_ant: JSON.parse(JSON.stringify(antes)), dados_nov: { motivo, pedido: JSON.parse(JSON.stringify(depois)) } } });
        return depois;
    });
    publicar(p);
    resposta.json(p);
});
aplicacao.post('/repasses', async (requisicao, resposta) => {
    exigirOperador(ator(resposta));
    const d = z.object({ id_emp: z.string().uuid(), dt_ini: z.string().datetime({ offset: true }), dt_fim: z.string().datetime({ offset: true }) }).parse(requisicao.body);
    const inicio = new Date(d.dt_ini), fim = new Date(d.dt_fim);
    if (inicio >= fim || fim > new Date())
        throw new Falha(422, 'Período inválido');
    resposta.status(201).json(await transacao(async (tx) => {
        const existente = await tx.rep_repasses_lojas.findUnique({ where: { id_emp_dt_ini_dt_fim: { id_emp: d.id_emp, dt_ini: inicio, dt_fim: fim } } });
        if (existente)
            return existente;
        const pedidos = await tx.ped_pedidos.findMany({ where: { id_emp: d.id_emp, st_ped: 'CONCLUIDO', dt_conc: { gte: inicio, lt: fim } } });
        if (pedidos.some(p => p.id_rep))
            throw new Falha(409, 'Período sobrepõe repasse já gerado');
        // Convenção: o ADM retém o frete. PIX/CARTAO pagos direto à loja já estão liquidados.
        const valor = pedidos.reduce((s, p) => s.plus(p.vlr_rec_din).minus(p.vlr_tx), new Prisma.Decimal(0));
        const repasse = await tx.rep_repasses_lojas.create({ data: { id_emp: d.id_emp, dt_ini: inicio, dt_fim: fim, vlr_rep: valor } });
        await tx.ped_pedidos.updateMany({ where: { id_ped: { in: pedidos.map(p => p.id_ped) } }, data: { id_rep: repasse.id_rep } });
        return repasse;
    }));
});
aplicacao.post('/repasses/:id/quitar', async (requisicao, resposta) => {
    exigirOperador(ator(resposta));
    const d = z.object({ ref_comprovante: z.string().min(5).max(200) }).parse(requisicao.body);
    const r = await banco.rep_repasses_lojas.updateMany({ where: { id_rep: z.string().uuid().parse(requisicao.params.id), st_rep: 'PENDENTE' }, data: { ...d, st_rep: 'QUITADO', dt_pag: new Date() } });
    if (!r.count)
        throw new Falha(409, 'Repasse já quitado ou ausente');
    resposta.sendStatus(204);
});
aplicacao.post('/gps', async (requisicao, resposta) => {
    const a = ator(resposta);
    if (a.tp_usr !== 'ENTREGADOR')
        throw new Falha(403, 'Apenas entregadores enviam GPS');
    const d = z.object({ id_ped: z.string().uuid(), lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), dt: z.string().datetime() }).parse(requisicao.body);
    if (Math.abs(Date.now() - Date.parse(d.dt)) > 60_000)
        throw new Falha(422, 'Posição antiga');
    const p = await banco.ped_pedidos.findFirst({ where: { id_ped: d.id_ped, entregador: { id_usr: a.id_usr }, st_ped: { in: ['ACEITO', 'EM_COLETA', 'NO_LOCAL', 'EM_ENTREGA', 'EM_RETORNO'] } } });
    if (!p)
        throw new Falha(403, 'Sem corrida ativa atribuída');
    if (!await redis.set(`gps:limite:${a.id_usr}`, '1', 'EX', 5, 'NX')) {
        resposta.sendStatus(429);
        return;
    }
    await redis.set(`gps:${p.id_ped}`, JSON.stringify(d), 'EX', 120);
    io.to('operacao').to(`usr:${p.id_usr}`).emit('gps:posicao', d);
    resposta.sendStatus(204);
});
aplicacao.post('/caixas/fechar', async (requisicao, resposta) => { resposta.json(await fecharCaixa(ator(resposta), requisicao.body)); });
aplicacao.post('/caixas/:id/quitar', async (requisicao, resposta) => {
    exigirOperador(ator(resposta));
    const d = z.object({ ref_comprovante: z.string().min(5).max(200) }).parse(requisicao.body);
    const r = await banco.cx_caixa_entregador.updateMany({ where: { id_cx: z.string().uuid().parse(requisicao.params.id), st_cx: 'AGUARDANDO_VALIDACAO' }, data: { ...d, st_cx: 'QUITADO', id_usr_val: ator(resposta).id_usr, dt_val: new Date() } });
    if (!r.count)
        throw new Falha(409, 'Caixa não está aguardando validação');
    resposta.sendStatus(204);
});
io.use(async (socket, proximo) => {
    try {
        const token = socket.handshake.auth.token ?? tokenRequisicao(socket.request);
        socket.data.ator = await autenticar(token);
        socket.data.token = token;
        proximo();
    }
    catch {
        proximo(new Error('Sessão inválida'));
    }
});
io.on('connection', socket => {
    const a = socket.data.ator;
    socket.join(`sessao:${chaveSessao(socket.data.token)}`);
    socket.join(`usr:${a.id_usr}`);
    if (a.tp_usr === 'REMETENTE')
        socket.join('empresas');
    if (operador(a.tp_usr))
        socket.join('operacao');
    const expirar = setTimeout(() => socket.disconnect(true), 3600_000);
    socket.on('disconnect', () => clearTimeout(expirar));
    socket.on('pedido:despachar', async (dados, ack) => {
        if (typeof ack !== 'function')
            return;
        try {
            const atual = await autenticar(socket.data.token);
            const r = await despachar(atual, dados);
            publicar(r.pedido);
            io.to(`usr:${r.id_usr_ent}`).emit('chamado:atribuido', { id_ped: r.pedido.id_ped });
            ack({ ok: true, pedido: r.pedido });
        }
        catch (e) {
            ack({ ok: false, mensagem: e instanceof Falha ? e.message : 'Não foi possível despachar' });
        }
    });
    socket.on('gps:atualizar', async (dados) => {
        try {
            const atual = await autenticar(socket.data.token);
            if (atual.tp_usr !== 'ENTREGADOR')
                return;
            const d = z.object({ id_ped: z.string().uuid(), lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), dt: z.string().datetime() }).parse(dados);
            if (Math.abs(Date.now() - Date.parse(d.dt)) > 60_000)
                return;
            if (!await redis.set(`gps:limite:${atual.id_usr}`, '1', 'EX', 5, 'NX'))
                return;
            const p = await banco.ped_pedidos.findFirst({ where: { id_ped: d.id_ped, entregador: { id_usr: atual.id_usr }, st_ped: { in: ['ACEITO', 'EM_COLETA', 'NO_LOCAL', 'EM_ENTREGA', 'EM_RETORNO'] } } });
            if (!p)
                return;
            await redis.set(`gps:${p.id_ped}`, JSON.stringify(d), 'EX', 120);
            io.to('operacao').to(`usr:${p.id_usr}`).emit('gps:posicao', d);
        }
        catch { /* Pacotes inválidos são descartados sem expor dados internos. */ }
    });
});
aplicacao.use((erro, _req, resposta, _next) => {
    if (erro instanceof ZodError) {
        resposta.status(422).json({ erro: 'Dados inválidos', campos: erro.flatten() });
        return;
    }
    if (erro instanceof Falha) {
        resposta.status(erro.codigo).json({ erro: erro.message });
        return;
    }
    if (erro instanceof Prisma.PrismaClientKnownRequestError) {
        const codigo = erro.code === 'P2025' ? 404 : ['P2002', 'P2034'].includes(erro.code) ? 409 : 422;
        const alvo = String(erro.meta?.target ?? '');
        const duplicado = alvo.includes('eml_usr') ? 'Este e-mail já está cadastrado. Use outro e-mail ou consulte o usuário existente.' : alvo.includes('doc_emp') ? 'Este CPF/CNPJ já pertence a uma empresa cadastrada, inclusive se excluída. Consulte o cadastro existente.' : alvo.includes('id_usr') ? 'Este usuário já está vinculado a um cadastro.' : 'Já existe um cadastro com estes dados. Confira os campos e tente novamente.';
        resposta.status(codigo).json({ erro: erro.code === 'P2002' ? duplicado : erro.code === 'P2025' ? 'Cadastro não encontrado ou já excluído. Atualize a lista.' : erro.code === 'P2034' ? 'Outra alteração ocorreu ao mesmo tempo. Tente novamente.' : 'Não foi possível salvar: confira os dados e vínculos do cadastro.' });
        return;
    }
    console.error('Falha interna na requisição');
    resposta.status(500).json({ erro: 'Erro interno' });
});
http.listen(Number(process.env.PORT ?? 3001), '0.0.0.0', () => console.log('API RotaJá disponível'));
async function encerrar() { io.close(); http.close(); await banco.$disconnect(); redis.disconnect(); sub.disconnect(); }
process.on('SIGTERM', encerrar);
process.on('SIGINT', encerrar);
