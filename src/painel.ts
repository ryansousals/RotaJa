import type { Express, Response } from 'express';
import type { Redis } from 'ioredis';
import { hash } from 'bcryptjs';
import { z } from 'zod';
import { banco, transacao, type Ator } from './servicos.js';
import { calcularCaixa, Falha, operador } from './dominio.js';
const ator = (r: Response) => r.locals.ator as Ator;
const exigir = (r: Response) => { if (!operador(ator(r).tp_usr)) throw new Falha(403, 'Acesso restrito à operação'); };
const id = z.string().uuid();
const moeda = z.string().regex(/^\d{1,9}(\.\d{1,2})?$/);
const usuario = z.object({ nom_usr: z.string().trim().min(3).max(150), eml_usr: z.string().email().transform(v => v.toLowerCase()), senha: z.string().min(16).max(100) });
export function registrarPainel(app: Express, redis: Redis) {
  app.get('/empresas/:id/tarifas', async (req, res) => {
    exigir(res); const id_emp = id.parse(req.params.id);
    await banco.emp_empresas.findUniqueOrThrow({ where: { id_emp } });
    const bairros = await banco.bai_bairros.findMany({ orderBy: { nom_bai: 'asc' }, include: { tarifas: { where: { id_emp } } } });
    res.json(bairros.map(({ tarifas, ...b }) => ({ ...b, personalizada: !!tarifas[0], ...(tarifas[0] ? { vlr_tx_ent: tarifas[0].vlr_tx_ent, vlr_tx_ret: tarifas[0].vlr_tx_ret } : {}) })));
  });
  app.put('/empresas/:id/tarifas/:bairro', async (req, res) => {
    if (ator(res).tp_usr !== 'ADMINISTRADOR') throw new Falha(403, 'Somente o administrador define tarifas');
    const id_emp = id.parse(req.params.id), id_bai = id.parse(req.params.bairro);
    const dados = z.object({ vlr_tx_ent: moeda, vlr_tx_ret: moeda }).strict().parse(req.body);
    res.json(await banco.tx_taxas_empresas.upsert({ where: { id_emp_id_bai: { id_emp, id_bai } }, create: { id_emp, id_bai, ...dados }, update: dados }));
  });
  app.get('/autenticacao/eu', async (_req, res) => {
    res.json(await banco.usr_usuarios.findUniqueOrThrow({ where: { id_usr: ator(res).id_usr }, select: { id_usr: true, nom_usr: true, eml_usr: true, tp_usr: true, empresa: true, entregador: true } }));
  });
  app.get('/usuarios', async (_req, res) => { exigir(res); res.json(await banco.usr_usuarios.findMany({ select: { id_usr: true, nom_usr: true, eml_usr: true, tp_usr: true, st_atv: true, dt_cad: true }, orderBy: { nom_usr: 'asc' }, take: 500 })); });
  app.patch('/usuarios/:id', async (req, res) => {
    exigir(res); const id_usr = id.parse(req.params.id);
    const alvo = await banco.usr_usuarios.findUniqueOrThrow({ where: { id_usr } });
    if (alvo.tp_usr === 'ADMINISTRADOR' || (alvo.tp_usr === 'OPERADOR' && ator(res).tp_usr !== 'ADMINISTRADOR') || id_usr === ator(res).id_usr) throw new Falha(403, 'Este usuário não pode ser alterado nesta tela');
    res.json(await banco.usr_usuarios.update({ where: { id_usr }, data: z.object({ st_atv: z.boolean() }).strict().parse(req.body), select: { id_usr: true, st_atv: true } }));
  });
  app.post('/cadastros/empresa', async (req, res) => {
    exigir(res);
    const d = usuario.extend({ tp_pes: z.enum(['FISICA','JURIDICA']), raz_soc: z.string().min(3), nom_fan: z.string().min(2), doc_emp: z.string().regex(/^(\d{11}|\d{14})$/), log_emp: z.string().min(3), num_emp: z.string().min(1), cmp_emp: z.string().optional(), bai_emp: z.string().min(2), cid_emp: z.string().min(2), uf_emp: z.string().length(2), tel_emp: z.string().regex(/^\+?\d{10,15}$/) }).strict().parse(req.body);
    if (d.doc_emp.length !== (d.tp_pes === 'FISICA' ? 11 : 14)) throw new Falha(422, 'Documento incompatível com tipo de pessoa');
    const { nom_usr, eml_usr, senha, ...empresa } = d; const sen_hash = await hash(senha, 12);
    res.status(201).json(await transacao(async tx => { const u = await tx.usr_usuarios.create({ data: { nom_usr, eml_usr, sen_hash, tp_usr: 'REMETENTE' } }); return tx.emp_empresas.create({ data: { ...empresa, id_usr: u.id_usr } }); }));
  });
  app.post('/cadastros/entregador', async (req, res) => {
    exigir(res); const d = usuario.extend({ doc_cpf: z.string().regex(/^\d{11}$/), pla_moto: z.string().min(7).max(8), tel_ent: z.string().regex(/^\+?\d{10,15}$/) }).strict().parse(req.body);
    const { nom_usr, eml_usr, senha, ...entregador } = d; const sen_hash = await hash(senha, 12);
    res.status(201).json(await transacao(async tx => { const u = await tx.usr_usuarios.create({ data: { nom_usr, eml_usr, sen_hash, tp_usr: 'ENTREGADOR' } }); return tx.ent_entregadores.create({ data: { ...entregador, id_usr: u.id_usr } }); }));
  });
  app.patch('/entregadores/:id', async (req, res) => { exigir(res); res.json(await banco.ent_entregadores.update({ where: { id_ent: id.parse(req.params.id) }, data: z.object({ st_atv: z.boolean(), pla_moto: z.string().min(7).max(8).optional(), tel_ent: z.string().regex(/^\+?\d{10,15}$/).optional() }).parse(req.body) })); });
  app.patch('/bairros/:id', async (req, res) => { if (ator(res).tp_usr !== 'ADMINISTRADOR') throw new Falha(403, 'Somente o administrador altera bairros e tarifas'); res.json(await banco.bai_bairros.update({ where: { id_bai: id.parse(req.params.id) }, data: z.object({ nom_bai: z.string().min(2).optional(), vlr_tx_ent: moeda.optional(), vlr_ganho_ent: moeda.optional(), vlr_tx_ret: moeda.optional(), vlr_ganho_ret: moeda.optional(), st_atv: z.boolean().optional() }).strict().parse(req.body) })); });
  app.get('/painel', async (_req, res) => {
    const a = ator(res); const escopo = operador(a.tp_usr) ? {} : a.tp_usr === 'REMETENTE' ? { id_usr: a.id_usr } : { entregador: { id_usr: a.id_usr } };
    const grupos = await banco.ped_pedidos.groupBy({ by: ['st_ped'], where: escopo, _count: true });
    res.json({ estados: Object.fromEntries(grupos.map(g => [g.st_ped, g._count])), total: grupos.reduce((s,g) => s + g._count, 0) });
  });
  app.get('/financeiro', async (req, res) => {
    const a = ator(res);
    const ent = a.tp_usr === 'ENTREGADOR' ? await banco.ent_entregadores.findUnique({ where: { id_usr: a.id_usr } }) : null;
    const emp = a.tp_usr === 'REMETENTE' ? await banco.emp_empresas.findUnique({ where: { id_usr: a.id_usr } }) : null;
    if (a.tp_usr === 'ENTREGADOR' && !ent || a.tp_usr === 'REMETENTE' && !emp) throw new Falha(403, 'Perfil não cadastrado');
    const d = z.object({ inicio: z.string().datetime({ offset: true }), fim: z.string().datetime({ offset: true }) }).parse(req.query);
    const inicio = new Date(d.inicio), fim = new Date(d.fim);
    if (inicio >= fim || fim.getTime() - inicio.getTime() > 366 * 86400000) throw new Falha(422, 'Selecione um período de até 366 dias');
    const pedidos = await banco.ped_pedidos.findMany({ where: { st_ped: 'CONCLUIDO', dt_conc: { gte: inicio, lt: fim }, ...(ent ? { id_ent: ent.id_ent } : emp ? { id_emp: emp.id_emp } : {}) }, select: { vlr_ganho_ent: true, vlr_rec_din: true } });
    const caixas = a.tp_usr === 'REMETENTE' ? [] : await banco.cx_caixa_entregador.findMany({ where: { ...(ent ? { id_ent: ent.id_ent } : {}), dt_ini: { lt: fim }, dt_fim: { gt: inicio } }, include: { entregador: { select: { usuario: { select: { nom_usr: true } } } } }, orderBy: { dt_ini: 'desc' }, take: 100 });
    const repasses = a.tp_usr === 'ENTREGADOR' ? [] : await banco.rep_repasses_lojas.findMany({ where: { ...(emp ? { id_emp: emp.id_emp } : {}), dt_ini: { lt: fim }, dt_fim: { gt: inicio } }, include: { empresa: { select: { nom_fan: true } } }, orderBy: { dt_ini: 'desc' }, take: 100 });
    res.json({ resumo: calcularCaixa(pedidos), caixas, repasses });
  });
  app.get('/pedidos/:id/gps', async (req, res) => {
    const a = ator(res), id_ped = id.parse(req.params.id);
    const p = await banco.ped_pedidos.findFirst({ where: { id_ped, ...(operador(a.tp_usr) ? {} : a.tp_usr === 'REMETENTE' ? { id_usr: a.id_usr } : { entregador: { id_usr: a.id_usr } }) } });
    if (!p) throw new Falha(404, 'Pedido não encontrado');
    const posicao = ['CONCLUIDO','CANCELADO','PREPARANDO','ATRIBUIDO'].includes(p.st_ped) ? null : await redis.get(`gps:${id_ped}`);
    res.json(posicao ? JSON.parse(posicao) : null);
  });
}
