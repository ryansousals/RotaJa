import { spawnSync } from 'node:child_process';

for (const nome of ['DATABASE_URL', 'REDIS_URL', 'ADMIN_EMAIL', 'ADMIN_SENHA']) {
    if (!process.env[nome]) throw new Error(`Configure ${nome} no painel da hospedagem`);
}
if (!process.env.WEB_ORIGINS && !process.env.RENDER_EXTERNAL_URL) throw new Error('Configure WEB_ORIGINS com o endereço HTTPS do site');
for (const argumentos of [['node_modules/prisma/build/index.js', 'migrate', 'deploy'], ['prisma/popular.js']]) {
    const ambiente = { ...process.env, DATABASE_URL: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL };
    const resultado = spawnSync(process.execPath, argumentos, { stdio: 'inherit', timeout: 180000, env: ambiente });
    if (resultado.status !== 0) throw new Error('Falha ao preparar o banco. Confira o log de migração/cadastro.');
}
await import('../servidor/servidor.js');
