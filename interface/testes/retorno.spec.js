import {test,expect} from '@playwright/test';
import {config} from 'dotenv';
import {resolve} from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
config({path:resolve(process.cwd(),'../.env')});
// Espaça os cenários para respeitar os limites de acesso da API local.
test.beforeEach(async()=>{await new Promise(concluir=>setTimeout(concluir,15000));});
test('catálogo oficial e chave de retorno atualizam a taxa e respeitam a loja',async({page,playwright})=>{
  const sufixo=randomBytes(4).toString('hex'),senha=randomBytes(20).toString('hex'),email=`retorno.${sufixo}@teste.local`;
  const administrador=await playwright.request.newContext({baseURL:'http://localhost:3002'});
  try{
    expect((await administrador.post('/api/autenticacao/entrar',{data:{eml_usr:process.env.ADMIN_EMAIL,senha:process.env.ADMIN_SENHA}})).status()).toBe(200);
    const resposta=await administrador.post('/api/cadastros/empresa',{data:{nom_usr:'Retorno '+sufixo,eml_usr:email,senha,tp_pes:'JURIDICA',raz_soc:'Teste de retorno',nom_fan:'Retorno '+sufixo,doc_emp:Array.from(randomBytes(14),n=>n%10).join(''),log_emp:'Rua teste',num_emp:'1',bai_emp:'Centro',cid_emp:'Floriano',uf_emp:'PI',tel_emp:'5589999990000'}});expect(resposta.status()).toBe(201);const empresa=await resposta.json();
    const bairros=await (await administrador.get('/api/bairros')).json();
    const catalogo=JSON.parse(readFileSync(resolve(process.cwd(),'../prisma/bairros-oficiais.json'),'utf8'));expect(catalogo).toHaveLength(59);
    for(const item of catalogo){const cadastrado=bairros.find(b=>b.nom_bai===item.nom_bai);expect(cadastrado, item.nom_bai).toBeTruthy();if(item.vlr_tx_ent!==null)expect(Number(cadastrado.vlr_tx_ent)).toBe(Number(item.vlr_tx_ent));else expect(cadastrado.st_sob_consulta).toBe(true);}
    const bairro=bairros.find(b=>b.nom_bai==='Alto da Cruz'),consulta=bairros.find(b=>b.nom_bai==='Princesa do Sul');
    await page.goto('/empresa');await page.getByLabel('E-mail',{exact:true}).fill(email);await page.getByLabel('Senha',{exact:true}).fill(senha);await page.getByRole('button',{name:'Entrar na plataforma'}).click();await page.getByRole('link',{name:'Minhas chamadas',exact:true}).click();await page.getByRole('button',{name:'Nova chamada',exact:true}).click();
    await page.getByLabel('Bairro permitido').selectOption(bairro.id_bai);const taxa=page.locator('.orcamento');await expect(taxa).toContainText('8,00');const chave=page.getByRole('switch',{name:'Com Retorno?',exact:true});await expect(chave).toHaveAttribute('aria-checked','false');await chave.click();await expect(taxa).toContainText('16,00');await chave.click();await expect(taxa).toContainText('8,00');await chave.click();
    await page.getByLabel('Nome completo do destinatário').fill('Retorno teste');await page.getByLabel('Telefone com DDD').fill('5589999990001');await page.getByLabel('Rua / Logradouro').fill('Rua destino');await page.getByLabel(/^Número/).fill('2');
    const gravacao=page.waitForResponse(r=>r.url().endsWith('/api/pedidos')&&r.request().method()==='POST');await page.getByRole('button',{name:'Abrir chamada',exact:true}).click();const pedido=await (await gravacao).json();expect(pedido.st_ret).toBe(true);expect(Number(pedido.vlr_tx)).toBe(16);expect(Number(pedido.vlr_ganho_ent)).toBe(Number(bairro.vlr_ganho_ent)*2);await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button',{name:'Nova chamada',exact:true}).click();await page.getByLabel('Bairro permitido').selectOption(consulta.id_bai);await expect(taxa).toContainText('Sob consulta');await expect(page.getByRole('button',{name:'Abrir chamada',exact:true})).toBeDisabled();await page.getByRole('button',{name:'Fechar',exact:true}).click();
    const dados={id_bai:consulta.id_bai,chave_idem:randomUUID(),nom_dest:'Teste consulta',tel_dest:'5589999990001',log_dest:'Rua teste',num_dest:'1',tp_end:'ENTREGA',st_ret:false,st_pag:'PAGO'};expect((await page.request.post('/api/pedidos',{data:dados})).status()).toBe(422);
    expect((await administrador.put(`/api/empresas/${empresa.id_emp}/tarifas/${bairro.id_bai}`,{data:{vlr_tx_ent:'6.50',vlr_tx_ret:'1'}})).status()).toBe(200);
    const personalizado=await page.request.post('/api/pedidos',{data:{...dados,id_bai:bairro.id_bai,chave_idem:randomUUID(),st_ret:true}});expect(personalizado.status()).toBe(201);expect(Number((await personalizado.json()).vlr_tx)).toBe(13);
    expect((await page.request.post('/api/pedidos',{data:{...dados,id_bai:bairro.id_bai,chave_idem:randomUUID(),st_ret:true,st_pag:'A_RECEBER',vlr_cobrar:'12.99',tp_pag_prev:'DINHEIRO'}})).status()).toBe(422);
    await page.getByRole('button',{name:'Nova chamada',exact:true}).click();await page.getByLabel('Bairro permitido').selectOption(bairro.id_bai);await page.getByRole('switch',{name:'Com Retorno?',exact:true}).click();await expect(taxa).toContainText('13,00');await page.screenshot({path:'resultados-testes/retorno.png',fullPage:true});
  }finally{await administrador.dispose();}
});
