import { Prisma } from '@prisma/client';
export const formas = ['dinheiro', 'cartao', 'pix', 'online'];
const d = (v = 0) => new Prisma.Decimal(v);
export function conferirCaixa(sistema, informado, abertura, parcial, outros, pos_meia_noite) {
    const totalSistema = formas.reduce((s, k) => s.plus(sistema[k]), d());
    const totalInformado = formas.reduce((s, k) => s.plus(informado[k]), d());
    // Ajustes aumentam/diminuem o esperado; parcial é retirada de dinheiro já conferida.
    const esperado = totalSistema.plus(abertura).plus(outros).plus(pos_meia_noite).minus(parcial);
    return { total_sistema: totalSistema.toFixed(2), total_informado: totalInformado.toFixed(2), total_esperado: esperado.toFixed(2), diferenca: totalInformado.minus(esperado).toFixed(2) };
}
