import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { calcularCaixa, proximos } from '../src/dominio.js';
const valor = (n: string) => new Prisma.Decimal(n);
test('dez corridas: mil reais recebidos menos setenta de ganhos', () => {
  const c = calcularCaixa(Array.from({ length: 10 }, () => ({ vlr_ganho_ent: valor('7'), vlr_rec_din: valor('100') })));
  assert.equal(c.vlr_saldo_rep_adm.toFixed(2), '930.00'); assert.equal(c.qtd_peds, 10);
});
test('saldo negativo representa crédito do entregador e não vira zero', () => {
  assert.equal(calcularCaixa([{ vlr_ganho_ent: valor('7.10'), vlr_rec_din: valor('0') }]).vlr_saldo_rep_adm.toFixed(2), '-7.10');
});
test('centavos são exatos e caixa vazio não gera valores indevidos', () => {
  const c = calcularCaixa([{ vlr_ganho_ent: valor('0.10'), vlr_rec_din: valor('0.30') }]);
  assert.equal(c.vlr_saldo_rep_adm.toFixed(2), '0.20'); assert.equal(calcularCaixa([]).qtd_peds, 0);
});
test('pedido concluído não pode ser cancelado ou reaberto', () => { assert.deepEqual(proximos.CONCLUIDO, []); });
