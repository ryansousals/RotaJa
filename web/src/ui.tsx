import { useEffect, useRef, type ReactNode, type FormEvent } from 'react';
import { X, LoaderCircle, PackageSearch } from 'lucide-react';
import { status } from './api';
export function Modal({ titulo, subtitulo, fechar, children, largo = false }: { titulo: string; subtitulo?: string; fechar: () => void; children: ReactNode; largo?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current!; d.showModal(); return () => { d.close(); }; }, []);
  return <dialog ref={ref} className={`modal ${largo ? 'modal-largo' : ''}`} onCancel={e => { e.preventDefault(); fechar(); }} onClick={e => { if (e.target === e.currentTarget) fechar(); }}><div className="modal-cab"><div><h2>{titulo}</h2>{subtitulo && <p>{subtitulo}</p>}</div><button className="icone" aria-label="Fechar" onClick={fechar}><X size={20}/></button></div><div className="modal-corpo">{children}</div></dialog>;
}
export function Campo({ titulo, nome, valor, tipo = 'text', obrigatorio = true, dica, min, padrao, passo }: { titulo: string; nome: string; valor?: string | number; tipo?: string; obrigatorio?: boolean; dica?: string; min?: string; padrao?: string; passo?: string }) {
  return <label className="campo"><span>{titulo}{obrigatorio && <b> *</b>}</span><input name={nome} type={tipo} defaultValue={valor} required={obrigatorio} placeholder={dica} min={min} step={passo} pattern={padrao}/></label>;
}
export function Selecao({ titulo, nome, children, valor, obrigatorio = true, mudar }: { titulo: string; nome: string; children: ReactNode; valor?: string; obrigatorio?: boolean; mudar?: (valor: string) => void }) {
  return <label className="campo"><span>{titulo}{obrigatorio && <b> *</b>}</span><select name={nome} defaultValue={valor ?? ''} required={obrigatorio} onChange={e => mudar?.(e.target.value)}>{children}</select></label>;
}
export function Formulario({ children, enviar, ocupado, erro, rotulo = 'Salvar cadastro' }: { children: ReactNode; enviar: (d: Record<string, string>) => Promise<void>; ocupado: boolean; erro: string; rotulo?: string }) {
  async function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); await enviar(Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>); }
  return <form onSubmit={submit}><div className="form-grid">{children}</div>{erro && <p className="aviso erro" role="alert">{erro}</p>}<div className="form-rodape"><span>Os campos com * são obrigatórios.</span><button className="btn primario" disabled={ocupado}>{ocupado ? <LoaderCircle className="girar" size={16}/> : null}{ocupado ? 'Salvando…' : rotulo}</button></div></form>;
}
export function Vazio({ titulo = 'Nenhum registro por aqui', texto = 'Os novos registros aparecerão nesta lista.', children }: { titulo?: string; texto?: string; children?: ReactNode }) { return <div className="vazio"><PackageSearch size={36}/><h3>{titulo}</h3><p>{texto}</p>{children}</div>; }
export function Badge({ valor }: { valor: string }) {
  const classe = ['CONCLUIDO','QUITADO','PAGO','RECEBIDO'].includes(valor) ? 'verde' : ['CANCELADO','A_RECEBER','PENDENTE'].includes(valor) ? 'vermelho' : ['PREPARANDO','AGUARDANDO_VALIDACAO'].includes(valor) ? 'ambar' : 'azul';
  const nomes: Record<string,string> = { PAGO: 'Pago', RECEBIDO: 'Recebido', A_RECEBER: 'A receber', PENDENTE: 'Pendente', AGUARDANDO_VALIDACAO: 'Aguardando validação', QUITADO: 'Quitado' };
  return <span className={`badge ${classe}`}><i/>{nomes[valor] ?? status[valor] ?? valor.replaceAll('_',' ').toLowerCase()}</span>;
}
