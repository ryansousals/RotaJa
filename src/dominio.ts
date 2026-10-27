import { Prisma, st_pedido } from '@prisma/client';
export class Falha extends Error {
  constructor(public codigo: number, mensagem: string) { super(mensagem); }
}
export const operador = (tipo: string) => ['ADMINISTRADOR', 'OPERADOR'].includes(tipo);
export const proximos: Record<st_pedido, st_pedido[]> = {
  PREPARANDO: ['ATRIBUIDO', 'CANCELADO'], ATRIBUIDO: ['ACEITO', 'CANCELADO'],
  ACEITO: ['EM_COLETA', 'CANCELADO'], EM_COLETA: ['NO_LOCAL', 'CANCELADO'],
  NO_LOCAL: ['EM_ENTREGA', 'CANCELADO'], EM_ENTREGA: ['EM_RETORNO', 'CONCLUIDO'],
  EM_RETORNO: ['CONCLUIDO'], CONCLUIDO: [], CANCELADO: [],
};
export function calcularCaixa(pedidos: { vlr_ganho_ent: Prisma.Decimal; vlr_rec_din: Prisma.Decimal }[]) {
  const ganho = pedidos.reduce((a, p) => a.plus(p.vlr_ganho_ent), new Prisma.Decimal(0));
  const dinheiro = pedidos.reduce((a, p) => a.plus(p.vlr_rec_din), new Prisma.Decimal(0));
  return { qtd_peds: pedidos.length, vlr_tot_ganho: ganho, vlr_tot_rec_din: dinheiro, vlr_saldo_rep_adm: dinheiro.minus(ganho) };
}
