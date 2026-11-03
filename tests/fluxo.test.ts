import {test} from 'node:test';
import assert from 'node:assert/strict';
import {proximos} from '../src/dominio.js';
test('fluxo exige aceite e recolhimento antes de finalizar',()=>{assert.deepEqual(proximos.PRONTO,['ATRIBUIDO','CANCELADO']);assert.deepEqual(proximos.ATRIBUIDO,['ACEITO','CANCELADO']);assert.deepEqual(proximos.ACEITO,['EM_ENTREGA','CANCELADO']);assert.deepEqual(proximos.EM_ENTREGA,['CONCLUIDO']);});
test('corridas antigas podem continuar sem repetir etapas',()=>{assert.ok(proximos.EM_COLETA.includes('EM_ENTREGA'));assert.ok(proximos.NO_LOCAL.includes('EM_ENTREGA'));assert.deepEqual(proximos.EM_RETORNO,['CONCLUIDO']);});
