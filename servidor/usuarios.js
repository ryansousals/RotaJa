import { hash } from 'bcryptjs';
import { z } from 'zod';
import { banco, transacao } from './servicos.js';
import { Falha, operador } from './dominio.js';
const campos = { id_usr: true, nom_usr: true, eml_usr: true, tp_usr: true, st_atv: true, dt_cad: true };
export function registrarUsuarios(aplicacao, redis, io) {
    aplicacao.get('/usuarios', async (requisicao, resposta) => {
        if (!operador(resposta.locals.ator.tp_usr))
            throw new Falha(403, 'Acesso restrito à operação');
        const f = z.object({ perfil: z.enum(['ADMINISTRADOR', 'EMPRESAS', 'ENTREGADORES', 'CLIENTES']).optional(), busca: z.string().trim().max(150).optional(), pagina: z.coerce.number().int().min(1).default(1) }).parse(requisicao.query);
        const where = {
            AND: [{ OR: [{ empresa: null }, { empresa: { dt_exc: null } }] }, { OR: [{ entregador: null }, { entregador: { dt_exc: null } }] }],
            ...(f.perfil === 'ADMINISTRADOR' ? { tp_usr: 'ADMINISTRADOR' } : f.perfil === 'EMPRESAS' ? { tp_usr: 'REMETENTE', empresa: { isNot: null } } : f.perfil === 'ENTREGADORES' ? { tp_usr: 'ENTREGADOR' } : f.perfil === 'CLIENTES' ? { tp_usr: 'REMETENTE', empresa: null } : {}),
            ...(f.busca ? { OR: [{ nom_usr: { contains: f.busca, mode: 'insensitive' } }, { eml_usr: { contains: f.busca, mode: 'insensitive' } }] } : {}),
        };
        if (!f.perfil) {
            resposta.json(await banco.usr_usuarios.findMany({ where, select: campos, orderBy: { nom_usr: 'asc' }, take: 500 }));
            return;
        }
        const [total, itens] = await banco.$transaction([banco.usr_usuarios.count({ where }), banco.usr_usuarios.findMany({ where, select: campos, orderBy: [{ nom_usr: 'asc' }, { id_usr: 'asc' }], take: 25, skip: (f.pagina - 1) * 25 })]);
        resposta.json({ itens, total, paginas: Math.max(1, Math.ceil(total / 25)) });
    });
    aplicacao.patch('/usuarios/:id', async (requisicao, resposta) => {
        const a = resposta.locals.ator;
        if (!operador(a.tp_usr))
            throw new Falha(403, 'Acesso restrito à operação');
        const id_usr = z.string().uuid().parse(requisicao.params.id);
        const d = z.object({ nom_usr: z.string().trim().min(3).max(150).optional(), eml_usr: z.string().trim().email().max(254).transform(v => v.toLowerCase()).optional(), senha: z.string().min(16).max(100).optional(), st_atv: z.boolean().optional() }).strict().refine(d => Object.keys(d).length > 0).parse(requisicao.body);
        const sen_hash = d.senha ? await hash(d.senha, 12) : undefined;
        const salvo = await transacao(async (tx) => {
            const alvo = await tx.usr_usuarios.findUniqueOrThrow({ where: { id_usr }, include: { empresa: true, entregador: true } });
            if (alvo.empresa?.dt_exc || alvo.entregador?.dt_exc)
                throw new Falha(409, 'Cadastro excluído não pode ser alterado ou reativado');
            if (['ADMINISTRADOR', 'OPERADOR'].includes(alvo.tp_usr) && a.tp_usr !== 'ADMINISTRADOR')
                throw new Falha(403, 'Somente o administrador altera acessos administrativos');
            if (id_usr === a.id_usr && d.st_atv === false)
                throw new Falha(409, 'Você não pode desativar seu próprio acesso');
            if (alvo.tp_usr === 'ADMINISTRADOR' && d.st_atv === false && await tx.usr_usuarios.count({ where: { tp_usr: 'ADMINISTRADOR', st_atv: true, id_usr: { not: id_usr } } }) === 0)
                throw new Falha(409, 'Mantenha ao menos um administrador ativo');
            return tx.usr_usuarios.update({ where: { id_usr }, data: { nom_usr: d.nom_usr, eml_usr: d.eml_usr, st_atv: d.st_atv, sen_hash }, select: campos });
        });
        if (d.st_atv === false || sen_hash) {
            let cursor = '0';
            do {
                const [proximo, chaves] = await redis.scan(cursor, 'MATCH', 'sessao:*', 'COUNT', 100);
                cursor = proximo;
                if (chaves.length) {
                    const valores = await redis.mget(...chaves);
                    const revogar = chaves.filter((_, i) => valores[i] === id_usr);
                    if (revogar.length)
                        await redis.del(...revogar);
                }
            } while (cursor !== '0');
            io.to('usr:' + id_usr).emit('acesso:bloqueado', { mensagem: d.st_atv === false ? 'Seu acesso foi desativado pela administração.' : 'Sua senha foi alterada. Entre novamente.' });
            io.in('usr:' + id_usr).disconnectSockets(true);
        }
        resposta.json(salvo);
    });
}
