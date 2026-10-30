import type { Express,Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { banco,transacao,type Ator } from './servicos.js';
import { calcularCaixa,Falha,operador } from './dominio.js';
import { conferirCaixa,type Valores } from './conferencia.js';
const moeda=z.string().regex(/^\d{1,9}(\.\d{1,2})?$/),ajuste=z.string().regex(/^-?\d{1,9}(\.\d{1,2})?$/);
const valores=z.object({dinheiro:moeda,cartao:moeda,pix:moeda,online:moeda}).strict();
const ator=(res:Response)=>res.locals.ator as Ator;
async function acesso(tx:Prisma.TransactionClient,a:Ator,id_ent:string){const e=await tx.ent_entregadores.findUniqueOrThrow({where:{id_ent}});if(!operador(a.tp_usr)&&(a.tp_usr!=='ENTREGADOR'||e.id_usr!==a.id_usr))throw new Falha(403,'Caixa não permitido');return e;}
async function previa(tx:Prisma.TransactionClient,id_ab:string,a:Ator,fim:Date){
 const ab=await tx.ab_aberturas_caixa.findUniqueOrThrow({where:{id_ab},include:{entregador:{include:{usuario:{select:{nom_usr:true}}}}}});await acesso(tx,a,ab.id_ent);
 if(ab.id_cx)throw new Falha(409,'Abertura já fechada');if(fim<=ab.dt_ab||fim>new Date())throw new Falha(422,'Período de fechamento inválido');
 const pedidos=await tx.ped_pedidos.findMany({where:{id_ent:ab.id_ent,st_ped:'CONCLUIDO',dt_conc:{gte:ab.dt_ab,lt:fim}}});
 if(pedidos.some(p=>p.id_cx))throw new Falha(409,'Existem entregas já fechadas neste período');
 const sistema:Valores={dinheiro:'0.00',cartao:'0.00',pix:'0.00',online:'0.00'};
 for(const p of pedidos){const k=p.tp_rec==='DINHEIRO'?'dinheiro':p.tp_rec==='CARTAO_LOJA'?'cartao':p.tp_rec==='PIX_LOJA'?'pix':p.tp_rec==='ONLINE_LOJA'?'online':null;if(k)sistema[k]=new Prisma.Decimal(sistema[k]).plus(p.vlr_rec_din).plus(p.vlr_rec_loja).toFixed(2);}
 return {ab,pedidos,sistema,resumo:calcularCaixa(pedidos),dt_fim:fim.toISOString()};
}
export function registrarCaixaDiario(app:Express){
 app.get('/caixa-diario',async(req,res)=>{const a=ator(res);if(!operador(a.tp_usr)&&a.tp_usr!=='ENTREGADOR')throw new Falha(403,'Acesso restrito');
 const f=z.object({inicio:z.iso.datetime({offset:true}),fim:z.iso.datetime({offset:true})}).parse(req.query);const inicio=new Date(f.inicio),fim=new Date(f.fim);if(inicio>=fim||+fim-+inicio>366*86400000)throw new Falha(422,'Período inválido');
 const scope=operador(a.tp_usr)?{}:{entregador:{id_usr:a.id_usr}};
 const [aberturas,caixas]=await banco.$transaction([banco.ab_aberturas_caixa.findMany({where:{...scope,id_cx:null},include:{entregador:{include:{usuario:{select:{nom_usr:true}}}}},orderBy:{dt_ab:'desc'}}),banco.cx_caixa_entregador.findMany({where:{...scope,dt_ini:{lt:fim},dt_fim:{gte:inicio}},include:{entregador:{include:{usuario:{select:{nom_usr:true}}}}},orderBy:{dt_fim:'desc'},take:501})]);
 if(caixas.length>500)throw new Falha(422,'Reduza o período: mais de 500 fechamentos');res.json({aberturas,caixas});});
 app.post('/caixa-diario/abrir',async(req,res)=>{const a=ator(res);const f=z.object({id_ent:z.string().uuid(),dt_ab:z.iso.datetime({offset:true}),vlr_ab:moeda,obs_ab:z.string().max(2000).default('')}).strict().parse(req.body);if(new Date(f.dt_ab)>new Date())throw new Falha(422,'Abertura não pode estar no futuro');
 res.status(201).json(await transacao(async tx=>{const ent=await acesso(tx,a,f.id_ent);if(!ent.st_atv)throw new Falha(422,'Entregador inativo');if(await tx.ab_aberturas_caixa.findFirst({where:{id_ent:f.id_ent,id_cx:null}}))throw new Falha(409,'Entregador já tem caixa aberto');if(await tx.cx_caixa_entregador.findFirst({where:{id_ent:f.id_ent,dt_fim:{gt:new Date(f.dt_ab)}}}))throw new Falha(409,'Abertura deve ser posterior ao último fechamento');return tx.ab_aberturas_caixa.create({data:{...f,id_usr:a.id_usr}});}));});
 app.get('/caixa-diario/:id/previa',async(req,res)=>{const d=await banco.$transaction(tx=>previa(tx,z.string().uuid().parse(req.params.id),ator(res),new Date()),{isolationLevel:'RepeatableRead'});res.json({ab:d.ab,sistema:d.sistema,resumo:d.resumo,dt_fim:d.dt_fim});});
 app.post('/caixa-diario/:id/fechar',async(req,res)=>{const a=ator(res);const id_ab=z.string().uuid().parse(req.params.id);const f=z.object({dt_fim:z.iso.datetime({offset:true}),informado:valores,parcial:moeda,outros:ajuste,pos_meia_noite:ajuste,observacoes:z.string().max(4000)}).strict().parse(req.body);
 res.json(await transacao(async tx=>{const ab=await tx.ab_aberturas_caixa.findUniqueOrThrow({where:{id_ab}});await acesso(tx,a,ab.id_ent);if(ab.id_cx)return tx.cx_caixa_entregador.findUniqueOrThrow({where:{id_cx:ab.id_cx}});
 const d=await previa(tx,id_ab,a,new Date(f.dt_fim));const totais=conferirCaixa(d.sistema,f.informado,d.ab.vlr_ab.toFixed(2),f.parcial,f.outros,f.pos_meia_noite);
 if((new Prisma.Decimal(totais.diferenca).isZero()===false||!new Prisma.Decimal(f.outros).isZero()||!new Prisma.Decimal(f.pos_meia_noite).isZero()||!new Prisma.Decimal(f.parcial).isZero())&&!f.observacoes.trim())throw new Falha(422,'Informe observações para diferenças ou ajustes');
 const cx=await tx.cx_caixa_entregador.create({data:{id_ent:d.ab.id_ent,dt_ref:d.ab.dt_ab,dt_ini:d.ab.dt_ab,dt_fim:new Date(f.dt_fim),...d.resumo,st_cx:'AGUARDANDO_VALIDACAO',conferencia:{...f,sistema:d.sistema,abertura:d.ab.vlr_ab.toFixed(2),...totais,id_usr:a.id_usr,dt_reg:new Date().toISOString()}}});
 await tx.ped_pedidos.updateMany({where:{id_ped:{in:d.pedidos.map(p=>p.id_ped)},id_cx:null},data:{id_cx:cx.id_cx}});await tx.ab_aberturas_caixa.update({where:{id_ab},data:{id_cx:cx.id_cx}});return cx;}));});
}
