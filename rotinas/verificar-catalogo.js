import 'dotenv/config';
import assert from 'node:assert/strict';
import {PrismaClient} from '@prisma/client';
import {semearBairros,bairrosOficiais} from '../prisma/semear-bairros.js';
const banco=new PrismaClient();
try{
  assert.equal(bairrosOficiais.length,59);
  const antes=await banco.bai_bairros.findMany({orderBy:{id_bai:'asc'}});
  await semearBairros(banco);
  const depois=await banco.bai_bairros.findMany({orderBy:{id_bai:'asc'}});
  assert.deepEqual(JSON.stringify(depois),JSON.stringify(antes));
  const cancelar=new Error('Desfazer dados temporários da verificação');
  try{
    await banco.$transaction(async transacao=>{
      const bairro=await transacao.bai_bairros.findFirstOrThrow({where:{nom_bai:'Alto da Cruz',dt_exc:null}});
      await transacao.bai_bairros.update({where:{id_bai:bairro.id_bai},data:{vlr_tx_ent:'8.31'}});
      await semearBairros({$transaction:executar=>executar(transacao)});
      assert.equal((await transacao.bai_bairros.findUniqueOrThrow({where:{id_bai:bairro.id_bai}})).vlr_tx_ent.toFixed(2),'8.31');
      throw cancelar;
    });
  }catch(erro){if(erro!==cancelar)throw erro;}
  console.log('Catálogo com 59 bairros: repetição preserva dados e alterações administrativas.');
}finally{await banco.$disconnect();}
