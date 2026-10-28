export class ErroApi extends Error { constructor(public status: number, mensagem: string) { super(mensagem); } }
export async function api<T>(rota: string, dados?: unknown, metodo = dados === undefined ? 'GET' : 'POST'): Promise<T> {
  const resposta = await fetch('/api' + rota, { method: metodo, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: dados === undefined ? undefined : JSON.stringify(dados), signal: AbortSignal.timeout(15000) });
  const corpo = resposta.status === 204 ? null : resposta.headers.get('content-type')?.includes('application/json') ? await resposta.json() : { erro: await resposta.text() };
  if (!resposta.ok) {
    if (resposta.status === 429) throw new ErroApi(429, `Muitas requisições. Aguarde ${resposta.headers.get('retry-after') ?? 'alguns'} segundos antes de tentar novamente.`);
    if (resposta.status === 401 && !rota.startsWith('/autenticacao/')) window.dispatchEvent(new Event('sessao-expirada'));
    const campos = corpo?.campos?.fieldErrors;
    throw new ErroApi(resposta.status, campos ? Object.entries(campos).map(([nome, erros]) => `${nome}: ${(erros as string[]).join(', ')}`).join(' · ') : corpo?.erro ?? 'Não foi possível concluir a operação');
  }
  return corpo as T;
}
export const reais = (v: string | number | null | undefined) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const data = (v: string) => new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
export const status: Record<string, string> = { PREPARANDO: 'Preparando', ATRIBUIDO: 'A recolher', ACEITO: 'Aceito', EM_COLETA: 'Em coleta', NO_LOCAL: 'No local', EM_ENTREGA: 'Em entrega', EM_RETORNO: 'Em retorno', CONCLUIDO: 'Concluído', CANCELADO: 'Cancelado' };
export type Usuario = { id_usr: string; nom_usr: string; eml_usr: string; tp_usr: 'ADMINISTRADOR' | 'OPERADOR' | 'REMETENTE' | 'ENTREGADOR'; st_atv?: boolean; empresa?: Empresa; entregador?: Entregador };
export type Empresa = { id_emp: string; id_usr: string; nom_fan: string; raz_soc: string; tp_pes: string; doc_emp: string; log_emp: string; num_emp: string; bai_emp: string; cid_emp: string; uf_emp: string; tel_emp: string; cmp_emp?: string; st_atv: boolean };
export type Entregador = { id_ent: string; id_usr: string; doc_cpf: string; pla_moto: string; tel_ent: string; st_atv: boolean; usuario: { nom_usr: string; eml_usr: string; st_atv: boolean } };
export type Bairro = { id_bai: string; nom_bai: string; cid_bai: string; uf_bai: string; vlr_tx_ent: string; vlr_ganho_ent: string; vlr_tx_ret: string; vlr_ganho_ret: string; st_atv: boolean };
export type Pedido = { id_ped: string; id_ent: string | null; num_ped: number; nom_dest: string; tel_dest: string; log_dest: string; num_dest: string; cmp_dest: string | null; ref_dest: string | null; id_bai: string; st_ped: string; st_pag: string; st_ret: boolean; tp_end: string; versao: number; vlr_prod: string; vlr_tx: string; vlr_ganho_ent: string; vlr_cobrar: string; vlr_rec_din: string; dt_cad: string; dt_alt: string; dt_conc: string | null; bairro?: Bairro; empresa?: { nom_fan: string }; entregador?: { id_ent: string; usuario: { nom_usr: string } }; end_loja: { logradouro: string; numero: string; bairro: string; cidade: string; uf: string } };
export type Posicao = { id_ped: string; lat: number; lng: number; dt: string };
export const eOperador = (u: Usuario) => ['ADMINISTRADOR', 'OPERADOR'].includes(u.tp_usr);
