import { useEffect, useState } from 'react';
import { Pencil, ChartPie, Calculator, Plus } from 'lucide-react';
import { api, data, reais, eOperador } from './api';
import { Modal, Formulario, Campo, Indicador } from './componentes';
import { hojeRel } from './Relatorios';
import { Abrir, Fechar, Resumo } from './CaixaDiario';
const nomes = { dinheiro: 'Dinheiro', pix: 'Pix', cartao: 'Cartão', online: 'Online' };
const tipoMov = { TROCO_ENTRADA: 'Troco entregue ao motoboy', TROCO_SAIDA: 'Troco devolvido à central', PARCIAL: 'Acerto parcial' };
const inicial = { aberturas: [], pendentes: [], caixas: [], movimentos: [], geral: null, encerrados: [] };
export function CaixaDiario({ usuario }) {
    const op = eOperador(usuario), [aba, definirAba] = useState('pendentes'), [dia, definirDia] = useState(hojeRel()), [idEnt, definirIdEnt] = useState(''), [ent, definirEnt] = useState([]), [dados, definirDados] = useState(inicial), [erro, definirErro] = useState(''), [rev, definirRev] = useState(0), [ocupado, definirOcupado] = useState(false), [carregando, definirCarregando] = useState(false);
    const [novo, definirNovo] = useState(false), [pre, definirPre] = useState(null), [parcial, definirParcial] = useState(null), [visao, definirVisao] = useState(null), [detalhe, definirDetalhe] = useState(null), [quitar, definirQuitar] = useState(null), [mov, definirMov] = useState(false), [geral, definirGeral] = useState(false);
    const atualizar = () => definirRev(x => x + 1);
    useEffect(() => { if (op)
        api('/entregadores').then(definirEnt).catch(e => definirErro(e.message)); }, [op]);
    useEffect(() => { let ativo = true; if (!dia)
        return; definirCarregando(true); definirDados(inicial); api('/caixa-registro?' + new URLSearchParams({ dia, ...(idEnt ? { id_ent: idEnt } : {}) })).then(d => { if (ativo) {
        definirDados(d);
        definirErro('');
    } }).catch(e => { if (ativo)
        definirErro(e.message); }).finally(() => { if (ativo)
        definirCarregando(false); }); return () => { ativo = false; }; }, [dia, idEnt, rev]);
    async function fechar(a) { definirOcupado(true); try {
        definirPre(await api(`/caixa-diario/${a.id_ab}/previa`));
    }
    catch (e) {
        definirErro(e.message);
    }
    finally {
        definirOcupado(false);
    } }
    const abas = [['aberturas', 'Abertura de Caixa'], ['pendentes', 'Fech. Pendentes'], ['concluidos', 'Fech. Concluídos'], ...(op ? [['geral', 'Fech. Geral'], ['geral-concluido', 'Fech. Geral Concluído'], ['troco', 'Registro de Troco']] : [])];
    const caixas = dados.caixas.filter(c => aba === 'concluidos' ? c.st_cx === 'QUITADO' : c.st_cx !== 'QUITADO');
    return <><div className="pagina-titulo"><div><span className="sobretitulo">PRESTAÇÃO DE CONTAS</span><h1>Registro de Caixa</h1><p>Recebimentos, fundo inicial, trocos e acertos dos entregadores.</p></div><button className="btn primario" onClick={() => definirNovo(true)}><Plus size={16}/>Abrir caixa</button></div>
 <section className="cartao registro-caixa"><div className="abas" role="tablist" aria-label="Fluxos do caixa">{abas.map(([v, n]) => <button role="tab" aria-selected={aba === v} key={v} className={aba === v ? 'ativa' : ''} onClick={() => definirAba(v)}>{n}</button>)}</div>
 <div className="periodo-bar"><label>Data do caixa<input aria-label="Data do caixa" type="date" value={dia} onChange={e => definirDia(e.target.value)}/></label>{op && <label>Entregador<select aria-label="Filtrar entregador" value={idEnt} onChange={e => definirIdEnt(e.target.value)}><option value="">Todos os entregadores</option>{ent.map(e => <option key={e.id_ent} value={e.id_ent}>{e.usuario.nom_usr}</option>)}</select></label>}<button className="btn" disabled={carregando} onClick={atualizar}>Atualizar</button></div>
 {erro && <p className="aviso erro" role="alert">{erro}</p>}{carregando && <p role="status" className="aviso">Carregando caixa…</p>}
 {aba === 'pendentes' && <><div className="tabela-scroll"><table><thead><tr>{['Entregador', 'Total no sistema', 'Disponível', 'Fechamento parcial', 'Fechamento'].map(t => <th key={t}>{t}</th>)}</tr></thead><tbody>{dados.pendentes.map(p => <tr key={p.id_ab}><td><strong>{p.entregador.usuario.nom_usr}</strong><small className="celula-detalhe">Aberto em {data(p.dt_ab)}</small></td><td>{reais(p.total_sistema)}<small className="celula-detalhe">Corridas do dia · fundo e troco na abertura</small></td><td><span className={'badge ' + (p.disponivel ? 'verde' : 'vermelho')}>{p.disponivel ? 'DISPONÍVEL' : 'INDISPONÍVEL'}</span><small className="celula-detalhe">{p.motivo}</small></td><td><div className="acoes">{op && <button className="btn compacto" aria-label={`Registrar parcial de ${p.entregador.usuario.nom_usr}`} onClick={() => definirParcial(p)}><Pencil size={16}/></button>}<button className="btn compacto" aria-label={`Detalhar parciais de ${p.entregador.usuario.nom_usr}`} onClick={() => definirVisao(p)}><ChartPie size={16}/></button><span>{reais(p.total_parcial)}</span></div></td><td><button className="btn compacto" aria-label={`Fechar caixa de ${p.entregador.usuario.nom_usr}`} disabled={!p.disponivel || ocupado} onClick={() => void fechar(p)}><Calculator size={17}/>Fechar caixa</button></td></tr>)}</tbody></table></div>{!dados.pendentes.length && !carregando && <p className="aviso">Nenhum caixa aberto pendente nesta data.</p>}
 <h3 className="secao-cab">Aguardando validação do acerto</h3><TabelaCaixas caixas={caixas} op={op} detalhe={definirDetalhe} quitar={definirQuitar}/></>}
 {aba === 'aberturas' && <div className="tabela-scroll"><table><thead><tr><th>Entregador</th><th>Abertura</th><th>Fundo inicial</th><th>Troco líquido</th><th>Recebido nas corridas do turno</th><th>Total com fundo e troco</th></tr></thead><tbody>{dados.aberturas.map(a => { const p = dados.pendentes.find(p => p.id_ab === a.id_ab), troco = p?.troco ?? a.caixa?.vlr_troco_cx, recebido = p?.total_turno ?? a.caixa?.conferencia?.total_sistema; return <tr key={a.id_ab}><td>{a.entregador.usuario.nom_usr}</td><td>{data(a.dt_ab)}</td><td>{reais(a.vlr_ab)}</td><td>{troco !== undefined ? reais(troco) : '—'}</td><td>{recebido !== undefined ? reais(recebido) : '—'}</td><td>{recebido !== undefined ? reais(Number(a.vlr_ab) + Number(troco ?? 0) + Number(recebido)) : '—'}</td></tr>; })}</tbody></table></div>}
 {aba === 'concluidos' && <TabelaCaixas caixas={caixas} op={op} detalhe={definirDetalhe} quitar={definirQuitar}/>}
 {aba === 'troco' && <><div className="secao-cab"><h2>Entradas e saídas de troco</h2><button className="btn primario" disabled={!dados.pendentes.length} onClick={() => definirMov(true)}>Registrar troco</button></div><Movimentos lista={dados.movimentos.filter(m => m.tp_mov !== 'PARCIAL')}/><p className="nota-relatorio">Entrada aumenta o dinheiro em poder do entregador; saída registra a devolução para a central. Não são receita de entregas.</p></>}
 {aba === 'geral' && dados.geral && <><ResumoGeral g={dados.geral}/><div className="secao-cab"><p>O encerramento consolida todos os entregadores do dia, independentemente do filtro. Disponível após o término do dia e a quitação de todos os caixas.</p><button className="btn primario" disabled={!!dados.encerrados.length || dia >= hojeRel()} onClick={() => definirGeral(true)}>{dados.encerrados.length ? 'Dia encerrado' : 'Encerrar caixa geral'}</button></div></>}
 {aba === 'geral-concluido' && (dados.encerrados.length ? dados.encerrados.map(g => <article key={g.id_ger}><div className="secao-cab"><h2>Dia {g.resumo.dia} · Encerrado</h2><p>{g.autor.nom_usr} · {data(g.dt_fec)}</p></div><ResumoGeral g={g.resumo}/><p className="aviso">{g.obs_ger}</p><p className="nota-relatorio">Fechamento global arquivado: inclui todos os entregadores, sem recálculo retroativo.</p></article>) : <p className="aviso">Nenhum fechamento geral concluído nesta data.</p>)}
 </section><p className="nota-relatorio">Horário de Fortaleza. Total no sistema mostra recebimentos das corridas do dia. A conferência definitiva inclui todo o turno aberto; Pix, cartão e online são recebimentos diretos da loja. Valores de troco não alteram repasses de frete.</p>
 {novo && <Abrir usuario={usuario} fechar={() => definirNovo(false)} pronto={() => { definirNovo(false); atualizar(); }}/>}{pre && <Fechar previa={pre} sair={() => definirPre(null)} pronto={() => { definirPre(null); atualizar(); }}/>}
 {(parcial || mov) && <Lancar tipo={parcial ? 'PARCIAL' : 'TROCO_ENTRADA'} aberturas={parcial ? [parcial] : dados.pendentes} sair={() => { definirParcial(null); definirMov(false); }} pronto={() => { definirParcial(null); definirMov(false); atualizar(); }}/>}
 {visao && <Modal titulo="Detalhamento dos acertos parciais" subtitulo={visao.entregador.usuario.nom_usr} fechar={() => definirVisao(null)}><div className="totais-caixa">{Object.entries(nomes).map(([k, n]) => <div key={k}><small>{n}</small><strong>{reais(visao.parcial[k])}</strong></div>)}</div><p>Total do turno: {reais(visao.total_parcial)}</p><Movimentos lista={dados.movimentos.filter(m => m.tp_mov === 'PARCIAL' && m.abertura.id_ab === visao.id_ab)}/><small>Histórico abaixo limitado ao dia selecionado; total inclui todo o turno.</small></Modal>}
 {detalhe && <Modal titulo="Detalhes do fechamento" subtitulo={detalhe.entregador.usuario.nom_usr} fechar={() => definirDetalhe(null)}><p>{data(detalhe.dt_ini)} até {data(detalhe.dt_fim)}</p>{detalhe.conferencia ? <><Resumo c={detalhe.conferencia} ganho={detalhe.vlr_tot_ganho}/><p>{detalhe.conferencia.observacoes}</p></> : <p>Fechamento anterior à conferência detalhada.</p>}</Modal>}
 {quitar && <Modal titulo="Validar quitação do caixa" fechar={() => definirQuitar(null)}><Formulario erro={erro} ocupado={ocupado} rotulo="Confirmar quitação" enviar={async (d) => { definirOcupado(true); try {
        await api(`/caixas/${quitar.id_cx}/quitar`, d);
        definirQuitar(null);
        atualizar();
    }
    catch (e) {
        definirErro(e.message);
    }
    finally {
        definirOcupado(false);
    } }}><Campo nome="ref_comprovante" titulo="Comprovante (mínimo 5 caracteres)"/></Formulario></Modal>}
 {geral && <Modal titulo="Encerrar caixa geral" subtitulo={`Todos os entregadores · ${dia}`} fechar={() => definirGeral(false)}><Formulario erro={erro} ocupado={ocupado} rotulo="Confirmar encerramento geral" enviar={async (d) => { definirOcupado(true); try {
        await api('/caixa-registro/geral/fechar', { dia, ...d });
        definirGeral(false);
        definirAba('geral-concluido');
        atualizar();
    }
    catch (e) {
        definirErro(e.message);
    }
    finally {
        definirOcupado(false);
    } }}><p>Os totais serão arquivados. O servidor verificará os caixas de toda a operação antes de encerrar.</p><Campo titulo="Observações do encerramento" nome="observacoes"/></Formulario></Modal>}
 </>;
}
function TabelaCaixas({ caixas, op, detalhe, quitar }) { return <div className="tabela-scroll"><table><thead><tr><th>Entregador</th><th>Fechamento</th><th>Diferença</th><th>Situação</th><th>Ações</th></tr></thead><tbody>{caixas.map(c => <tr key={c.id_cx}><td>{c.entregador.usuario.nom_usr}</td><td>{data(c.dt_fim)}</td><td className={Number(c.conferencia?.diferenca) < 0 ? 'valor-negativo' : ''}>{c.conferencia ? reais(c.conferencia.diferenca) : 'Sem conferência'}</td><td><Indicador valor={c.st_cx}/></td><td><button className="btn compacto" onClick={() => detalhe(c)}>Detalhes</button>{op && c.st_cx !== 'QUITADO' && <button className="btn compacto" onClick={() => quitar(c)}>Validar quitação</button>}</td></tr>)}</tbody></table></div>; }
function ResumoGeral({ g }) { return <><div className="totais-caixa">{[['Recebido nas corridas', g.total_recebido], ['Fundo inicial liberado', g.fundo_inicial], ['Troco líquido', g.troco], ['Parciais registrados', g.total_parcial], ['Dinheiro após parciais (antes do acerto final)', g.dinheiro_a_conferir], ['Ganhos dos entregadores', g.ganhos]].map(([n, v]) => <div key={n}><small>{n}</small><strong>{reais(v)}</strong></div>)}</div><div className="totais-caixa">{Object.entries(nomes).map(([k, n]) => <div key={k}><small>{n}</small><strong>{reais(g.recebimentos[k])}</strong></div>)}</div><p className="aviso">{g.qtd_entregas} entregas · {g.aberturas_pendentes} aberturas pendentes · {g.caixas_pendentes} aguardando acerto · {g.caixas_quitados} quitados</p></>; }
function Movimentos({ lista }) { return <div className="tabela-scroll"><table><thead><tr><th>Horário</th><th>Entregador</th><th>Tipo</th><th>Dinheiro</th><th>Pix</th><th>Cartão</th><th>Online</th><th>Observação / autor</th></tr></thead><tbody>{lista.map(m => <tr key={m.id_mov}><td>{data(m.dt_mov)}</td><td>{m.abertura.entregador.usuario.nom_usr}</td><td>{tipoMov[m.tp_mov]}</td>{['dinheiro', 'pix', 'cartao', 'online'].map(k => <td key={k}>{reais(m.valores[k])}</td>)}<td>{m.obs_mov}<small className="celula-detalhe">{m.autor.nom_usr}</small></td></tr>)}</tbody></table></div>; }
function Lancar({ tipo, aberturas, sair, pronto }) {
    const [chave] = useState(() => crypto.randomUUID()), [erro, definirErro] = useState(''), [ocupado, definirOcupado] = useState(false);
    return <Modal titulo={tipo === 'PARCIAL' ? 'Registrar acerto parcial' : 'Registrar troco'} fechar={sair}><Formulario erro={erro} ocupado={ocupado} rotulo="Salvar lançamento" enviar={async (d) => { definirOcupado(true); try {
        await api('/caixa-registro/movimentos', { id_ab: d.id_ab, chave_idem: chave, tp_mov: tipo === 'PARCIAL' ? tipo : d.tp_mov, valores: { dinheiro: d.dinheiro, pix: d.pix ?? '0', cartao: d.cartao ?? '0', online: d.online ?? '0' }, obs_mov: d.obs_mov });
        pronto();
    }
    catch (e) {
        definirErro(e.message);
    }
    finally {
        definirOcupado(false);
    } }}><label className="campo"><span>Entregador</span><select name="id_ab" required>{aberturas.map(a => <option key={a.id_ab} value={a.id_ab}>{a.entregador.usuario.nom_usr}</option>)}</select></label>{tipo !== 'PARCIAL' && <label className="campo"><span>Movimento de troco</span><select name="tp_mov"><option value="TROCO_ENTRADA">Entregar troco ao motoboy</option><option value="TROCO_SAIDA">Receber troco de volta</option></select></label>}{(tipo === 'PARCIAL' ? Object.keys(nomes) : ['dinheiro']).map(k => <Campo key={k} nome={k} titulo={nomes[k]} tipo="number" passo="0.01" min="0" valor="0"/>)}<Campo nome="obs_mov" titulo="Observação / comprovante"/><p>Registros são preservados no histórico. Cartão, Pix e online representam conferência do pagamento direto à loja.</p></Formulario></Modal>;
}
