import type { Express, Response } from 'express';
import { Prisma, st_pedido } from '@prisma/client';
import { z } from 'zod';
import { banco, type Ator } from './servicos.js';
import { Falha, operador } from './dominio.js';
const D = (v: Prisma.Decimal.Value = 0) => new Prisma.Decimal(v);
const soma = <T>(itens: T[], fn: (v:T)=>Prisma.Decimal) => itens.reduce((a,p)=>a.plus(fn(p)),D());
export function registrarRelatorios(app: Express) {
 app.get('/relatorios', async (req,res:Response) => {
  const a = res.locals.ator as Ator;
  const f = z.object({ tipo:z.enum(['chamadas','entregadores','empresas']), inicio:z.iso.datetime({offset:true}), fim:z.iso.datetime({offset:true}), id_emp:z.string().uuid().optional(), id_ent:z.string().uuid().optional(), status:z.nativeEnum(st_pedido).optional(), repasse:z.enum(['TODOS','FAZER','NAO_FAZER']).default('TODOS'), busca:z.string().max(150).default('') }).parse(req.query);
  const inicio=new Date(f.inicio),fim=new Date(f.fim);
  if(inicio>=fim || +fim-+inicio>366*86400000) throw new Falha(422,'Selecione um intervalo de até 366 dias');
  if(a.tp_usr==='REMETENTE' && f.tipo==='entregadores' || a.tp_usr==='ENTREGADOR' && f.tipo==='empresas') throw new Falha(403,'Relatório não permitido');
  const escopo:Prisma.ped_pedidosWhereInput = a.tp_usr==='REMETENTE' ? {id_usr:a.id_usr} : a.tp_usr==='ENTREGADOR' ? {entregador:{id_usr:a.id_usr}} : operador(a.tp_usr) ? {} : {id_usr:a.id_usr};
  const where:Prisma.ped_pedidosWhereInput={AND:[escopo,{id_emp:f.id_emp,id_ent:f.id_ent,st_ped:f.tipo==='chamadas'?f.status:'CONCLUIDO', ...(f.tipo==='chamadas'?{dt_cad:{gte:inicio,lt:fim}}:{dt_conc:{gte:inicio,lt:fim}}), ...(f.busca?{entregador:{usuario:{nom_usr:{contains:f.busca,mode:'insensitive'}}}}:{}), ...(f.repasse==='TODOS'?{}:f.tipo==='empresas'?{OR:f.repasse==='FAZER'?[{id_rep:null},{repasse:{st_rep:'PENDENTE'}}]:[{repasse:{st_rep:'QUITADO'}}]}:{OR:f.repasse==='FAZER'?[{id_cx:null},{caixa:{st_cx:{not:'QUITADO'}}}]:[{caixa:{st_cx:'QUITADO'}}]})}]};
  const ps=await banco.ped_pedidos.findMany({where,include:{empresa:{select:{nom_fan:true}},entregador:{select:{usuario:{select:{nom_usr:true}}}}},orderBy:{dt_cad:'asc'},take:10001});
  if(ps.length>10000) throw new Falha(422,'Mais de 10.000 chamadas: reduza o período para exportar o relatório completo');
  const concluidas=ps.filter(p=>p.st_ped==='CONCLUIDO');
  const taxa=soma(concluidas,p=>p.vlr_tx),ganho=soma(concluidas,p=>p.vlr_ganho_ent),dinheiro=soma(concluidas,p=>p.vlr_rec_din);
  type Col={chave:string;titulo:string;tipo?:string}; let colunas:Col[]=[];let linhas:Record<string,unknown>[]=[];
  if(f.tipo==='chamadas') {
   colunas=[['data','Data e hora','data'],['num_ped','Nº Pedido'],['num_chamada','Nº Chamada'],['status','Status'],['empresa','Empresa'],['cliente','Cliente'],['entregador','Entregador'],['modal','Tipo de entrega'],['pagamento','Forma de pagamento'],['recebido','Valor recebido','moeda'],['comissao','Comissão de cobrança','moeda'],['servico','Taxa de serviço','moeda'],['taxa','Taxa de entrega','moeda'],['saldo','Saldo da loja','moeda']].map(([chave,titulo,tipo])=>({chave,titulo,tipo}));
   linhas=ps.map(p=>({data:p.dt_cad,num_ped:p.num_ped,num_chamada:p.num_ped,status:p.st_ped,empresa:p.empresa?.nom_fan??'Cliente',cliente:p.nom_dest,entregador:p.entregador?.usuario.nom_usr??'Não atribuído',modal:'Moto',pagamento:p.st_pag==='PAGO'?'Pago na loja':p.tp_rec??p.tp_pag_prev,recebido:p.vlr_rec_din.plus(p.vlr_rec_loja),comissao:'0.00',servico:'0.00',taxa:p.vlr_tx,saldo:p.st_ped==='CONCLUIDO'?p.vlr_rec_din.minus(p.vlr_tx):null}));
  } else {
   const grupos=new Map<string,typeof ps>();for(const p of ps){const k=f.tipo==='empresas'?p.id_emp:p.id_ent;if(k) grupos.set(k,[...(grupos.get(k)??[]),p]);}
   if(f.tipo==='empresas') {
    colunas=[['nome','Empresa'],['chamadas','Nº Chamadas'],['recebido','Dinheiro em custódia','moeda'],['direto','Recebido direto na loja','moeda'],['taxa','Taxas de entrega','moeda'],['repasse','Saldo do repasse','moeda']].map(([chave,titulo,tipo])=>({chave,titulo,tipo}));
    linhas=[...grupos].map(([id,g])=>({id,nome:g[0].empresa?.nom_fan,chamadas:g.length,recebido:soma(g,p=>p.vlr_rec_din),direto:soma(g,p=>p.vlr_rec_loja),taxa:soma(g,p=>p.vlr_tx),repasse:soma(g,p=>p.vlr_rec_din.minus(p.vlr_tx))}));
   } else {
    colunas=[['nome','Entregador'],['chamadas','Nº Chamadas'],['pedidos','Nº Pedidos'],['dev_ped','Pedidos devolvidos'],['dev_ch','Chamadas devolvidas'],['arcados','Devolvidos arcados (entregador)'],['tx_cliente','Taxa cliente','moeda'],['taxa','Taxa entrega chamadas','moeda'],['tx_ped','Taxa entrega pedidos','moeda'],['comissao','Comissão chamadas','moeda'],['com_ped','Comissão pedidos','moeda'],['acrescimo','Acréscimo taxa entrega','moeda'],['ganho','Repasse chamadas','moeda'],['rep_ped','Repasse pedidos','moeda'],['vales','Vales','moeda'],['repasse','Repasse total','moeda'],['percentual','Comissão entrega (%)']].map(([chave,titulo,tipo])=>({chave,titulo,tipo}));
    linhas=[...grupos].map(([id,g])=>{const t=soma(g,p=>p.vlr_tx),v=soma(g,p=>p.vlr_ganho_ent);return {id,nome:g[0].entregador?.usuario.nom_usr,chamadas:g.length,pedidos:0,dev_ped:null,dev_ch:null,arcados:null,tx_cliente:null,taxa:t,tx_ped:0,comissao:t.minus(v),com_ped:0,acrescimo:null,ganho:v,rep_ped:0,vales:null,repasse:v,percentual:t.isZero()?null:t.minus(v).div(t).mul(100).toFixed(2)};});
   }
  }
  res.json({tipo:f.tipo,inicio,fim,empresa:a.tp_usr==='REMETENTE'?(await banco.emp_empresas.findUnique({where:{id_usr:a.id_usr}}))?.nom_fan:f.id_emp?(await banco.emp_empresas.findUnique({where:{id_emp:f.id_emp}}))?.nom_fan:'Todas as empresas',colunas,linhas,resumo:{chamadas:concluidas.length,taxa,ganho,comissao:taxa.minus(ganho),repasse_empresa:dinheiro.minus(taxa)},nota:'Chamadas usam o número único do pedido. O RotaJá não registra pedidos de catálogo, vales ou perdas por devolução: — significa não disponível. Comissão de chamadas é a diferença entre taxa e ganho fixo do entregador, não um desconto adicional. Comissão de cobrança e taxa de serviço não são cobradas. PIX, cartão e online são recebidos diretamente pela loja; somente dinheiro entra na custódia da central. Fazer Repasse = não quitado; Não Fazer Repasse = já quitado. Chamadas filtram criação; repasses filtram conclusão.'});
 });
}
