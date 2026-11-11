import { useEffect, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Bike, CheckCheck, ChevronLeft, ChevronRight, Clock3, Eye, Filter, MapPin, Package, Plus, RefreshCw, Search, X } from 'lucide-react';
import { api, data, eOperador, reais, status } from './api';
import { Indicador, Campo, Formulario, Modal, Selecao, Vazio } from './componentes';
import { DetalhePedido } from './PedidoDetalhe';
export function Pedidos({ usuario, revisao, atualizar, avisar, socket, online, abrirNovo = false }) {
    const [lista, definirLista] = useState({ itens: [], total: 0, paginas: 1, pagina: 1 });
    const [entregadores, definirEntregadores] = useState([]), [resumo, definirResumo] = useState({});
    const [filtro, definirFiltro] = useState('ATIVOS'), [busca, definirBusca] = useState(''), [termo, definirTermo] = useState(''), [pagina, definirPagina] = useState(1);
    const [erro, definirErro] = useState(''), [carregando, definirCarregando] = useState(true), [novo, definirNovo] = useState(abrirNovo && usuario.tp_usr === 'REMETENTE'), [detalhe, definirDetalhe] = useState(null);
    const [despachando, definirDespachando] = useState(null), [agora, definirAgora] = useState(Date.now());
    const op = eOperador(usuario), campo = usuario.tp_usr === 'ENTREGADOR';
    useEffect(() => {
        if (!op)
            return;
        let ativo = true;
        const carregar = () => api('/entregadores?caixa_aberto=true').then(e => { if (ativo)
            definirEntregadores(e); }).catch(e => { if (ativo)
            definirErro(e.message); });
        carregar();
        const t = setInterval(carregar, 60000);
        return () => { ativo = false; clearInterval(t); };
    }, [op, revisao]);
    useEffect(() => { const t = setTimeout(() => { definirTermo(busca); definirPagina(1); }, 300); return () => clearTimeout(t); }, [busca]);
    useEffect(() => { const t = setInterval(() => definirAgora(Date.now()), 30000); return () => clearInterval(t); }, []);
    useEffect(() => {
        let ativo = true;
        definirCarregando(true);
        const query = new URLSearchParams({ pagina: String(pagina), busca: termo, ...(filtro ? { status: filtro } : {}) });
        Promise.all([api('/pedidos?' + query), api('/painel')]).then(([l, r]) => { if (ativo) {
            definirLista(l);
            definirResumo(r.estados);
            definirErro('');
            if (pagina > l.paginas)
                definirPagina(l.paginas);
        } }).catch(e => { if (ativo)
            definirErro(e.message); }).finally(() => { if (ativo)
            definirCarregando(false); });
        return () => { ativo = false; };
    }, [pagina, termo, filtro, revisao, op]);
    const ativos = Object.entries(resumo).filter(([s]) => !['CONCLUIDO', 'CANCELADO'].includes(s)).reduce((s, [, n]) => s + n, 0);
    async function despachar(p, id_ent) {
        if (!socket?.connected) {
            avisar('Aguarde a conexão em tempo real para despachar.', true);
            return;
        }
        definirDespachando(p.id_ped);
        socket.timeout(10000).emit('pedido:despachar', { id_ped: p.id_ped, id_ent, versao: p.versao }, (erro, r) => {
            definirDespachando(null);
            atualizar();
            if (erro || !r?.ok)
                avisar(r?.mensagem ?? 'Não foi possível confirmar o despacho. Confira o pedido antes de tentar de novo.', true);
            else
                avisar('Entregador atribuído com sucesso.');
        });
    }
    return <><div className="pagina-titulo"><div><span className="sobretitulo">{op ? 'CONTROLE EM TEMPO REAL' : campo ? 'SUA OPERAÇÃO NA RUA' : 'SUA LOJA CONECTADA'}</span><h1>{op ? 'Visão operacional' : campo ? 'Minhas corridas' : 'Minhas chamadas'}<span className="titulo-ponto"/></h1><p>{op ? 'Cada entrega no lugar certo. Sua operação sob controle.' : campo ? 'Aceite chamados e acompanhe cada etapa da sua rota.' : 'Solicite entregas e acompanhe seus pedidos em um só lugar.'}</p></div><div className="acoes"><button className="btn" onClick={atualizar} aria-label="Atualizar pedidos"><RefreshCw size={16}/>Atualizar</button>{usuario.tp_usr === 'REMETENTE' && <button className="btn primario" onClick={() => definirNovo(true)}><Plus size={17}/>Nova chamada</button>}</div></div>
    <div className="metricas">{[[Package, ativos, 'Entregas ativas', 'Todas as corridas em andamento', 'azul'], [Clock3, resumo.PRONTO ?? 0, 'Aguardando despacho', 'Prontas para receber um entregador', 'ambar'], [Bike, (resumo.EM_ENTREGA ?? 0) + (resumo.EM_COLETA ?? 0) + (resumo.EM_RETORNO ?? 0), 'Em rota', 'Coletas, entregas e retornos', 'violeta'], [CheckCheck, resumo.CONCLUIDO ?? 0, 'Entregas concluídas', 'Histórico da sua operação', 'verde']].map(([Icone, n, t, d, c]) => { const I = Icone; return <article className="cartao metrica" key={String(t)}><div><span>{String(t)}</span><span className={`metrica-icone ${c}`}><I size={19}/></span></div><strong>{String(n)}</strong><small>{String(d)}</small></article>; })}</div>
    <section className="cartao operacao"><div className="secao-cab"><div><h2>{campo ? 'Suas entregas' : 'Gerenciamento de entregas'}<span className="contador">{lista.total}</span></h2><p>{campo ? 'Selecione a corrida para aceitar ou avançar.' : 'Acompanhe, despache e gerencie os chamados.'}</p></div><span className="sinal-vivo"><i />{online ? 'Ao vivo' : 'Atualização a cada 30 s'}</span></div>
    <div className="tabela-filtros"><div className="abas"><button className={filtro === 'ATIVOS' ? 'ativa' : ''} onClick={() => { definirFiltro('ATIVOS'); definirPagina(1); }}>Em andamento <span>{ativos}</span></button><button className={filtro === 'CONCLUIDO' ? 'ativa' : ''} onClick={() => { definirFiltro('CONCLUIDO'); definirPagina(1); }}>Concluídas</button><button className={filtro === '' ? 'ativa' : ''} onClick={() => { definirFiltro(''); definirPagina(1); }}>Todas</button></div><div className="filtros-direita"><label className="pesquisa"><Search size={16}/><input aria-label="Buscar pedidos" value={busca} onChange={e => definirBusca(e.target.value)} placeholder="Buscar pedido, cliente ou empresa"/>{busca && <button aria-label="Limpar busca" onClick={() => definirBusca('')}><X size={14}/></button>}</label><label className="select-filtro"><Filter size={15}/><select aria-label="Filtrar por status" value={filtro} onChange={e => { definirFiltro(e.target.value); definirPagina(1); }}><option value="ATIVOS">Em andamento</option><option value="">Todos os status</option>{Object.entries(status).filter(([v]) => !['EM_COLETA', 'NO_LOCAL', 'EM_RETORNO'].includes(v)).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label></div></div>
    {erro && <div className="aviso erro" role="alert">{erro}<button onClick={atualizar}>Tentar novamente</button></div>}
    {campo ? <div className="corridas-grid">{lista.itens.map(p => <button className="corrida-card" key={p.id_ped} onClick={() => definirDetalhe(p)}><div><strong>Pedido #{p.num_ped}</strong><Indicador valor={p.st_ped}/></div><h3>{p.nom_dest}</h3><p><MapPin size={15}/>{p.log_dest}, {p.num_dest} · {p.bairro?.nom_bai}</p><div className="corrida-dados"><span>{p.tp_end === 'ORIGEM' ? 'Coleta no destinatário' : 'Entrega no destinatário'}</span><b>{reais(p.vlr_ganho_ent)} de ganho</b></div><span className="btn primario">Abrir corrida<ArrowUpRight size={16}/></span></button>)}</div> : <div className="tabela-scroll" aria-busy={carregando}><table><thead><tr>{['Pedido', 'Cliente / Destinatário', 'Bairro', 'Empresa', 'Status', ...(op ? ['Entregador'] : []), 'Alterado', 'Realizado', ''].map((t, i) => <th key={i}>{t}</th>)}</tr></thead><tbody>{lista.itens.map(p => { const minutos = Math.max(0, Math.floor(((p.dt_conc ? Date.parse(p.dt_conc) : agora) - Date.parse(p.dt_cad)) / 60000)); const encerrado = ['CONCLUIDO', 'CANCELADO'].includes(p.st_ped); return <tr key={p.id_ped}><td><button className="id-pedido" onClick={() => definirDetalhe(p)}>#{String(p.num_ped).padStart(5, '0')}</button><span className={`tempo ${encerrado ? '' : minutos >= 20 ? 'atrasado' : minutos >= 10 ? 'espera' : ''}`}><Clock3 size={11}/>{minutos} min</span></td><td><strong className="nome-dest">{p.nom_dest}</strong><small className="celula-detalhe">{p.tp_end === 'ORIGEM' ? <ArrowDownLeft size={12}/> : <ArrowUpRight size={12}/>} {p.tp_end === 'ORIGEM' ? 'Coleta no endereço' : 'Entrega no endereço'}{p.st_ret ? ' · Com retorno' : ''}</small></td><td>{p.bairro?.nom_bai}</td><td><span className="empresa-celula">{p.empresa?.nom_fan ?? 'Remetente'}</span></td><td><Indicador valor={p.st_ped}/></td>{op && <td><select className={`despacho ${p.id_ent ? '' : 'sem-entregador'}`} aria-label={`Entregador do pedido ${p.num_ped}`} value={p.id_ent ?? ''} disabled={!['PRONTO', 'ATRIBUIDO'].includes(p.st_ped) || despachando === p.id_ped || !online} onChange={e => despachar(p, e.target.value)}><option value="" disabled>Selecionar entregador</option>{p.id_ent && !entregadores.some(e => e.id_ent === p.id_ent) && <option value={p.id_ent} disabled>{p.entregador?.usuario.nom_usr ?? 'Entregador atribuído'} (caixa fechado)</option>}{entregadores.map(e => <option key={e.id_ent} value={e.id_ent}>{e.usuario.nom_usr}{!e.st_atv || !e.usuario.st_atv ? ' (inativo)' : ''}</option>)}</select>{p.id_ent && <small className="celula-detalhe">{p.st_ped === 'ATRIBUIDO' ? 'Aguardando aceite' : encerrado ? 'Corrida encerrada' : 'Entregador atribuído'}</small>}</td>}<td className="data-celula">{data(p.dt_alt)}</td><td className="data-celula">{data(p.dt_cad)}</td><td><button title="Ver detalhes" aria-label={`Detalhes do pedido ${p.num_ped}`} className="icone" onClick={() => definirDetalhe(p)}><Eye size={18}/></button></td></tr>; })}</tbody></table></div>}
    {!lista.itens.length && !carregando && !erro && <Vazio titulo={filtro === 'ATIVOS' ? 'Tudo em dia por aqui' : 'Nenhum pedido encontrado'} texto={filtro === 'ATIVOS' ? 'Novas chamadas aparecerão aqui assim que forem abertas.' : 'Tente outro filtro ou abra uma nova chamada.'}/>}
    {carregando && !lista.itens.length && <p className="carregando">Carregando entregas…</p>}
    <div className="tabela-rodape"><span>{lista.total ? `${(pagina - 1) * 20 + 1}–${Math.min(pagina * 20, lista.total)} de ${lista.total} pedidos` : '0 pedidos'}<i />20 por página</span><div><button className="icone" aria-label="Página anterior" disabled={pagina <= 1 || carregando} onClick={() => definirPagina(p => p - 1)}><ChevronLeft size={16}/></button><span>Página {pagina} de {lista.paginas}</span><button className="icone" aria-label="Próxima página" disabled={pagina >= lista.paginas || carregando} onClick={() => definirPagina(p => p + 1)}><ChevronRight size={16}/></button></div></div></section>
    <div className="nota-painel"><IconeConferencia /><p>As atualizações são sincronizadas automaticamente. Os tempos indicam o ciclo total de cada pedido.</p><span>Horário de Brasília</span></div>
    {novo && <NovoPedido fechar={() => definirNovo(false)} pronto={() => { definirNovo(false); definirFiltro('ATIVOS'); definirPagina(1); atualizar(); avisar('Chamada aberta com sucesso.'); }}/>}
    {detalhe && <DetalhePedido pedidoInicial={detalhe} usuario={usuario} revisao={revisao} atualizar={atualizar} avisar={avisar} socket={socket} fechar={() => definirDetalhe(null)}/>}
  </>;
}
function IconeConferencia() { return <CheckCheck size={16}/>; }
function NovoPedido({ fechar, pronto }) {
    const [bairros, definirBairros] = useState([]), [bairro, definirBairro] = useState(''), [retorno, definirRetorno] = useState(false);
    const [erro, definirErro] = useState(''), [ocupado, definirOcupado] = useState(false), [carregando, definirCarregando] = useState(true);
    const assinatura = useRef(null);
    const [pagamento, definirPagamento] = useState('PAGO');
    useEffect(() => { api('/bairros').then((b) => { definirBairros(b.filter(v => v.st_atv)); }).catch(e => definirErro(e.message)).finally(() => definirCarregando(false)); }, []);
    const b = bairros.find(b => b.id_bai === bairro);
    return <Modal titulo="Nova chamada" subtitulo="Informe os dados da coleta ou entrega." fechar={fechar} largo><Formulario ocupado={ocupado || carregando} impedido={!!b?.st_sob_consulta} erro={erro} rotulo="Abrir chamada" enviar={async (d) => {
            definirOcupado(true);
            definirErro('');
            try {
                const campos = { ...d };
                if (!campos.cmp_dest)
                    delete campos.cmp_dest;
                if (!campos.ref_dest)
                    delete campos.ref_dest;
                const resumo = JSON.stringify(d);
                if (assinatura.current?.resumo !== resumo)
                    assinatura.current = { resumo, chave: crypto.randomUUID() };
                const pedido = { ...campos, ...(campos.st_pag === 'A_RECEBER' ? { vlr_cobrar: Number(campos.vlr_cobrar).toFixed(2) } : {}), st_ret: campos.st_ret === 'true', chave_idem: assinatura.current.chave };
                await api('/pedidos', pedido);
                pronto();
            }
            catch (e) {
                definirErro(e.message);
            }
            finally {
                definirOcupado(false);
            }
        }}>
    <Campo titulo="Nome completo do destinatário" nome="nom_dest"/><Campo titulo="Telefone com DDD (somente números)" nome="tel_dest" tipo="tel" padrao="[+]?[0-9]{10,15}"/>
    <Selecao titulo="Bairro permitido" nome="id_bai" mudar={definirBairro}><option value="" disabled>{carregando ? 'Carregando bairros…' : 'Selecione um bairro'}</option>{bairros.map(b => <option key={b.id_bai} value={b.id_bai}>{b.nom_bai}{b.st_sob_consulta ? " — Sob consulta" : ""}</option>)}</Selecao><Campo titulo="Rua / Logradouro" nome="log_dest"/><Campo titulo="Número" nome="num_dest"/><Campo titulo="Complemento" nome="cmp_dest" obrigatorio={false}/><Campo titulo="Ponto de referência" nome="ref_dest" obrigatorio={false}/>
    <Selecao titulo="Tipo de endereço" nome="tp_end" valor="ENTREGA"><option value="ENTREGA">Entrega — da loja para o destinatário</option><option value="ORIGEM">Origem — do destinatário para a loja</option></Selecao><div className="campo"><span>Com Retorno?</span><input type="hidden" name="st_ret" value={String(retorno)}/><button type="button" role="switch" aria-label="Com Retorno?" aria-checked={retorno} className={`usuario-switch ${retorno ? "ligado" : "desligado"}`} onClick={() => definirRetorno(v => !v)}><span /></button></div>
    <Selecao titulo="Pagamento" nome="st_pag" valor="PAGO" mudar={definirPagamento}><option value="PAGO">Pago na loja</option><option value="A_RECEBER">A receber no local</option></Selecao><>{pagamento === 'A_RECEBER' && <><Selecao titulo="Forma de pagamento" nome="tp_pag_prev"><option value="" disabled>Selecione</option><option value="DINHEIRO">Dinheiro</option><option value="PIX_LOJA">PIX para a loja</option><option value="CARTAO_LOJA">Cartão para a loja</option><option value="ONLINE_LOJA">Pagamento online para a loja</option></Selecao><Campo titulo="Total a recolher, incluindo entrega (R$)" nome="vlr_cobrar" tipo="number" passo="0.01" min={String(b ? Number(b.vlr_tx_ent) * (retorno ? 2 : 1) : 0)}/><div className="aviso">A taxa abaixo já está incluída no total informado. Ela não será somada novamente.</div></>}</>
    <div className="orcamento"><Bike size={20}/><div><strong>Taxa de entrega</strong><small>{retorno ? 'Com retorno: duas vezes a taxa normal.' : 'Taxa calculada pelo bairro selecionado.'}</small></div><strong>{b?.st_sob_consulta ? 'Sob consulta — contate a administração' : b ? reais(Number(b.vlr_tx_ent) * (retorno ? 2 : 1)) : 'Selecione o bairro'}</strong></div>
    {!carregando && !bairros.length && <p className="aviso erro">Cadastre um bairro ativo antes de abrir chamados.</p>}
  </Formulario></Modal>;
}
