import { Prisma } from '@prisma/client';
export class Falha extends Error {
    codigo;
    constructor(codigo, mensagem) {
        super(mensagem);
        this.codigo = codigo;
    }
}
export const operador = (tipo) => ['ADMINISTRADOR', 'OPERADOR'].includes(tipo);
export const proximos = {
    PRONTO: ['ATRIBUIDO', 'CANCELADO'], ATRIBUIDO: ['ACEITO', 'CANCELADO'],
    ACEITO: ['EM_ENTREGA', 'CANCELADO'], EM_COLETA: ['EM_ENTREGA', 'CANCELADO'],
    NO_LOCAL: ['EM_ENTREGA', 'CANCELADO'], EM_ENTREGA: ['CONCLUIDO'],
    EM_RETORNO: ['CONCLUIDO'], CONCLUIDO: [], CANCELADO: [],
};
export function calcularCaixa(pedidos) {
    const ganho = pedidos.reduce((a, p) => a.plus(p.vlr_ganho_ent), new Prisma.Decimal(0));
    const dinheiro = pedidos.reduce((a, p) => a.plus(p.vlr_rec_din), new Prisma.Decimal(0));
    return { qtd_peds: pedidos.length, vlr_tot_ganho: ganho, vlr_tot_rec_din: dinheiro, vlr_saldo_rep_adm: dinheiro.minus(ganho) };
}
