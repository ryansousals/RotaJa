import 'dotenv/config';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {io} from 'socket.io-client';
const base=process.env.API_URL??'http://localhost:3001';
async function call(path:string,token?:string,body?:unknown,expected=200){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});const d=r.status===204?{}:await r.json() as any;assert.equal(r.status,expected,`${path}: ${JSON.stringify(d)}`);return d;}
const suffix=randomBytes(5).toString('hex'),pass=randomBytes(20).toString('hex');const doc=(n:number)=>Array.from(randomBytes(n),b=>b%10).join('');
const admin=(await call('/autenticacao/entrar',undefined,{eml_usr:process.env.ADMIN_EMAIL,senha:process.env.ADMIN_SENHA})).token;
const loja=await call('/cadastros/empresa',admin,{nom_usr:'Relatório '+suffix,eml_usr:`rel.${suffix}@teste.local`,senha:pass,tp_pes:'JURIDICA',raz_soc:'Relatório teste',nom_fan:'Relatório '+suffix,doc_emp:doc(14),log_emp:'Rua de teste',num_emp:'1',bai_emp:'Centro',cid_emp:'Floriano',uf_emp:'PI',tel_emp:'5589999990000'},201);
const ent=await call('/cadastros/entregador',admin,{nom_usr:'Caixa '+suffix,eml_usr:`cx.${suffix}@teste.local`,senha:pass,doc_cpf:doc(11),pla_moto:'TST1A23',tel_ent:'5589999990001'},201);
const bairro=await call('/bairros',admin,{nom_bai:'Relatório '+suffix,cid_bai:'Floriano',uf_bai:'PI',vlr_tx_ent:'10',vlr_ganho_ent:'7',vlr_tx_ret:'0',vlr_ganho_ret:'0'},201);
const cliente=(await call('/autenticacao/entrar',undefined,{eml_usr:`rel.${suffix}@teste.local`,senha:pass})).token;
const moto=(await call('/autenticacao/entrar',undefined,{eml_usr:`cx.${suffix}@teste.local`,senha:pass})).token;
const inicio=new Date().toISOString();
const ab=await call('/caixa-diario/abrir',admin,{id_ent:ent.id_ent,dt_ab:inicio,vlr_ab:'50',obs_ab:'Teste automatizado de abertura'},201);
await call('/caixa-diario/abrir',admin,{id_ent:ent.id_ent,dt_ab:inicio,vlr_ab:'0'},409);
await call(`/caixa-diario/${ab.id_ab}/previa`,cliente,undefined,403);
const socket=io(base,{auth:{token:admin},transports:['websocket'],reconnection:false});
try{
 await new Promise<void>((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});
 for(const tp of ['DINHEIRO','PIX_LOJA','CARTAO_LOJA','ONLINE_LOJA']){
  let p=await call('/pedidos',cliente,{id_bai:bairro.id_bai,chave_idem:randomUUID(),nom_dest:'Conferência '+tp,tel_dest:'5589999990002',log_dest:'Rua de teste',num_dest:'20',tp_end:'ENTREGA',st_ret:false,st_pag:'A_RECEBER',vlr_cobrar:'100',tp_pag_prev:tp},201);
  p=await new Promise<any>((resolve,reject)=>socket.timeout(10000).emit('pedido:despachar',{id_ped:p.id_ped,id_ent:ent.id_ent,versao:p.versao},(e:any,r:any)=>e||!r?.ok?reject(Error(r?.mensagem)):resolve(r.pedido)));
  for(const st_ped of ['ACEITO','EM_COLETA','NO_LOCAL','EM_ENTREGA','CONCLUIDO'])p=await call('/pedidos/status',moto,{id_ped:p.id_ped,versao:p.versao,st_ped,...(st_ped==='CONCLUIDO'?{tp_rec:tp}:{})});
 }
 const pre=await call(`/caixa-diario/${ab.id_ab}/previa`,moto);assert.deepEqual(pre.sistema,{dinheiro:'100.00',cartao:'100.00',pix:'100.00',online:'100.00'});assert.equal(pre.resumo.vlr_saldo_rep_adm,'72');
 await call('/caixas/fechar',admin,{id_ent:ent.id_ent,dt_ini:inicio,dt_fim:pre.dt_fim},409);
 const query=new URLSearchParams({inicio,fim:pre.dt_fim,id_emp:loja.id_emp,tipo:'entregadores'});
 const rel=await call('/relatorios?'+query,admin);assert.equal(rel.linhas.length,1);assert.equal(rel.linhas[0].chamadas,4);assert.equal(rel.linhas[0].repasse,'28');assert.equal(rel.linhas[0].comissao,'12');
 await call('/relatorios?'+query,cliente,undefined,403);
 query.set('tipo','empresas');const empresas=await call('/relatorios?'+query,cliente);assert.equal(empresas.linhas[0].repasse,'60');assert.equal(empresas.linhas[0].direto,'300');
 query.set('tipo','chamadas');const chamadas=await call('/relatorios?'+query,cliente);assert.equal(chamadas.linhas.length,4);assert.equal(chamadas.linhas.find((p:any)=>p.pagamento==='ONLINE_LOJA').saldo,'-10');
 query.set('id_emp',randomUUID());assert.equal((await call('/relatorios?'+query,cliente)).linhas.length,0);
 const body={dt_fim:pre.dt_fim,informado:{dinheiro:'140',cartao:'100',pix:'100',online:'100'},parcial:'0',outros:'0',pos_meia_noite:'0',observacoes:''};
 await call(`/caixa-diario/${ab.id_ab}/fechar`,moto,body,422);
 body.observacoes='Diferença de R$ 10,00 registrada pelo teste';
 const cx=await call(`/caixa-diario/${ab.id_ab}/fechar`,moto,body);assert.equal(cx.conferencia.diferenca,'-10.00');assert.equal(cx.vlr_saldo_rep_adm,'72');
 assert.equal((await call(`/caixa-diario/${ab.id_ab}/fechar`,moto,body)).id_cx,cx.id_cx);
 await call(`/caixas/${cx.id_cx}/quitar`,moto,{ref_comprovante:'teste'},403);
 await call(`/caixas/${cx.id_cx}/quitar`,admin,{ref_comprovante:'teste-relatorios-'+suffix},204);
 query.set('tipo','entregadores');query.set('id_emp',loja.id_emp);query.set('repasse','FAZER');assert.equal((await call('/relatorios?'+query,admin)).linhas.length,0);query.set('repasse','NAO_FAZER');assert.equal((await call('/relatorios?'+query,admin)).linhas.length,1);
 await call('/autenticacao/sair',moto,{},204);await call('/autenticacao/eu',moto,undefined,401);
 console.log('OK: quatro formas, isolamento de empresa, relatórios, abertura única, fechamento idempotente, diferença, quitação e logout.');
}finally{socket.disconnect();}
