import { Prisma } from '@prisma/client';
import { Falha } from './dominio.js';
export const vazio = () => ({ dinheiro: '0.00', cartao: '0.00', pix: '0.00', online: '0.00' });
export function somarValores(a, b, sinal = 1) { for (const k of Object.keys(a))
    a[k] = new Prisma.Decimal(a[k]).plus(new Prisma.Decimal(b[k]).mul(sinal)).toFixed(2); return a; }
export const totalValores = (v) => Object.values(v).reduce((s, x) => s.plus(x), new Prisma.Decimal(0));
export function acumularMovimentos(ms) { const parcial = vazio(); let troco = new Prisma.Decimal(0); for (const m of ms) {
    const v = m.valores;
    if (m.tp_mov === 'PARCIAL')
        somarValores(parcial, v);
    else
        troco = troco.plus(new Prisma.Decimal(v.dinheiro).mul(m.tp_mov === 'TROCO_ENTRADA' ? 1 : -1));
} return { parcial, troco: troco.toFixed(2), total_parcial: totalValores(parcial).toFixed(2) }; }
export function periodoDia(dia) { const inicio = new Date(dia + 'T00:00:00-03:00'); if (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || !Number.isFinite(+inicio) || inicio.toISOString().slice(0, 10) !== dia)
    throw new Falha(422, 'Data inválida'); return { inicio, fim: new Date(+inicio + 86400000) }; }
export async function disponibilidade(tx, id_ent) { const ent = await tx.ent_entregadores.findUniqueOrThrow({ where: { id_ent }, include: { usuario: { select: { st_atv: true } } } }); if (!ent.st_atv || !ent.usuario.st_atv)
    return { disponivel: false, motivo: 'Entregador ou acesso inativo' }; const rotas = await tx.ped_pedidos.count({ where: { id_ent, st_ped: { in: ['ATRIBUIDO', 'ACEITO', 'EM_COLETA', 'NO_LOCAL', 'EM_ENTREGA', 'EM_RETORNO'] } } }); return { disponivel: rotas === 0, motivo: rotas ? 'Entregador com corrida em andamento' : 'Pronto para acerto' }; }
export async function exigirDiaAberto(tx, instante) { const dia = new Date(+instante - 3 * 3600000).toISOString().slice(0, 10); if (await tx.ger_fechamentos_caixa.findUnique({ where: { dt_ref: new Date(dia) } }))
    throw new Falha(409, 'Fechamento geral deste dia já encerrado'); }
