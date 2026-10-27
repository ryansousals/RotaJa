import { createHash } from 'node:crypto';
import { Prisma, PrismaClient, st_pedido } from '@prisma/client';
import { z } from 'zod';
import { calcularCaixa, Falha, operador, proximos } from './dominio.js';
export const banco = new PrismaClient();
export type Ator = { id_usr: string; tp_usr: string };
const texto = z.string().trim().min(1).max(200);
const dinheiro = z.string().regex(/^\d{1,9}(\.\d{1,2})?$/);
export const novoPedido = z.object({
  id_bai: z.string().uuid(), chave_idem: z.string().min(8).max(100), nom_dest: texto,
  tel_dest: z.string().regex(/^\+?[0-9]{10,15}$/), log_dest: texto, num_dest: texto,
  cmp_dest: texto.optional(), ref_dest: texto.optional(), tp_end: z.enum(['ENTREGA','ORIGEM']),
  st_ret: z.boolean(), st_pag: z.enum(['PAGO','A_RECEBER']), vlr_prod: dinheiro,
}).strict();
export async function transacao<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let tentativa = 0; ; tentativa++) {
    try { return await banco.$transaction(fn, { isolationLevel: 'Serializable' }); }
    catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2034' && tentativa < 3) continue;
      throw erro;
    }
  }
}
export async function criarPedido(ator: Ator, entrada: unknown) {
  if (ator.tp_usr !== 'REMETENTE') throw new Falha(403, 'Apenas remetentes abrem chamados neste endpoint');
  const dados = novoPedido.parse(entrada);
  const resumo = createHash('sha256').update(JSON.stringify(dados)).digest('hex');
  return transacao(async tx => {
    const existente = await tx.ped_pedidos.findUnique({ where: { id_usr_chave_idem: { id_usr: ator.id_usr, chave_idem: dados.chave_idem } } });
    if (existente) {
      if (existente.resumo_req !== resumo) throw new Falha(409, 'Chave de idempotência reutilizada com outros dados');
      return existente;
    }
    const empresa = await tx.emp_empresas.findUnique({ where: { id_usr: ator.id_usr } });
    const bairro = await tx.bai_bairros.findUnique({ where: { id_bai: dados.id_bai } });
    if (!empresa?.st_atv) throw new Falha(403, 'Empresa inativa ou ausente');
    if (!bairro?.st_atv) throw new Falha(422, 'Selecione um bairro permitido e ativo');
    const taxa = bairro.vlr_tx_ent.plus(dados.st_ret ? bairro.vlr_tx_ret : 0);
    const ganho = bairro.vlr_ganho_ent.plus(dados.st_ret ? bairro.vlr_ganho_ret : 0);
    const pedido = await tx.ped_pedidos.create({ data: {
      ...dados, id_usr: ator.id_usr, id_emp: empresa.id_emp, resumo_req: resumo,
      end_loja: { logradouro: empresa.log_emp, numero: empresa.num_emp, complemento: empresa.cmp_emp,
        bairro: empresa.bai_emp, cidade: empresa.cid_emp, uf: empresa.uf_emp },
      vlr_tx: taxa, vlr_ganho_ent: ganho,
      vlr_cobrar: dados.st_pag === 'A_RECEBER' ? new Prisma.Decimal(dados.vlr_prod).plus(taxa) : 0,
    } });
    await tx.log_historico_pedidos.create({ data: { id_ped: pedido.id_ped, id_usr: ator.id_usr, acao: 'CRIACAO', dados_nov: { st_ped: pedido.st_ped, vlr_tx: taxa.toFixed(2) } } });
    return pedido;
  });
}
export async function despachar(ator: Ator, entrada: unknown) {
  if (!operador(ator.tp_usr)) throw new Falha(403, 'Acesso restrito à operação');
  const d = z.object({ id_ped: z.string().uuid(), id_ent: z.string().uuid(), versao: z.number().int().nonnegative() }).parse(entrada);
  return transacao(async tx => {
    const p = await tx.ped_pedidos.findUniqueOrThrow({ where: { id_ped: d.id_ped } });
    const ent = await tx.ent_entregadores.findUnique({ where: { id_ent: d.id_ent }, include: { usuario: true } });
    if (!ent?.st_atv || !ent.usuario.st_atv) throw new Falha(422, 'Entregador inativo');
    if (!['PREPARANDO','ATRIBUIDO'].includes(p.st_ped)) throw new Falha(409, 'Pedido já aceito ou encerrado');
    const alterado = await tx.ped_pedidos.updateMany({ where: { id_ped: d.id_ped, versao: d.versao }, data: { id_ent: d.id_ent, st_ped: 'ATRIBUIDO', versao: { increment: 1 } } });
    if (!alterado.count) throw new Falha(409, 'Pedido alterado por outro operador; atualize a tela');
    await tx.log_historico_pedidos.create({ data: { id_ped: p.id_ped, id_usr: ator.id_usr, acao: 'DESPACHO', dados_ant: { id_ent: p.id_ent }, dados_nov: { id_ent: d.id_ent } } });
    return { pedido: await tx.ped_pedidos.findUniqueOrThrow({ where: { id_ped: p.id_ped } }), id_usr_ent: ent.id_usr, id_ent_ant: p.id_ent };
  });
}
export async function mudarStatus(ator: Ator, entrada: unknown) {
  const d = z.object({ id_ped: z.string().uuid(), versao: z.number().int().nonnegative(), st_ped: z.nativeEnum(st_pedido), tp_rec: z.enum(['DINHEIRO','PIX_LOJA','CARTAO_LOJA']).optional() }).parse(entrada);
  return transacao(async tx => {
    const p = await tx.ped_pedidos.findUniqueOrThrow({ where: { id_ped: d.id_ped }, include: { entregador: true } });
    if (!operador(ator.tp_usr) && (ator.tp_usr !== 'ENTREGADOR' || p.entregador?.id_usr !== ator.id_usr)) throw new Falha(403, 'Pedido não atribuído ao usuário');
    if (!proximos[p.st_ped].includes(d.st_ped)) throw new Falha(409, 'Transição de status inválida');
    if (d.st_ped === 'ATRIBUIDO') throw new Falha(422, 'Use o despacho para atribuir entregador');
    if (p.st_ret && p.st_ped === 'EM_ENTREGA' && d.st_ped === 'CONCLUIDO') throw new Falha(422, 'Conclua também o retorno');
    if (!p.st_ret && d.st_ped === 'EM_RETORNO') throw new Falha(422, 'Pedido sem retorno');
    const concluido = d.st_ped === 'CONCLUIDO';
    if (concluido && p.st_pag === 'A_RECEBER' && !d.tp_rec) throw new Falha(422, 'Informe a forma de recebimento');
    const alterado = await tx.ped_pedidos.updateMany({ where: { id_ped: p.id_ped, versao: d.versao }, data: {
      st_ped: d.st_ped, versao: { increment: 1 }, ...(concluido ? { dt_conc: new Date(), tp_rec: d.tp_rec,
        vlr_rec_din: d.tp_rec === 'DINHEIRO' && p.st_pag === 'A_RECEBER' ? p.vlr_cobrar : 0,
        vlr_rec_loja: d.tp_rec && d.tp_rec !== 'DINHEIRO' && p.st_pag === 'A_RECEBER' ? p.vlr_cobrar : 0 } : {}),
    } });
    if (!alterado.count) throw new Falha(409, 'Versão desatualizada');
    await tx.log_historico_pedidos.create({ data: { id_ped: p.id_ped, id_usr: ator.id_usr, acao: 'STATUS', dados_ant: { st_ped: p.st_ped }, dados_nov: { st_ped: d.st_ped, tp_rec: d.tp_rec ?? null } } });
    return tx.ped_pedidos.findUniqueOrThrow({ where: { id_ped: p.id_ped } });
  });
}
export async function fecharCaixa(ator: Ator, entrada: unknown) {
  const d = z.object({ id_ent: z.string().uuid(), dt_ini: z.string().datetime({ offset: true }), dt_fim: z.string().datetime({ offset: true }) }).parse(entrada);
  const inicio = new Date(d.dt_ini), fim = new Date(d.dt_fim);
  if (inicio >= fim || fim > new Date()) throw new Falha(422, 'Período inválido ou ainda em andamento');
  return transacao(async tx => {
    const ent = await tx.ent_entregadores.findUniqueOrThrow({ where: { id_ent: d.id_ent } });
    if (!operador(ator.tp_usr) && ent.id_usr !== ator.id_usr) throw new Falha(403, 'Caixa de outro entregador');
    const existente = await tx.cx_caixa_entregador.findUnique({ where: { id_ent_dt_ini_dt_fim: { id_ent: d.id_ent, dt_ini: inicio, dt_fim: fim } } });
    if (existente) return existente;
    const pedidos = await tx.ped_pedidos.findMany({ where: { id_ent: d.id_ent, st_ped: 'CONCLUIDO', dt_conc: { gte: inicio, lt: fim } } });
    if (pedidos.some(p => p.id_cx)) throw new Falha(409, 'Período sobrepõe caixa existente');
    const caixa = await tx.cx_caixa_entregador.create({ data: { id_ent: d.id_ent, dt_ini: inicio, dt_fim: fim, dt_ref: inicio, ...calcularCaixa(pedidos), st_cx: 'AGUARDANDO_VALIDACAO' } });
    await tx.ped_pedidos.updateMany({ where: { id_ped: { in: pedidos.map(p => p.id_ped) }, id_cx: null }, data: { id_cx: caixa.id_cx } });
    return caixa;
  });
}
