import { acumularMovimentos, disponibilidade, exigirDiaAberto } from './movimentos-caixa.js';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { banco, transacao } from './servicos.js';
import { calcularCaixa, Falha, operador } from './dominio.js';
import { conferirCaixa } from './conferencia.js';
const moeda = z.string().regex(/^\d{1,9}(\.\d{1,2})?$/), ajuste = z.string().regex(/^-?\d{1,9}(\.\d{1,2})?$/);
const valores = z.object({ dinheiro: moeda, cartao: moeda, pix: moeda, online: moeda }).strict();
const ator = (resposta) => resposta.locals.ator;
export async function acessoCaixa(tx, a, id_ent) { const e = await tx.ent_entregadores.findUniqueOrThrow({ where: { id_ent } }); if (!operador(a.tp_usr) && (a.tp_usr !== 'ENTREGADOR' || e.id_usr !== a.id_usr))
    throw new Falha(403, 'Caixa não permitido'); return e; }
export async function previaCaixa(tx, id_ab, a, fim) {
    const ab = await tx.ab_aberturas_caixa.findUniqueOrThrow({ where: { id_ab }, include: { entregador: { include: { usuario: { select: { nom_usr: true } } } } } });
    await acessoCaixa(tx, a, ab.id_ent);
    if (ab.id_cx)
        throw new Falha(409, 'Abertura já fechada');
    if (fim <= ab.dt_ab || fim > new Date())
        throw new Falha(422, 'Período de fechamento inválido');
    const pedidos = await tx.ped_pedidos.findMany({ where: { id_ent: ab.id_ent, st_ped: 'CONCLUIDO', dt_conc: { gte: ab.dt_ab, lt: fim } } });
    if (pedidos.some(p => p.id_cx))
        throw new Falha(409, 'Existem entregas já fechadas neste período');
    const sistema = { dinheiro: '0.00', cartao: '0.00', pix: '0.00', online: '0.00' };
    for (const p of pedidos) {
        const k = p.tp_rec === 'DINHEIRO' ? 'dinheiro' : p.tp_rec === 'CARTAO_LOJA' ? 'cartao' : p.tp_rec === 'PIX_LOJA' ? 'pix' : p.tp_rec === 'ONLINE_LOJA' ? 'online' : null;
        if (k)
            sistema[k] = new Prisma.Decimal(sistema[k]).plus(p.vlr_rec_din).plus(p.vlr_rec_loja).toFixed(2);
    }
    const movimentos = await tx.mov_movimentos_caixa.findMany({ where: { id_ab, dt_mov: { lt: fim } }, orderBy: { dt_mov: 'asc' } });
    const mov = acumularMovimentos(movimentos), resumo = calcularCaixa(pedidos);
    resumo.vlr_saldo_rep_adm = resumo.vlr_saldo_rep_adm.plus(ab.vlr_ab).plus(mov.troco).minus(mov.parcial.dinheiro);
    return { ab, pedidos, sistema, resumo, dt_fim: fim.toISOString(), movimentos, ...mov };
}
export function registrarCaixaDiario(aplicacao) {
    aplicacao.get('/caixa-diario', async (requisicao, resposta) => {
        const a = ator(resposta);
        if (!operador(a.tp_usr) && a.tp_usr !== 'ENTREGADOR')
            throw new Falha(403, 'Acesso restrito');
        const f = z.object({ inicio: z.iso.datetime({ offset: true }), fim: z.iso.datetime({ offset: true }) }).parse(requisicao.query);
        const inicio = new Date(f.inicio), fim = new Date(f.fim);
        if (inicio >= fim || +fim - +inicio > 366 * 86400000)
            throw new Falha(422, 'Período inválido');
        const scope = operador(a.tp_usr) ? {} : { entregador: { id_usr: a.id_usr } };
        const [aberturas, caixas] = await banco.$transaction([banco.ab_aberturas_caixa.findMany({ where: { ...scope, id_cx: null }, include: { entregador: { include: { usuario: { select: { nom_usr: true } } } } }, orderBy: { dt_ab: 'desc' } }), banco.cx_caixa_entregador.findMany({ where: { ...scope, dt_ini: { lt: fim }, dt_fim: { gte: inicio } }, include: { entregador: { include: { usuario: { select: { nom_usr: true } } } } }, orderBy: { dt_fim: 'desc' }, take: 501 })]);
        if (caixas.length > 500)
            throw new Falha(422, 'Reduza o período: mais de 500 fechamentos');
        resposta.json({ aberturas, caixas });
    });
    aplicacao.post('/caixa-diario/abrir', async (requisicao, resposta) => {
        const a = ator(resposta);
        const f = z.object({ id_ent: z.string().uuid(), dt_ab: z.iso.datetime({ offset: true }), vlr_ab: moeda, obs_ab: z.string().max(2000).default('') }).strict().parse(requisicao.body);
        if (new Date(f.dt_ab) > new Date())
            throw new Falha(422, 'Abertura não pode estar no futuro');
        resposta.status(201).json(await transacao(async (tx) => { await exigirDiaAberto(tx, new Date(f.dt_ab)); const ent = await acessoCaixa(tx, a, f.id_ent); if (!ent.st_atv)
            throw new Falha(422, 'Entregador inativo'); if (await tx.ab_aberturas_caixa.findFirst({ where: { id_ent: f.id_ent, id_cx: null } }))
            throw new Falha(409, 'Entregador já tem caixa aberto'); if (await tx.cx_caixa_entregador.findFirst({ where: { id_ent: f.id_ent, dt_fim: { gt: new Date(f.dt_ab) } } }))
            throw new Falha(409, 'Abertura deve ser posterior ao último fechamento'); return tx.ab_aberturas_caixa.create({ data: { ...f, id_usr: a.id_usr } }); }));
    });
    aplicacao.get('/caixa-diario/:id/previa', async (requisicao, resposta) => { const d = await banco.$transaction(tx => previaCaixa(tx, z.string().uuid().parse(requisicao.params.id), ator(resposta), new Date()), { isolationLevel: 'RepeatableRead' }); resposta.json({ ab: d.ab, sistema: d.sistema, resumo: d.resumo, dt_fim: d.dt_fim, troco: d.troco, parcial: d.parcial, total_parcial: d.total_parcial, movimentos: d.movimentos }); });
    aplicacao.post('/caixa-diario/:id/fechar', async (requisicao, resposta) => {
        const a = ator(resposta);
        const id_ab = z.string().uuid().parse(requisicao.params.id);
        const f = z.object({ dt_fim: z.iso.datetime({ offset: true }), informado: valores, parcial: moeda, outros: ajuste, pos_meia_noite: ajuste, observacoes: z.string().max(4000) }).strict().parse(requisicao.body);
        resposta.json(await transacao(async (tx) => {
            const ab = await tx.ab_aberturas_caixa.findUniqueOrThrow({ where: { id_ab } });
            await acessoCaixa(tx, a, ab.id_ent);
            if (ab.id_cx)
                return tx.cx_caixa_entregador.findUniqueOrThrow({ where: { id_cx: ab.id_cx } });
            if (!(await disponibilidade(tx, ab.id_ent)).disponivel)
                throw new Falha(409, 'Entregador indisponível para fechamento');
            await exigirDiaAberto(tx, new Date(Date.parse(f.dt_fim) - 1));
            if (await tx.mov_movimentos_caixa.findFirst({ where: { id_ab, dt_mov: { gte: new Date(f.dt_fim) } } }))
                throw new Falha(409, 'Novos lançamentos: atualize a conferência');
            const d = await previaCaixa(tx, id_ab, a, new Date(f.dt_fim));
            if (!new Prisma.Decimal(f.parcial).equals(d.total_parcial))
                throw new Falha(409, 'Parciais alterados: atualize a conferência');
            const aberturaEfetiva = d.ab.vlr_ab.plus(d.troco).toFixed(2);
            const totais = conferirCaixa(d.sistema, f.informado, aberturaEfetiva, f.parcial, f.outros, f.pos_meia_noite);
            if ((new Prisma.Decimal(totais.diferenca).isZero() === false || !new Prisma.Decimal(f.outros).isZero() || !new Prisma.Decimal(f.pos_meia_noite).isZero() || !new Prisma.Decimal(f.parcial).isZero()) && !f.observacoes.trim())
                throw new Falha(422, 'Informe observações para diferenças ou ajustes');
            const cx = await tx.cx_caixa_entregador.create({ data: { id_ent: d.ab.id_ent, dt_ref: d.ab.dt_ab, dt_ini: d.ab.dt_ab, dt_fim: new Date(f.dt_fim), ...d.resumo, vlr_fundo_cx: d.ab.vlr_ab, vlr_troco_cx: d.troco, vlr_parcial_din: d.parcial.dinheiro, st_cx: 'AGUARDANDO_VALIDACAO', conferencia: { ...f, sistema: d.sistema, abertura: aberturaEfetiva, fundo_inicial: d.ab.vlr_ab.toFixed(2), troco: d.troco, parciais: d.parcial, ...totais, id_usr: a.id_usr, dt_reg: new Date().toISOString() } } });
            await tx.ped_pedidos.updateMany({ where: { id_ped: { in: d.pedidos.map(p => p.id_ped) }, id_cx: null }, data: { id_cx: cx.id_cx } });
            await tx.ab_aberturas_caixa.update({ where: { id_ab }, data: { id_cx: cx.id_cx } });
            return cx;
        }));
    });
}
