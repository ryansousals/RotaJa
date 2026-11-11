import { test, expect } from '@playwright/test';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
config({ path: resolve(process.cwd(), '../.env') });
// Espaça os cenários para respeitar os limites de acesso da API local.
test.beforeEach(async()=>{await new Promise(concluir=>setTimeout(concluir,15000));});
test('excluir bairro preserva pedidos e remove a oferta para todas as lojas', async ({ page, playwright }) => {
    const sufixo = randomBytes(5).toString('hex'), nome = 'Bairro exclusão ' + sufixo, senha = randomBytes(20).toString('hex');
    await page.goto('/');
    await page.getByLabel('E-mail', { exact: true }).fill(process.env.ADMIN_EMAIL);
    await page.getByLabel('Senha', { exact: true }).fill(process.env.ADMIN_SENHA);
    await page.getByRole('button', { name: 'Entrar na plataforma' }).click();
    await page.getByRole('link', { name: 'Bairros e tarifas', exact: true }).click();
    const b = await page.request.post('/api/bairros', { data: { nom_bai: nome, cid_bai: 'Floriano', uf_bai: 'PI', vlr_tx_ent: '7', vlr_ganho_ent: '7', vlr_tx_ret: '0', vlr_ganho_ret: '0' } });
    expect(b.status()).toBe(201);
    const bairro = await b.json();
    const email = `bairro.${sufixo}@teste.local`;
    const e = await page.request.post('/api/cadastros/empresa', { data: { nom_usr: 'Teste bairro ' + sufixo, eml_usr: email, senha, tp_pes: 'JURIDICA', raz_soc: 'Teste exclusão de bairro', nom_fan: 'Teste bairro ' + sufixo, doc_emp: Array.from(randomBytes(14), n => n % 10).join(''), log_emp: 'Rua teste', num_emp: '1', bai_emp: 'Centro', cid_emp: 'Floriano', uf_emp: 'PI', tel_emp: '5589999990000' } });
    expect(e.status()).toBe(201);
    const empresa = await e.json();
    const cliente = await playwright.request.newContext({ baseURL: 'http://localhost:3002' });
    try {
        expect((await cliente.post('/api/autenticacao/entrar', { data: { eml_usr: email, senha } })).status()).toBe(200);
        const chamada = { id_bai: bairro.id_bai, chave_idem: randomUUID(), nom_dest: 'Teste bairro', tel_dest: '5589999990001', log_dest: 'Rua destino', num_dest: '2', tp_end: 'ENTREGA', st_ret: false, st_pag: 'PAGO' };
        const p = await cliente.post('/api/pedidos', { data: chamada });
        expect(p.status()).toBe(201);
        const pedido = await p.json();
        expect((await cliente.delete('/api/bairros/' + bairro.id_bai)).status()).toBe(403);
        await page.reload();
        await page.getByLabel('Buscar bairro').fill(nome);
        await page.getByRole('button', { name: 'Excluir bairro ' + nome, exact: true }).click();
        await expect(page.getByRole('dialog')).toContainText('Pedidos existentes e seus valores serão preservados');
        await page.getByRole('button', { name: 'Fechar', exact: true }).click();
        await expect(page.getByRole('cell', { name: nome, exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Excluir bairro ' + nome, exact: true }).click();
        await page.getByRole('button', { name: 'Confirmar exclusão', exact: true }).click();
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await expect(page.getByRole('cell', { name: nome, exact: true })).toHaveCount(0);
        expect((await (await cliente.get('/api/bairros')).json()).some((v) => v.id_bai === bairro.id_bai)).toBe(false);
        expect((await (await page.request.get(`/api/empresas/${empresa.id_emp}/tarifas`)).json()).some((v) => v.id_bai === bairro.id_bai)).toBe(false);
        expect((await cliente.post('/api/pedidos', { data: { ...chamada, chave_idem: randomUUID() } })).status()).toBe(422);
        expect((await page.request.patch('/api/bairros/' + bairro.id_bai, { data: { st_atv: true } })).status()).toBe(404);
        const preservado = await (await cliente.get('/api/pedidos/' + pedido.id_ped)).json();
        expect(preservado.bairro.nom_bai).toBe(nome);
        expect(preservado.vlr_tx).toBe('7');
        expect((await page.request.delete('/api/bairros/' + bairro.id_bai)).status()).toBe(204);
        await page.request.post('/api/pedidos/status', { data: { id_ped: pedido.id_ped, versao: pedido.versao, st_ped: 'CANCELADO' } });
    }
    finally {
        await cliente.dispose();
    }
});
