import type { Express } from 'express';
import type { Server } from 'socket.io';
import { z } from 'zod';
import { banco, transacao, type Ator } from './servicos.js';
import { Falha } from './dominio.js';
export async function validarAcessoEmpresa(a: Ator) {
  if (a.tp_usr !== 'REMETENTE') return;
  const empresa = await banco.emp_empresas.findUnique({ where: { id_usr: a.id_usr } });
  if (!empresa?.st_atv || empresa.dt_exc) throw new Falha(423, 'Empresa inativa ou excluída. Entre em contato com a administração.');
  const cfg = await banco.cfg_sistema.findUnique({ where: { id_cfg: 1 } });
  if (cfg && !cfg.st_emp_lig) throw new Falha(423, 'O acesso das empresas está temporariamente desligado pela administração.');
}
export function registrarControle(app: Express, io: Server) {
  app.get('/sistema/empresas', async (_req, res) => {
    if ((res.locals.ator as Ator).tp_usr !== 'ADMINISTRADOR') throw new Falha(403, 'Somente o administrador controla o sistema');
    res.json(await banco.cfg_sistema.findUniqueOrThrow({ where: { id_cfg: 1 } }));
  });
  app.patch('/sistema/empresas', async (req,res) => {
    const a = res.locals.ator as Ator;
    if (a.tp_usr !== 'ADMINISTRADOR') throw new Falha(403, 'Somente o administrador controla o sistema');
    const d = z.object({ st_emp_lig: z.boolean(), versao: z.number().int().nonnegative() }).strict().parse(req.body);
    const cfg = await transacao(async tx => {
      const r = await tx.cfg_sistema.updateMany({ where: { id_cfg: 1, versao: d.versao }, data: { st_emp_lig: d.st_emp_lig, versao: { increment: 1 }, id_usr_alt: a.id_usr } });
      if (!r.count) throw new Falha(409, 'O controle foi alterado por outro administrador. Atualize e tente novamente.');
      return tx.cfg_sistema.findUniqueOrThrow({ where: { id_cfg: 1 } });
    });
    if (!cfg.st_emp_lig) { io.to('empresas').emit('acesso:bloqueado', { mensagem: 'O sistema das empresas foi desligado pela administração.' }); io.in('empresas').disconnectSockets(true); }
    res.json(cfg);
  });
  app.delete('/empresas/:id', async (req,res) => {
    if ((res.locals.ator as Ator).tp_usr !== 'ADMINISTRADOR') throw new Falha(403, 'Somente o administrador pode excluir empresas');
    const id_emp = z.string().uuid().parse(req.params.id);
    const empresa = await transacao(async tx => {
      const e = await tx.emp_empresas.findUniqueOrThrow({ where: { id_emp } });
      if (!e.dt_exc) await tx.emp_empresas.update({ where: { id_emp }, data: { st_atv: false, dt_exc: new Date() } });
      await tx.usr_usuarios.update({ where: { id_usr: e.id_usr }, data: { st_atv: false } });
      return e;
    });
    io.to(`usr:${empresa.id_usr}`).emit('acesso:bloqueado', { mensagem: 'Esta empresa foi excluída da operação. Contate a administração.' });
    io.in(`usr:${empresa.id_usr}`).disconnectSockets(true);
    res.sendStatus(204);
  });
}
