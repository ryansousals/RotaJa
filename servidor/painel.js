import { hash } from 'bcryptjs';
import { z } from 'zod';
import { banco, transacao } from './servicos.js';
import { calcularCaixa, Falha, operador } from './dominio.js';
const ator = (r) => r.locals.ator;
const exigir = (r) => { if (!operador(ator(r).tp_usr))
    throw new Falha(403, 'Acesso restrito à operação'); };
const id = z.string().uuid();
const moeda = z.string().regex(/^\d{1,9}(\.\d{1,2})?$/);
const usuario = z.object({ nom_usr: z.string().trim().min(3).max(150), eml_usr: z.string().trim().email().transform(v => v.toLowerCase()), senha: z.string().min(16).max(100) });
export function registrarPainel(aplicacao, redis) {
    aplicacao.get('/empresas/:id/tarifas', async (requisicao, resposta) => {
        exigir(resposta);
        const id_emp = id.parse(requisicao.params.id);
        await banco.emp_empresas.findUniqueOrThrow({ where: { id_emp } });
        const bairros = await banco.bai_bairros.findMany({ where: { dt_exc: null }, orderBy: { nom_bai: 'asc' }, include: { tarifas: { where: { id_emp } } } });
        resposta.json(bairros.map(({ tarifas, ...b }) => ({ ...b, vlr_tx_ret: b.vlr_tx_ent, personalizada: !!tarifas[0], ...(tarifas[0] ? { vlr_tx_ent: tarifas[0].vlr_tx_ent, vlr_tx_ret: tarifas[0].vlr_tx_ent } : {}) })));
    });
    aplicacao.put('/empresas/:id/tarifas/:bairro', async (requisicao, resposta) => {
        if (ator(resposta).tp_usr !== 'ADMINISTRADOR')
            throw new Falha(403, 'Somente o administrador define tarifas');
        const id_emp = id.parse(requisicao.params.id), id_bai = id.parse(requisicao.params.bairro);
        const dados = z.object({ vlr_tx_ent: moeda, vlr_tx_ret: moeda }).strict().parse(requisicao.body);
        await banco.bai_bairros.findUniqueOrThrow({ where: { id_bai, dt_exc: null } });
        resposta.json(await banco.tx_taxas_empresas.upsert({ where: { id_emp_id_bai: { id_emp, id_bai } }, create: { id_emp, id_bai, ...dados }, update: dados }));
    });
    aplicacao.get('/autenticacao/eu', async (_req, resposta) => {
        resposta.json(await banco.usr_usuarios.findUniqueOrThrow({ where: { id_usr: ator(resposta).id_usr }, select: { id_usr: true, nom_usr: true, eml_usr: true, tp_usr: true, empresa: true, entregador: true } }));
    });
    aplicacao.post('/cadastros/empresa', async (requisicao, resposta) => {
        exigir(resposta);
        const d = usuario.extend({ tp_pes: z.enum(['FISICA', 'JURIDICA']), raz_soc: z.string().min(3), nom_fan: z.string().min(2), doc_emp: z.string().regex(/^(\d{11}|\d{14})$/), log_emp: z.string().min(3), num_emp: z.string().min(1), cmp_emp: z.string().optional(), bai_emp: z.string().min(2), cid_emp: z.string().min(2), uf_emp: z.string().length(2), tel_emp: z.string().regex(/^\+?\d{10,15}$/) }).strict().parse(requisicao.body);
        if (d.doc_emp.length !== (d.tp_pes === 'FISICA' ? 11 : 14))
            throw new Falha(422, 'Documento incompatível com tipo de pessoa');
        const { nom_usr, eml_usr, senha, ...empresa } = d;
        const sen_hash = await hash(senha, 12);
        resposta.status(201).json(await transacao(async (tx) => { const u = await tx.usr_usuarios.create({ data: { nom_usr, eml_usr, sen_hash, tp_usr: 'REMETENTE' } }); return tx.emp_empresas.create({ data: { ...empresa, id_usr: u.id_usr } }); }));
    });
    aplicacao.post('/cadastros/entregador', async (requisicao, resposta) => {
        exigir(resposta);
        const d = usuario.extend({ doc_cpf: z.string().regex(/^\d{11}$/), pla_moto: z.string().min(7).max(8), tel_ent: z.string().regex(/^\+?\d{10,15}$/) }).strict().parse(requisicao.body);
        const { nom_usr, eml_usr, senha, ...entregador } = d;
        const sen_hash = await hash(senha, 12);
        resposta.status(201).json(await transacao(async (tx) => { const u = await tx.usr_usuarios.create({ data: { nom_usr, eml_usr, sen_hash, tp_usr: 'ENTREGADOR' } }); return tx.ent_entregadores.create({ data: { ...entregador, id_usr: u.id_usr } }); }));
    });
    aplicacao.patch('/entregadores/:id', async (requisicao, resposta) => { exigir(resposta); resposta.json(await banco.ent_entregadores.update({ where: { id_ent: id.parse(requisicao.params.id), dt_exc: null }, data: z.object({ st_atv: z.boolean(), pla_moto: z.string().min(7).max(8).optional(), tel_ent: z.string().regex(/^\+?\d{10,15}$/).optional() }).parse(requisicao.body) })); });
    aplicacao.delete('/bairros/:id', async (requisicao, resposta) => {
        if (ator(resposta).tp_usr !== 'ADMINISTRADOR')
            throw new Falha(403, 'Somente o administrador pode excluir bairros');
        const id_bai = id.parse(requisicao.params.id);
        await transacao(async (tx) => {
            const bairro = await tx.bai_bairros.findUniqueOrThrow({ where: { id_bai } });
            if (!bairro.dt_exc)
                await tx.bai_bairros.update({ where: { id_bai }, data: { st_atv: false, dt_exc: new Date() } });
        });
        resposta.sendStatus(204);
    });
    aplicacao.patch('/bairros/:id', async (requisicao, resposta) => { if (ator(resposta).tp_usr !== 'ADMINISTRADOR')
        throw new Falha(403, 'Somente o administrador altera bairros e tarifas'); resposta.json(await banco.bai_bairros.update({ where: { id_bai: id.parse(requisicao.params.id), dt_exc: null }, data: z.object({ nom_bai: z.string().min(2).optional(), vlr_tx_ent: moeda.optional(), vlr_ganho_ent: moeda.optional(), vlr_tx_ret: moeda.optional(), vlr_ganho_ret: moeda.optional(), st_sob_consulta: z.boolean().optional(), st_atv: z.boolean().optional() }).strict().parse(requisicao.body) })); });
    aplicacao.get('/painel', async (_req, resposta) => {
        const a = ator(resposta);
        const escopo = operador(a.tp_usr) ? {} : a.tp_usr === 'REMETENTE' ? { id_usr: a.id_usr } : { entregador: { id_usr: a.id_usr } };
        const grupos = await banco.ped_pedidos.groupBy({ by: ['st_ped'], where: escopo, _count: true });
        resposta.json({ estados: Object.fromEntries(grupos.map(g => [g.st_ped, g._count])), total: grupos.reduce((s, g) => s + g._count, 0) });
    });
    aplicacao.get('/financeiro', async (requisicao, resposta) => {
        const a = ator(resposta);
        const ent = a.tp_usr === 'ENTREGADOR' ? await banco.ent_entregadores.findUnique({ where: { id_usr: a.id_usr } }) : null;
        const emp = a.tp_usr === 'REMETENTE' ? await banco.emp_empresas.findUnique({ where: { id_usr: a.id_usr } }) : null;
        if (a.tp_usr === 'ENTREGADOR' && !ent || a.tp_usr === 'REMETENTE' && !emp)
            throw new Falha(403, 'Perfil não cadastrado');
        const d = z.object({ inicio: z.string().datetime({ offset: true }), fim: z.string().datetime({ offset: true }) }).parse(requisicao.query);
        const inicio = new Date(d.inicio), fim = new Date(d.fim);
        if (inicio >= fim || fim.getTime() - inicio.getTime() > 366 * 86400000)
            throw new Falha(422, 'Selecione um período de até 366 dias');
        const pedidos = await banco.ped_pedidos.findMany({ where: { st_ped: 'CONCLUIDO', dt_conc: { gte: inicio, lt: fim }, ...(ent ? { id_ent: ent.id_ent } : emp ? { id_emp: emp.id_emp } : {}) }, select: { vlr_ganho_ent: true, vlr_rec_din: true } });
        const caixas = a.tp_usr === 'REMETENTE' ? [] : await banco.cx_caixa_entregador.findMany({ where: { ...(ent ? { id_ent: ent.id_ent } : {}), dt_ini: { lt: fim }, dt_fim: { gt: inicio } }, include: { entregador: { select: { usuario: { select: { nom_usr: true } } } } }, orderBy: { dt_ini: 'desc' }, take: 100 });
        const repasses = a.tp_usr === 'ENTREGADOR' ? [] : await banco.rep_repasses_lojas.findMany({ where: { ...(emp ? { id_emp: emp.id_emp } : {}), dt_ini: { lt: fim }, dt_fim: { gt: inicio } }, include: { empresa: { select: { nom_fan: true } } }, orderBy: { dt_ini: 'desc' }, take: 100 });
        resposta.json({ resumo: calcularCaixa(pedidos), caixas, repasses });
    });
    aplicacao.get('/pedidos/:id/gps', async (requisicao, resposta) => {
        const a = ator(resposta), id_ped = id.parse(requisicao.params.id);
        const p = await banco.ped_pedidos.findFirst({ where: { id_ped, ...(operador(a.tp_usr) ? {} : a.tp_usr === 'REMETENTE' ? { id_usr: a.id_usr } : { entregador: { id_usr: a.id_usr } }) } });
        if (!p)
            throw new Falha(404, 'Pedido não encontrado');
        const posicao = ['CONCLUIDO', 'CANCELADO', 'PRONTO', 'ATRIBUIDO'].includes(p.st_ped) ? null : await redis.get(`gps:${id_ped}`);
        resposta.json(posicao ? JSON.parse(posicao) : null);
    });
}
