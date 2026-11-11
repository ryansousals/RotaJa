export class ErroApi extends Error {
    status;
    constructor(status, mensagem) {
        super(mensagem);
        this.status = status;
    }
}
export async function api(rota, dados, metodo = dados === undefined ? 'GET' : 'POST') {
    const resposta = await fetch('/api' + rota, { method: metodo, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: dados === undefined ? undefined : JSON.stringify(dados), signal: AbortSignal.timeout(15000) });
    const corpo = resposta.status === 204 ? null : resposta.headers.get('content-type')?.includes('application/json') ? await resposta.json() : { erro: await resposta.text() };
    if (!resposta.ok) {
        if (resposta.status === 429)
            throw new ErroApi(429, `Muitas requisições. Aguarde ${resposta.headers.get('retry-after') ?? 'alguns'} segundos antes de tentar novamente.`);
        if (resposta.status === 401 && !rota.startsWith('/autenticacao/'))
            window.dispatchEvent(new Event('sessao-expirada'));
        if (resposta.status === 423)
            window.dispatchEvent(new CustomEvent('acesso-bloqueado', { detail: corpo?.erro ?? 'Acesso temporariamente bloqueado' }));
        const campos = corpo?.campos?.fieldErrors;
        throw new ErroApi(resposta.status, campos ? [...Object.entries(campos).map(([nome, erros]) => `${nome}: ${erros.join(', ')}`), ...(corpo.campos.formErrors ?? [])].join(' · ') || corpo.erro : corpo?.erro ?? 'Não foi possível concluir a operação');
    }
    return corpo;
}
export const reais = (v) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const data = (v) => new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
export const status = { PRONTO: 'Pronto', ATRIBUIDO: 'Pronto · aguardando aceite', ACEITO: 'A recolher', EM_COLETA: 'A recolher', NO_LOCAL: 'A recolher', EM_ENTREGA: 'Enviando', EM_RETORNO: 'Enviando', CONCLUIDO: 'Concluído', CANCELADO: 'Cancelado' };
export const eOperador = (u) => ['ADMINISTRADOR', 'OPERADOR'].includes(u.tp_usr);
