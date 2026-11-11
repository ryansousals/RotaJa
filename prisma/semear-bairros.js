import { readFileSync } from 'node:fs';
export const bairrosOficiais = JSON.parse(readFileSync(new URL('./bairros-oficiais.json', import.meta.url), 'utf8'));
const normalizar = texto => texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');
export async function semearBairros(banco) {
  return banco.$transaction(async transacao => {
    const id_carga = 'bairros-oficiais-20261108';
    const aplicado=await transacao.cfg_cargas.findUnique({where:{id_carga}});
    const id_nomes=id_carga+'-nomes';
    const nomesAplicados=await transacao.cfg_cargas.findUnique({where:{id_carga:id_nomes}});
    if(aplicado && nomesAplicados) return;
    const existentes = await transacao.bai_bairros.findMany({where:{cid_bai:{equals:'Floriano',mode:'insensitive'},uf_bai:'PI'}});
    for (const bairro of bairrosOficiais) {
      const iguais = existentes.filter(item=>normalizar(item.nom_bai)===normalizar(bairro.nom_bai));
      const existente = iguais.find(item=>item.nom_bai===bairro.nom_bai) ?? iguais[0];
      if (iguais.length>1) throw new Error('Há bairros duplicados para revisar: '+bairro.nom_bai);
      if (existente?.dt_exc) continue;
      if (existente) {
        if (!nomesAplicados && existente.nom_bai!==bairro.nom_bai) await transacao.bai_bairros.update({where:{id_bai:existente.id_bai},data:{nom_bai:bairro.nom_bai}});
        // Valores negociados por loja, ganhos e pedidos históricos são preservados.
        if (!aplicado && bairro.vlr_tx_ent!==null) await transacao.bai_bairros.update({where:{id_bai:existente.id_bai},data:{vlr_tx_ent:bairro.vlr_tx_ent,vlr_tx_ret:bairro.vlr_tx_ent,st_sob_consulta:false}});
      } else if (!aplicado) {
        await transacao.bai_bairros.create({data:{...bairro,cid_bai:'Floriano',uf_bai:'PI',vlr_tx_ent:bairro.vlr_tx_ent??'0',vlr_tx_ret:bairro.vlr_tx_ent??'0',vlr_ganho_ent:bairro.vlr_tx_ent??'0',vlr_ganho_ret:bairro.vlr_tx_ent??'0',st_sob_consulta:bairro.vlr_tx_ent===null}});
      }
    }
    if(!aplicado) await transacao.cfg_cargas.create({data:{id_carga}});
    if(!nomesAplicados) await transacao.cfg_cargas.create({data:{id_carga:id_nomes}});
  },{isolationLevel:'Serializable',timeout:30000});
}
