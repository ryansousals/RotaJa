import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { banco, transacao } from './servicos.js';
import { operador, Falha } from './dominio.js';
import { previaCaixa } from './caixa-diario.js';
import { acumularMovimentos, disponibilidade, periodoDia, exigirDiaAberto, vazio, somarValores, totalValores } from './movimentos-caixa.js';
const moeda = z.string().regex(/^\d{1,9}(\.\d{1,2})?$/);
const recebimentos = z.object({ dinheiro: moeda, cartao: moeda, pix: moeda, online: moeda }).strict();
const incluir = { entregador: { include: { usuario: { select: { nom_usr: true } } } } };
async function consolidar(tx, dia, id_ent) {
    const { inicio, fim } = periodoDia(dia);
    const pedidos = await tx.ped_pedidos.findMany({ where: { id_ent, st_ped: 'CONCLUIDO', dt_conc: { gte: inicio, lt: fim } } });
    const aberturas = await tx.ab_aberturas_caixa.findMany({ where: { id_ent, dt_ab: { gte: inicio, lt: fim } } });
    const movimentos = await tx.mov_movimentos_caixa.findMany({ where: { abertura: { id_ent }, dt_mov: { gte: inicio, lt: fim } } });
    const caixas = await tx.cx_caixa_entregador.findMany({ where: { id_ent, dt_fim: { gt: inicio, lte: fim } } });
    const sistema = vazio();
    for (const p of pedidos) {
        const k = p.tp_rec === 'DINHEIRO' ? 'dinheiro' : p.tp_rec === 'PIX_LOJA' ? 'pix' : p.tp_rec === 'CARTAO_LOJA' ? 'cartao' : p.tp_rec === 'ONLINE_LOJA' ? 'online' : null;
        if (k)
            sistema[k] = new Prisma.Decimal(sistema[k]).plus(p.vlr_rec_din).plus(p.vlr_rec_loja).toFixed(2);
    }
    const mov = acumularMovimentos(movimentos), fundo = aberturas.reduce((s, a) => s.plus(a.vlr_ab), new Prisma.Decimal(0));
    const pendentes = await tx.ab_aberturas_caixa.count({ where: { id_ent, dt_ab: { lt: fim }, OR: [{ id_cx: null }, { caixa: { dt_fim: { gt: fim } } }] } });
    return { dia, recebimentos: sistema, total_recebido: totalValores(sistema).toFixed(2), fundo_inicial: fundo.toFixed(2), ...mov, dinheiro_a_conferir: new Prisma.Decimal(sistema.dinheiro).plus(fundo).plus(mov.troco).minus(mov.parcial.dinheiro).toFixed(2), ganhos: pedidos.reduce((s, p) => s.plus(p.vlr_ganho_ent), new Prisma.Decimal(0)).toFixed(2), qtd_entregas: pedidos.length, caixas_pendentes: caixas.filter(c => c.st_cx !== 'QUITADO').length, caixas_quitados: caixas.filter(c => c.st_cx === 'QUITADO').length, aberturas_pendentes: pendentes, ids_caixas: caixas.map(c => c.id_cx), ids_movimentos: movimentos.map(m => m.id_mov) };
}
export function registrarCaixaRegistro(aplicacao) {
    aplicacao.get('/caixa-registro', async (requisicao, resposta) => {
        const a = resposta.locals.ator;
        if (!operador(a.tp_usr) && a.tp_usr !== 'ENTREGADOR')
            throw new Falha(403, 'Acesso restrito');
        const q = z.object({ dia: z.string(), id_ent: z.string().uuid().optional(), busca: z.string().max(150).default('') }).parse(requisicao.query), { inicio, fim } = periodoDia(q.dia);
        const scope = { id_ent: q.id_ent, entregador: { ...(operador(a.tp_usr) ? {} : { id_usr: a.id_usr }), usuario: { nom_usr: { contains: q.busca, mode: 'insensitive' } } } };
        resposta.json(await banco.$transaction(async (tx) => {
            const abs = await tx.ab_aberturas_caixa.findMany({ where: { AND: [scope, { dt_ab: { lt: fim }, OR: [{ id_cx: null }, { caixa: { dt_fim: { gt: inicio } } }] }] }, include: { ...incluir, caixa: true }, orderBy: { dt_ab: 'asc' } });
            const pendentes = [];
            for (const ab of abs.filter(x => !x.id_cx)) {
                const ps = await tx.ped_pedidos.findMany({ where: { id_ent: ab.id_ent, st_ped: 'CONCLUIDO', dt_conc: { gte: ab.dt_ab, lt: fim }, id_cx: null } });
                const mov = await tx.mov_movimentos_caixa.findMany({ where: { id_ab: ab.id_ab, dt_mov: { lt: fim } }, orderBy: { dt_mov: 'asc' } }), s = vazio();
                for (const p of ps.filter(p => p.dt_conc >= inicio)) {
                    const k = p.tp_rec === 'DINHEIRO' ? 'dinheiro' : p.tp_rec === 'PIX_LOJA' ? 'pix' : p.tp_rec === 'CARTAO_LOJA' ? 'cartao' : p.tp_rec === 'ONLINE_LOJA' ? 'online' : null;
                    if (k)
                        s[k] = new Prisma.Decimal(s[k]).plus(p.vlr_rec_din).plus(p.vlr_rec_loja).toFixed(2);
                }
                pendentes.push({ ...ab, total_turno: ps.reduce((v, p) => v.plus(p.vlr_rec_din).plus(p.vlr_rec_loja), new Prisma.Decimal(0)).toFixed(2), sistema: s, total_sistema: totalValores(s).toFixed(2), ...acumularMovimentos(mov), ...await disponibilidade(tx, ab.id_ent) });
            }
            const caixas = await tx.cx_caixa_entregador.findMany({ where: { id_ent: q.id_ent, entregador: scope.entregador, dt_fim: { gt: inicio, lte: fim } }, include: incluir, orderBy: { dt_fim: 'desc' } });
            const movimentos = await tx.mov_movimentos_caixa.findMany({ where: { abertura: scope, dt_mov: { gte: inicio, lt: fim } }, include: { abertura: { include: incluir }, autor: { select: { nom_usr: true } } }, orderBy: { dt_mov: 'desc' } });
            const geral = operador(a.tp_usr) ? await consolidar(tx, q.dia, q.id_ent) : null;
            const encerrados = operador(a.tp_usr) ? await tx.ger_fechamentos_caixa.findMany({ where: { dt_ref: new Date(q.dia) }, include: { autor: { select: { nom_usr: true } } } }) : [];
            return { aberturas: abs, pendentes, caixas, movimentos, geral, encerrados };
        }, { isolationLevel: 'RepeatableRead', timeout: 15000 }));
    });
    aplicacao.post('/caixa-registro/movimentos', async (requisicao, resposta) => {
        const a = resposta.locals.ator;
        if (!operador(a.tp_usr))
            throw new Falha(403, 'Somente a operação registra troco e acertos parciais');
        const f = z.object({ id_ab: z.string().uuid(), chave_idem: z.string().uuid(), tp_mov: z.enum(['TROCO_ENTRADA', 'TROCO_SAIDA', 'PARCIAL']), valores: recebimentos, obs_mov: z.string().trim().min(3).max(2000) }).strict().parse(requisicao.body);
        if (!totalValores(f.valores).gt(0))
            throw new Falha(422, 'Informe um valor maior que zero');
        if (f.tp_mov !== 'PARCIAL' && ['cartao', 'pix', 'online'].some(k => new Prisma.Decimal(f.valores[k]).gt(0)))
            throw new Falha(422, 'Troco deve ser registrado somente em dinheiro');
        resposta.status(201).json(await transacao(async (tx) => {
            const anterior = await tx.mov_movimentos_caixa.findUnique({ where: { chave_idem: f.chave_idem } });
            if (anterior) {
                if (anterior.id_usr !== a.id_usr || anterior.id_ab !== f.id_ab || anterior.tp_mov !== f.tp_mov || anterior.obs_mov !== f.obs_mov || Object.keys(f.valores).some(k => !new Prisma.Decimal(anterior.valores[k]).equals(f.valores[k])))
                    throw new Falha(409, 'Chave utilizada por outro lançamento');
                return anterior;
            }
            const d = await previaCaixa(tx, f.id_ab, a, new Date());
            await exigirDiaAberto(tx, new Date());
            const disponivel = { ...d.sistema, dinheiro: new Prisma.Decimal(d.sistema.dinheiro).plus(d.ab.vlr_ab).plus(d.troco).toFixed(2) };
            somarValores(disponivel, d.parcial, -1);
            if (f.tp_mov !== 'TROCO_ENTRADA' && Object.keys(f.valores).some(k => new Prisma.Decimal(f.valores[k]).gt(disponivel[k])))
                throw new Falha(422, 'Valor maior que o saldo ainda disponível para conferência');
            return tx.mov_movimentos_caixa.create({ data: { ...f, id_usr: a.id_usr } });
        }));
    });
    aplicacao.post('/caixa-registro/geral/fechar', async (requisicao, resposta) => {
        const a = resposta.locals.ator;
        if (!operador(a.tp_usr))
            throw new Falha(403, 'Somente a operação encerra o caixa geral');
        const f = z.object({ dia: z.string(), observacoes: z.string().trim().min(3).max(2000) }).strict().parse(requisicao.body);
        const { fim } = periodoDia(f.dia);
        if (fim > new Date())
            throw new Falha(422, 'Aguarde o término do dia para encerrar o fechamento geral');
        resposta.json(await transacao(tx => encerrarGeral(tx, a, f)));
    });
}
export async function encerrarGeral(tx, a, f) {
    if (!operador(a.tp_usr))
        throw new Falha(403, 'Somente a operação encerra o caixa geral');
    if (periodoDia(f.dia).fim > new Date())
        throw new Falha(422, 'Aguarde o término do dia');
    const existente = await tx.ger_fechamentos_caixa.findUnique({ where: { dt_ref: new Date(f.dia) } });
    if (existente)
        return existente;
    const resumo = await consolidar(tx, f.dia);
    if (resumo.aberturas_pendentes || resumo.caixas_pendentes)
        throw new Falha(409, 'Conclua e quite os caixas pendentes antes de encerrar o dia');
    return tx.ger_fechamentos_caixa.create({ data: { dt_ref: new Date(f.dia), id_usr: a.id_usr, resumo, obs_ger: f.observacoes } });
}
