import type { Express, Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { banco, type Ator } from './servicos.js';
import { Falha } from './dominio.js';

export function registrarPortal(app: Express) {
  app.get('/portal/resumo', async (req, res: Response) => {
    const ator = res.locals.ator as Ator;
    if (ator.tp_usr !== 'REMETENTE') throw new Falha(403, 'Área exclusiva da empresa');
    const d = z.object({ inicio: z.string().datetime({ offset: true }), fim: z.string().datetime({ offset: true }) }).strict().parse(req.query);
    const inicio = new Date(d.inicio), fim = new Date(d.fim);
    if (inicio >= fim || fim.getTime() - inicio.getTime() > 366 * 86400000) throw new Falha(422, 'Selecione um período de até 366 dias');
    const resposta = await banco.$transaction(async tx => {
      const empresa = await tx.emp_empresas.findUnique({ where: { id_usr: ator.id_usr } });
      if (!empresa?.st_atv) throw new Falha(403, 'Empresa não cadastrada ou inativa');
      const escopo = { id_emp: empresa.id_emp };
      const periodo = { gte: inicio, lt: fim };
      const grupos = await tx.ped_pedidos.groupBy({ by: ['st_ped'], where: { ...escopo, dt_cad: periodo }, _count: true });
      const concluidos = await tx.ped_pedidos.aggregate({ where: { ...escopo, st_ped: 'CONCLUIDO', dt_conc: periodo }, _count: true, _sum: { vlr_tx: true, vlr_rec_din: true, vlr_rec_loja: true } });
      const semFechamento = await tx.ped_pedidos.aggregate({ where: { ...escopo, st_ped: 'CONCLUIDO', id_rep: null }, _sum: { vlr_rec_din: true, vlr_tx: true } });
      const pendentes = await tx.rep_repasses_lojas.aggregate({ where: { ...escopo, st_rep: 'PENDENTE' }, _sum: { vlr_rep: true } });
      const recebidos = await tx.rep_repasses_lojas.aggregate({ where: { ...escopo, st_rep: 'QUITADO', dt_pag: periodo, vlr_rep: { gt: 0 } }, _sum: { vlr_rep: true } });
      const total = await tx.ped_pedidos.count({ where: escopo });
      const ativas = await tx.ped_pedidos.count({ where: { ...escopo, st_ped: { notIn: ['CONCLUIDO','CANCELADO'] } } });
      const recentes = await tx.ped_pedidos.findMany({ where: { ...escopo, dt_cad: periodo }, orderBy: { dt_cad: 'desc' }, take: 8, select: { id_ped: true, num_ped: true, nom_dest: true, st_ped: true, dt_cad: true, vlr_tx: true, bairro: { select: { nom_bai: true } } } });
      const valor = (v: Prisma.Decimal | null) => v ?? new Prisma.Decimal(0);
      const aberto = valor(semFechamento._sum.vlr_rec_din).minus(valor(semFechamento._sum.vlr_tx));
      const emFechamento = valor(pendentes._sum.vlr_rep);
      const saldo = aberto.plus(emFechamento);
      return { empresa: { nom_fan: empresa.nom_fan }, total_chamadas: total, chamadas_ativas: ativas,
        chamadas_periodo: grupos.reduce((s,g) => s + g._count, 0), estados: Object.fromEntries(grupos.map(g => [g.st_ped,g._count])),
        concluidas_periodo: concluidos._count, taxas_periodo: valor(concluidos._sum.vlr_tx), dinheiro_periodo: valor(concluidos._sum.vlr_rec_din), direto_loja_periodo: valor(concluidos._sum.vlr_rec_loja),
        recebido_periodo: valor(recebidos._sum.vlr_rep), saldo_atual: saldo, a_receber: Prisma.Decimal.max(saldo, 0), a_pagar: Prisma.Decimal.max(saldo.negated(), 0),
        sem_fechamento: aberto, em_fechamento: emFechamento, recentes };
    }, { isolationLevel: 'RepeatableRead' });
    res.json(resposta);
  });
}
