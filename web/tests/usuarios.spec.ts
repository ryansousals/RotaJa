import {test,expect} from '@playwright/test';
import {config} from 'dotenv';
import {resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
config({path:resolve(process.cwd(),'../.env')});

test('usuários: abas, busca, edição e revogação de acesso',async({page,playwright})=>{
  const sufixo=randomBytes(5).toString('hex'),nome='Usuário teste '+sufixo,senha=randomBytes(20).toString('hex');
  const email=`usuario.${sufixo}@teste.local`,novoEmail=`editado.${sufixo}@teste.local`;
  await page.goto('/');await page.getByLabel('E-mail',{exact:true}).fill(process.env.ADMIN_EMAIL!);await page.getByLabel('Senha',{exact:true}).fill(process.env.ADMIN_SENHA!);await page.getByRole('button',{name:'Entrar na plataforma'}).click();
  await page.getByRole('link',{name:'Usuários',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Usuários',exact:true})).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(4);
  await expect(page.getByRole('tab',{name:'ADMINISTRADOR',exact:true})).toHaveAttribute('aria-selected','true');
  await page.getByRole('button',{name:'Novo Usuário',exact:true}).click();await page.getByRole('button',{name:'Continuar',exact:true}).click();
  await page.getByLabel('Nome completo').fill(nome);await page.getByLabel('E-mail de acesso').fill(email);await page.getByLabel('Senha inicial').fill(senha);await page.getByRole('button',{name:'Cadastrar usuário',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByPlaceholder('Pesquisar usuários por nome ou email...').fill(email);await page.getByRole('button',{name:'BUSCAR',exact:true}).click();
  const linha=page.getByRole('row').filter({hasText:nome});await expect(linha).toBeVisible();
  await linha.getByRole('button',{name:'Editar usuário '+nome,exact:true}).click();await page.getByLabel('E-mail de acesso').fill(novoEmail);await page.getByRole('button',{name:'Salvar alterações'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByPlaceholder('Pesquisar usuários por nome ou email...').fill(novoEmail);await expect(linha).toContainText(novoEmail);
  const ctx=await playwright.request.newContext({baseURL:'http://localhost:3002'});
  try {
    const login=await ctx.post('/api/autenticacao/entrar',{data:{eml_usr:novoEmail,senha,area:'ADM'}});expect(login.status()).toBe(200);
    await linha.getByRole('switch').click();await expect(linha.getByRole('switch')).toHaveAttribute('aria-checked','false');await expect(linha.getByText('INATIVO',{exact:true})).toBeVisible();
    expect((await ctx.get('/api/autenticacao/eu')).status()).toBe(401);
    await linha.getByRole('switch').click();await expect(linha.getByRole('switch')).toHaveAttribute('aria-checked','true');
    expect((await ctx.get('/api/autenticacao/eu')).status()).toBe(401);
    const lista=await (await page.request.get('/api/usuarios?perfil=ADMINISTRADOR&busca='+encodeURIComponent(novoEmail))).json();const id=lista.itens[0].id_usr;
    expect((await page.request.patch('/api/usuarios/'+id,{data:{tp_usr:'OPERADOR'}})).status()).toBe(422);
    expect((await page.request.patch('/api/usuarios/'+id,{data:{eml_usr:process.env.ADMIN_EMAIL}})).status()).toBe(409);
    const eu=await (await page.request.get('/api/autenticacao/eu')).json();expect((await page.request.patch('/api/usuarios/'+eu.id_usr,{data:{st_atv:false}})).status()).toBe(409);
    await linha.getByRole('switch').click();await expect(linha.getByRole('switch')).toHaveAttribute('aria-checked','false');
  } finally {await ctx.dispose();}
  await page.getByRole('tab',{name:'CLIENTES',exact:true}).click();await page.getByPlaceholder('Pesquisar usuários por nome ou email...').fill('');
  await page.getByRole('button',{name:'Novo Usuário',exact:true}).click();await page.getByRole('button',{name:'Continuar',exact:true}).click();await page.getByLabel('Nome completo').fill('Cliente '+sufixo);await page.getByLabel('E-mail de acesso').fill('cliente.'+email);await page.getByLabel('Senha inicial').fill(senha);await page.getByRole('button',{name:'Cadastrar usuário',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await page.getByPlaceholder('Pesquisar usuários por nome ou email...').fill('cliente.'+email);await expect(page.getByRole('cell',{name:'Cliente '+sufixo,exact:true})).toBeVisible();
  for(const perfil of ['EMPRESAS','ENTREGADORES']){await page.getByRole('tab',{name:perfil,exact:true}).click();await expect(page.getByRole('cell',{name:'Cliente '+sufixo,exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Novo Usuário',exact:true}).click();await page.getByRole('button',{name:'Continuar',exact:true}).click();await expect(page.getByRole('heading',{name:perfil==='EMPRESAS'?'Cadastrar empresa':'Cadastrar entregador',exact:true})).toBeVisible();await page.getByRole('button',{name:'Fechar',exact:true}).click();}
  await page.getByRole('tab',{name:'ADMINISTRADOR',exact:true}).click();await page.getByPlaceholder('Pesquisar usuários por nome ou email...').fill(novoEmail);await expect(linha).toBeVisible();await page.screenshot({path:'test-results/usuarios.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await expect(page.getByRole('button',{name:'Novo Usuário',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
