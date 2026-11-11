import { semearBairros } from './semear-bairros.js';
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
const banco = new PrismaClient();
try {
    const senha = process.env.ADMIN_SENHA;
    if (!senha || senha.length < 16 || senha === 'substitua-por-uma-senha-forte')
        throw new Error('Configure ADMIN_SENHA com pelo menos 16 caracteres');
    await banco.usr_usuarios.upsert({ where: { eml_usr: process.env.ADMIN_EMAIL ?? 'admin@rotaja.local' }, update: {}, create: {
            nom_usr: 'Administrador', eml_usr: process.env.ADMIN_EMAIL ?? 'admin@rotaja.local', sen_hash: await hash(senha, 12), tp_usr: 'ADMINISTRADOR',
        } });
    await semearBairros(banco);
}
finally {
    await banco.$disconnect();
}
