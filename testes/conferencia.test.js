import test from 'node:test';
import assert from 'node:assert/strict';
import { conferirCaixa } from '../servidor/conferencia.js';
const zero = { dinheiro: '0', cartao: '0', pix: '0', online: '0' };
test('conferência considera abertura, retirada parcial e ajustes sem descontar ganho', () => {
    const r = conferirCaixa({ ...zero, dinheiro: '100', pix: '50' }, { ...zero, dinheiro: '130', pix: '50' }, '50', '20', '0', '0');
    assert.equal(r.total_sistema, '150.00');
    assert.equal(r.total_esperado, '180.00');
    assert.equal(r.diferenca, '0.00');
});
test('diferença negativa e precisão de centavos são preservadas', () => {
    const r = conferirCaixa({ ...zero, dinheiro: '115.80' }, zero, '0', '0', '0.10', '0.20');
    assert.equal(r.diferenca, '-116.10');
});
