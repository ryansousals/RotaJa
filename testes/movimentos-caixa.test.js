import test from 'node:test';
import assert from 'node:assert/strict';
import { acumularMovimentos, periodoDia } from '../servidor/movimentos-caixa.js';
test('troco e parciais mantêm dinheiro e pagamentos digitais separados', () => {
    const v = (dinheiro, pix = '0') => ({ dinheiro, pix, cartao: '0', online: '0' });
    const r = acumularMovimentos([{ tp_mov: 'TROCO_ENTRADA', valores: v('50') }, { tp_mov: 'TROCO_SAIDA', valores: v('10') }, { tp_mov: 'PARCIAL', valores: v('20', '30') }, { tp_mov: 'PARCIAL', valores: v('5.25') }]);
    assert.equal(r.troco, '40.00');
    assert.equal(r.total_parcial, '55.25');
    assert.equal(r.parcial.dinheiro, '25.25');
    assert.equal(r.parcial.pix, '30.00');
});
test('data do caixa usa Fortaleza e rejeita datas inexistentes', () => { const p = periodoDia('2026-11-03'); assert.equal(p.inicio.toISOString(), '2026-11-03T03:00:00.000Z'); assert.equal(p.fim.toISOString(), '2026-11-04T03:00:00.000Z'); assert.throws(() => periodoDia('2026-02-30')); });
