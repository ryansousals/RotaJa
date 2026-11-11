import 'dotenv/config';
import assert from 'node:assert/strict';
import { banco } from '../servidor/servicos.js';
import { encerrarGeral } from '../servidor/caixa-registro.js';
import { exigirDiaAberto } from '../servidor/movimentos-caixa.js';
const rollback = new Error('ROLLBACK_TESTE');
try {
    await banco.$transaction(async (tx) => {
        const admin = await tx.usr_usuarios.findFirstOrThrow({ where: { tp_usr: 'ADMINISTRADOR' } }), ator = { id_usr: admin.id_usr, tp_usr: admin.tp_usr };
        // Data anterior aos registros reais, dentro de transação sempre desfeita.
        const primeira = await tx.ab_aberturas_caixa.findFirst({ orderBy: { dt_ab: 'asc' } });
        const dia = new Date(+(primeira?.dt_ab ?? new Date()) - 7 * 86400000).toISOString().slice(0, 10);
        const d = { dia, observacoes: 'Teste transacional desfeito' };
        await assert.rejects(() => encerrarGeral(tx, { ...ator, tp_usr: 'ENTREGADOR' }, d), { codigo: 403 });
        const r = await encerrarGeral(tx, ator, d);
        assert.equal(r.resumo.qtd_entregas, 0);
        assert.equal((await encerrarGeral(tx, ator, { ...d, observacoes: 'Repetição não altera o arquivo' })).id_ger, r.id_ger);
        await assert.rejects(() => exigirDiaAberto(tx, new Date(dia + 'T12:00:00-03:00')), { codigo: 409 });
        assert.equal((await tx.ger_fechamentos_caixa.findUniqueOrThrow({ where: { id_ger: r.id_ger } })).obs_ger, d.observacoes);
        throw rollback;
    }, { isolationLevel: 'Serializable' });
}
catch (e) {
    if (e !== rollback)
        throw e;
    console.log('OK: fechamento geral, arquivo imutável, idempotência e bloqueio de dia encerrado. Teste revertido integralmente.');
}
finally {
    await banco.$disconnect();
}
