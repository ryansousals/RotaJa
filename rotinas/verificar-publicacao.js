// Ensaio isolado: banco descartável e HTTPS apenas no endereço local.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { request } from 'node:https';
import assert from 'node:assert/strict';
import { io } from 'socket.io-client';

mkdirSync('entrega', { recursive: true });
const senha = randomBytes(24).toString('hex');
const usarRender = process.argv.includes('--render');
const ambiente = { ...process.env, DOMINIO: 'localhost', POSTGRES_USER: 'ensaio', POSTGRES_DB: 'ensaio', POSTGRES_PASSWORD: senha, ADMIN_EMAIL: 'ensaio@rotaja.local', ADMIN_SENHA: senha };
const configuracao = `services:
  entrada:
    ports: !override
      - "127.0.0.1:18443:443"
  api:
    environment:
      WEB_ORIGINS: https://localhost:18443
`;
writeFileSync('entrega/Caddyfile.render', '{$DOMINIO} {\n reverse_proxy api:3001\n}\n');
writeFileSync('entrega/compose.ensaio.yml', usarRender ? `services:
  entrada:
    ports: !override
      - "127.0.0.1:18443:443"
    volumes: !override
      - ./entrega/Caddyfile.render:/etc/caddy/Caddyfile:ro
      - certificados:/data
      - configuracao_caddy:/config
  api:
    build: !override
      context: .
      dockerfile: Dockerfile.render
    environment:
      WEB_ORIGINS: https://localhost:18443
      ADMIN_EMAIL: \${ADMIN_EMAIL}
      ADMIN_SENHA: \${ADMIN_SENHA}
    healthcheck:
      test: [CMD, node, -e, 'fetch("http://127.0.0.1:3001/api/saude").then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))']
` : configuracao);
const argumentos = ['compose', '--env-file', 'infraestrutura/producao.env.example', '-p', 'rotaja-publicacao-teste', '-f', 'compose.producao.yml', '-f', 'entrega/compose.ensaio.yml'];
function executar(comando) {
    const resultado = spawnSync('docker', [...argumentos, ...comando], { env: ambiente, encoding: 'utf8', timeout: 240000 });
    if (resultado.status !== 0) throw new Error(resultado.stderr || resultado.error?.message || 'Falha no Docker');
    return resultado.stdout;
}
function consultar(caminho, dados, cookie) {
    return new Promise((concluir, rejeitar) => {
        const corpo = dados ? JSON.stringify(dados) : undefined;
        const requisicao = request(`https://localhost:18443${caminho}`, { rejectUnauthorized: false, method: corpo ? 'POST' : 'GET', headers: { origin: 'https://localhost:18443', ...(corpo ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) } }, resposta => {
            let texto = ''; resposta.on('data', parte => texto += parte);
            resposta.on('end', () => concluir({ status: resposta.statusCode, cabecalhos: resposta.headers, texto }));
        });
        requisicao.setTimeout(10000, () => requisicao.destroy(new Error('Tempo esgotado')));
        requisicao.on('error', rejeitar); requisicao.end(corpo);
    });
}
try {
    console.log('Iniciando ensaio isolado de publicação…');
    executar(['up', '--build', '-d', '--wait', '--wait-timeout', '120']);
    assert.equal((await consultar('/api/saude')).status, 200);
    assert.equal((await consultar('/')).status, 200);
    const acesso = await consultar('/api/autenticacao/entrar', { eml_usr: ambiente.ADMIN_EMAIL, senha });
    assert.equal(acesso.status, 200);
    const cookieCompleto = acesso.cabecalhos['set-cookie'][0];
    for (const atributo of ['HttpOnly', 'Secure', 'SameSite=Strict']) assert.ok(cookieCompleto.includes(atributo));
    const cookie = cookieCompleto.split(';')[0];
    assert.equal((await consultar('/api/autenticacao/eu', undefined, cookie)).status, 200);
    const socket = io('https://localhost:18443', { transports: ['websocket'], rejectUnauthorized: false, extraHeaders: { Cookie: cookie, Origin: 'https://localhost:18443' }, reconnection: false });
    try {
        await new Promise((concluir, rejeitar) => { const limite = setTimeout(() => rejeitar(new Error('Socket indisponível')), 10000); socket.once('connect', () => { clearTimeout(limite); concluir(); }); socket.once('connect_error', erro => { clearTimeout(limite); rejeitar(erro); }); });
    } finally { socket.disconnect(); }
    assert.equal((await consultar('/api/autenticacao/sair', {}, cookie)).status, 204);
    assert.equal((await consultar('/api/autenticacao/eu', undefined, cookie)).status, 401);
    executar(['exec', '-T', 'db', 'sh', '-c', 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/ensaio.dump && pg_restore --list /tmp/ensaio.dump >/dev/null']);
    console.log('OK: interface, API, cookie seguro, WebSocket, logout e backup. Certificado local de teste; emissão pública depende do servidor real.');
} finally {
    // Somente os volumes do projeto descartável acima são removidos.
    executar(['down', '-v']);
}
