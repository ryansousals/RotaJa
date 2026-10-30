import { Prisma } from '@prisma/client';
export const formas = ['dinheiro','cartao','pix','online'] as const;
export type Valores = Record<typeof formas[number], string>;
const d=(v:Prisma.Decimal.Value=0)=>new Prisma.Decimal(v);
export function conferirCaixa(sistema:Valores, informado:Valores, abertura:string, parcial:string, outros:string, pos_meia_noite:string) {
 const totalSistema=formas.reduce((s,k)=>s.plus(sistema[k]),d());
 const totalInformado=formas.reduce((s,k)=>s.plus(informado[k]),d());
 // Ajustes aumentam/diminuem o esperado; parcial é retirada de dinheiro já conferida.
 const esperado=totalSistema.plus(abertura).plus(outros).plus(pos_meia_noite).minus(parcial);
 return {total_sistema:totalSistema.toFixed(2),total_informado:totalInformado.toFixed(2),total_esperado:esperado.toFixed(2),diferenca:totalInformado.minus(esperado).toFixed(2)};
}
