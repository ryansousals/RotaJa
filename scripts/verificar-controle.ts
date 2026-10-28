import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
const base = 'http://localhost:3001';
const sufixo = randomBytes(5).toString('hex'), senha = randomBytes(24).toString('hex');
async function requisicao(rota: string, token?: string, dados?: unknown, metodo = dados ? 'POST' : 'GET', esperado=200) {
  const r=await fetch(base+rota,{method:metodo,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:dados?JSON.stringify(dados):undefined});
  const body = r.status === 204 ? {} : await r.json();
  assert.equal(r.status,esperado,`${metodo} ${rota}: ${JSON.stringify(body)}`);return body;
}
const adm=await requisicao('/autenticacao/entrar',undefined,{eml_usr:process.env.ADMIN_EMAIL,senha:process.env.ADMIN_SENHA,area:'ADM'});
const empresaDados={nom_usr:'Teste controle',eml_usr:`controle.${sufixo}@teste.local`,senha,tp_pes:'JURIDICA',raz_soc:'Empresa controle',nom_fan:`Controle ${sufixo}`,doc_emp:Array.from(randomBytes(14),b=>b%10).join(''),log_emp:'Rua teste',num_emp:'10',bai_emp:'Centro',cid_emp:'Floriano',uf_emp:'PI',tel_emp:'89999999999'};
const emp=await requisicao('/cadastros/empresa',adm.token,empresaDados,'POST',201);
try {
 const duplicado=await requisicao('/cadastros/empresa',adm.token,{...empresaDados,doc_emp:Array.from(randomBytes(14),b=>b%10).join('')},'POST',409); assert.match(duplicado.erro,/e-mail/);
 const docDuplicado=await requisicao('/cadastros/empresa',adm.token,{...empresaDados,eml_usr:`outro.${sufixo}@teste.local`},'POST',409);assert.match(docDuplicado.erro,/CPF\/CNPJ/);
 const usrs=await requisicao('/usuarios',adm.token);assert.equal(usrs.some((u:any)=>u.eml_usr===`outro.${sufixo}@teste.local`),false);
 await requisicao('/autenticacao/entrar',undefined,{eml_usr:empresaDados.eml_usr,senha,area:'ADM'},'POST',403);
 const cliente=await requisicao('/autenticacao/entrar',undefined,{eml_usr:empresaDados.eml_usr,senha,area:'EMPRESA'});
 await requisicao('/empresas/'+emp.id_emp,cliente.token,undefined,'DELETE',403);
 const cfg=await requisicao('/sistema/empresas',adm.token);
 await requisicao('/sistema/empresas',cliente.token,{st_emp_lig:false,versao:cfg.versao},'PATCH',403);
 try {
   await requisicao('/sistema/empresas',adm.token,{st_emp_lig:false,versao:cfg.versao},'PATCH');
   await requisicao('/autenticacao/eu',cliente.token,undefined,'GET',423);
   await requisicao('/pedidos',cliente.token,{},'POST',423);
   await requisicao('/autenticacao/entrar',undefined,{eml_usr:empresaDados.eml_usr,senha,area:'EMPRESA'},'POST',423);
   await requisicao('/autenticacao/eu',adm.token);
 } finally {
   const atual=await requisicao('/sistema/empresas',adm.token);
   await requisicao('/sistema/empresas',adm.token,{st_emp_lig:cfg.st_emp_lig,versao:atual.versao},'PATCH');
 }
 await requisicao('/autenticacao/eu',cliente.token);
 await requisicao('/empresas/'+emp.id_emp,adm.token,undefined,'DELETE',204);
 assert.equal((await requisicao('/empresas',adm.token)).some((e:any)=>e.id_emp===emp.id_emp),false);
 await requisicao('/autenticacao/eu',cliente.token,undefined,'GET',401);
 await requisicao('/empresas/'+emp.id_emp,adm.token,{st_atv:true},'PATCH',404);
 console.log('Controle aprovado: duplicidade específica, transação sem usuário órfão, perfis de login, pausa global, restauração e exclusão lógica.');
} finally { await requisicao('/empresas/'+emp.id_emp,adm.token,undefined,'DELETE',204); }
