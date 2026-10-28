import { test, expect, type Page } from '@playwright/test';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
config({ path: resolve(process.cwd(), '../.env') });
test.describe.configure({ mode: 'serial' });
const sufixo = randomBytes(4).toString('hex');
const senha = randomBytes(20).toString('hex');
const lojaEmail = `web.loja.${sufixo}@teste.local`, entEmail = `web.ent.${sufixo}@teste.local`;
const documento = (n: number) => Array.from(randomBytes(n), b => b % 10).join('');
async function login(page: Page, email: string, password: string) {
  await page.goto('/'); await page.getByLabel('E-mail', { exact: true }).fill(email); await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar na plataforma' }).click(); await expect(page.getByRole('button', { name: 'Sair da conta' })).toBeVisible();
}
test('operação, cliente e entregador completam um pedido real pelo frontend', async ({ page, browser }) => {
  await login(page, process.env.ADMIN_EMAIL!, process.env.ADMIN_SENHA!);
  await page.getByRole('link', { name: 'Empresas parceiras', exact: true }).click();
  await page.getByRole('button', { name: 'Cadastrar empresa' }).click();
  await page.getByLabel('Nome do responsável').fill('Loja Web '+sufixo);
  await page.getByLabel('E-mail de acesso').fill(lojaEmail); await page.getByLabel('Senha inicial').fill(senha);
  await page.getByLabel('Nome fantasia').fill('Loja Web '+sufixo); await page.getByLabel('Razão social').fill('Empresa Web '+sufixo);
  await page.getByLabel('CPF ou CNPJ').fill(documento(14)); await page.getByLabel('Telefone com DDD').fill('5589999999000');
  await page.getByLabel('Rua / Logradouro').fill('Rua de teste web'); await page.getByLabel(/^Número/).fill('15');
  await page.getByLabel('Bairro da loja').fill('Centro'); await page.getByLabel('Cidade', { exact: false }).fill('Floriano'); await page.getByLabel('UF', { exact: false }).fill('PI');
  await page.getByRole('button', { name: 'Salvar cadastro' }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('cell', { name: 'Loja Web '+sufixo, exact: false })).toBeVisible();
  await page.getByRole('link', { name: 'Entregadores', exact: true }).click(); await page.getByRole('button', { name: 'Cadastrar entregador' }).click();
  await page.getByLabel('Nome do responsável').fill('Moto Web '+sufixo); await page.getByLabel('E-mail de acesso').fill(entEmail); await page.getByLabel('Senha inicial').fill(senha);
  await page.getByLabel('CPF (somente números)').fill(documento(11)); await page.getByLabel('Placa da moto').fill('WEB1A23'); await page.getByLabel('Telefone com DDD').fill('5589999999001');
  await page.getByRole('button', { name: 'Salvar cadastro' }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('link', { name: 'Bairros e tarifas', exact: true }).click(); await page.getByRole('button', { name: 'Cadastrar bairro' }).click();
  await page.getByLabel('Nome do bairro').fill('Bairro Web '+sufixo); await page.getByLabel('Cidade').fill('Floriano'); await page.getByLabel('UF').fill('PI');
  await page.getByRole('button', { name: 'Salvar cadastro' }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
  const clienteContexto = await browser.newContext(); const cliente = await clienteContexto.newPage();
  const motoContexto = await browser.newContext({ viewport: { width: 390, height: 844 } }); const moto = await motoContexto.newPage();
  try {
    await login(cliente, lojaEmail, senha); await cliente.reload(); await expect(cliente.getByRole('heading', { name: 'Minhas chamadas' })).toBeVisible();
    await expect(cliente.getByRole('link', { name: 'Empresas parceiras' })).toHaveCount(0);
    const acesso = await cliente.request.get('/api/usuarios'); expect(acesso.status()).toBe(403);
    await cliente.getByRole('button', { name: 'Nova chamada' }).click();
    await cliente.getByLabel('Nome completo do destinatário').fill('Destinatário Web '+sufixo); await cliente.getByLabel('Telefone com DDD').fill('5589999999002');
    await cliente.getByLabel('Bairro permitido').selectOption({ label: 'Bairro Web '+sufixo }); await cliente.getByLabel('Rua / Logradouro').fill('Rua do destino'); await cliente.getByLabel(/^Número/).fill('25');
    await cliente.getByLabel('Pagamento').selectOption('A_RECEBER'); await cliente.getByLabel('Valor dos produtos').fill('93');
    await cliente.getByRole('button', { name: 'Abrir chamada', exact: true }).click(); await expect(cliente.getByRole('dialog')).toHaveCount(0);
    await expect(cliente.getByText('Destinatário Web '+sufixo,{exact:true})).toBeVisible();
    await page.getByRole('link', { name: 'Visão operacional' }).click(); await page.getByLabel('Buscar pedidos').fill('Destinatário Web '+sufixo);
    await expect(page.getByText('Destinatário Web '+sufixo,{exact:true})).toBeVisible();
    await page.getByRole('combobox', { name: /Entregador do pedido/ }).selectOption({ label: 'Moto Web '+sufixo });
    await expect(page.getByText('Aguardando aceite')).toBeVisible();
    await page.screenshot({ path: 'test-results/painel-desktop.png', fullPage: true });
    await page.getByRole('link', { name: 'Central de ajuda' }).click();
    await login(moto, entEmail, senha); await moto.getByRole('button', { name: /Pedido #/ }).click();
    for (const etapa of ['Aceitar corrida','Iniciar coleta','Cheguei no local','Iniciar entrega','Concluir entrega']) {
      await moto.getByRole('button', { name: etapa, exact: true }).click();
      if (etapa === 'Concluir entrega') await moto.getByLabel('Como foi recebido?').selectOption('DINHEIRO');
      await moto.getByRole('button', { name: 'Confirmar etapa' }).click();
      await expect(moto.getByRole('dialog')).toHaveCount(1);
    }
    await expect(moto.getByRole('dialog').getByText('Concluído', { exact: true })).toBeVisible();
    await moto.screenshot({ path: 'test-results/entregador-mobile.png', fullPage: true });
    await moto.getByRole('button', { name: 'Fechar', exact: true }).click();
    await moto.getByRole('button', { name: 'Abrir menu' }).click(); await moto.getByRole('link', { name: 'Financeiro', exact: true }).click();
    await expect(moto.getByText('R$ 93,00', { exact: true })).toBeVisible();
    await cliente.getByRole('button', { name: 'Concluídas', exact: true }).click(); await expect(cliente.getByText('Destinatário Web '+sufixo,{exact:true})).toBeVisible();
    await cliente.getByRole('button', { name: 'Sair da conta' }).click(); await cliente.reload(); await expect(cliente.getByRole('heading', { name: 'Acesse sua conta' })).toBeVisible();
  } finally { await clienteContexto.close(); await motoContexto.close(); }
});
test('layout de login se adapta a uma tela de celular', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Acesse sua conta' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/login-mobile.png', fullPage: true });
});

test('caixa e repasse são gerados e conferidos pelas telas financeiras', async ({ page, browser }) => {
  // Usa a corrida criada no fluxo anterior: os testes deste arquivo são sequenciais.
  await login(page, entEmail, senha);
  await page.getByRole('link', { name: 'Financeiro', exact: true }).click();
  await page.getByRole('button', { name: 'Fechar caixa', exact: true }).click();
  const fim = new Date(Date.now() - new Date().getTimezoneOffset()*60000).toISOString().slice(0,19);
  await page.getByLabel('Fim exclusivo').fill(fim);
  await page.getByRole('button', { name: 'Gerar fechamento' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('cell', { name: 'Aguardando validação', exact: true })).toBeVisible();
  const adminContexto = await browser.newContext(); const admin = await adminContexto.newPage();
  try {
    await login(admin,process.env.ADMIN_EMAIL!,process.env.ADMIN_SENHA!);
    await admin.getByRole('link', { name: 'Financeiro', exact: true }).click();
    const linhaCaixa = admin.getByRole('row').filter({ hasText: 'Moto Web '+sufixo });
    await linhaCaixa.getByRole('button', { name: 'Conferir' }).click();
    await admin.getByLabel('Referência do comprovante').fill('conferencia-web-'+sufixo);
    await admin.getByRole('button', { name: 'Confirmar quitação' }).click();
    await expect(admin.getByRole('dialog')).toHaveCount(0);
    await expect(linhaCaixa.getByText('Quitado', { exact: true })).toBeVisible();
    await admin.getByRole('button', { name: 'Repasses às lojas' }).click();
    await admin.getByRole('button', { name: 'Gerar repasse', exact: true }).click();
    await admin.getByLabel('Empresa', { exact: false }).selectOption({ label: 'Loja Web '+sufixo });
    await admin.getByLabel('Fim exclusivo').fill(fim);
    await admin.getByRole('button', { name: 'Gerar fechamento' }).click();
    await expect(admin.getByRole('dialog')).toHaveCount(0);
    const linhaRepasse = admin.getByRole('row').filter({ hasText: 'Loja Web '+sufixo });
    await expect(linhaRepasse.getByText('R$ 93,00', { exact: true })).toBeVisible();
    await linhaRepasse.getByRole('button', { name: 'Conferir' }).click();
    await admin.getByLabel('Referência do comprovante').fill('repasse-web-'+sufixo);
    await admin.getByRole('button', { name: 'Confirmar quitação' }).click();
    await expect(admin.getByRole('dialog')).toHaveCount(0);
    await expect(linhaRepasse.getByText('Quitado', { exact: true })).toBeVisible();
    const download = admin.waitForEvent('download');
    await admin.getByRole('button', { name: 'Exportar CSV' }).click();
    expect((await download).suggestedFilename()).toMatch(/rotaja-repasses-.*\.csv/);
  } finally { await adminContexto.close(); }
});

