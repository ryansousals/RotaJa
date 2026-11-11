import express from 'express';
import helmet from 'helmet';
import { resolve } from 'node:path';

// Render usa um único endereço para interface, API e Socket.io.
export function criarEntrada(aplicacao, pasta = resolve('interface/publicacao')) {
    const entrada = express();
    entrada.use(helmet({ contentSecurityPolicy: { directives: { frameSrc: ["'self'", 'https://www.openstreetmap.org'] } } }));
    entrada.use('/api', aplicacao);
    entrada.use(express.static(pasta, { index: false, dotfiles: 'deny' }));
    entrada.get(['/', '/empresa', '/entregador'], (_requisicao, resposta) => resposta.sendFile(resolve(pasta, 'index.html')));
    return entrada;
}
