import { useEffect, useState } from 'react';
import { Bike, Check, ExternalLink, History, MapPin, Navigation, Pencil, Phone, Radio, ReceiptText } from 'lucide-react';
import { api, data, eOperador, reais, status } from './api';
import { Indicador, Campo, Formulario, Modal, Selecao } from './componentes';
const avancos = { ATRIBUIDO: ['Aceitar', 'ACEITO'], ACEITO: ['Recolhido', 'EM_ENTREGA'], EM_COLETA: ['Recolhido', 'EM_ENTREGA'], NO_LOCAL: ['Recolhido', 'EM_ENTREGA'], EM_ENTREGA: ['Finalizar Entrega', 'CONCLUIDO'], EM_RETORNO: ['Finalizar Entrega', 'CONCLUIDO'] };
export function DetalhePedido({ pedidoInicial, usuario, revisao, atualizar, avisar, socket, fechar }) {
    const [p, definirP] = useState(pedidoInicial), [historico, definirHistorico] = useState([]), [posicao, definirPosicao] = useState(null);
    const [erro, definirErro] = useState(''), [edicao, definirEdicao] = useState(false), [mudanca, definirMudanca] = useState(null), [ocupado, definirOcupado] = useState(false), [gps, definirGps] = useState(false), [mapa, definirMapa] = useState(false);
    const [agora, definirAgora] = useState(Date.now());
    const op = eOperador(usuario), encerrado = ['CONCLUIDO', 'CANCELADO'].includes(p.st_ped);
    useEffect(() => { let ativo = true; Promise.all([api(`/pedidos/${p.id_ped}`), op ? api(`/pedidos/${p.id_ped}/historico`) : Promise.resolve([]), api(`/pedidos/${p.id_ped}/gps`)]).then(([pedido, h, g]) => { if (ativo) {
        definirP(pedido);
        definirHistorico(h);
        definirPosicao(g);
        definirErro('');
    } }).catch(e => { if (ativo)
        definirErro(e.message); }); return () => { ativo = false; }; }, [p.id_ped, revisao, op]);
    useEffect(() => { const t = setInterval(() => definirAgora(Date.now()), 10000); const handler = (d) => { if (d.id_ped === p.id_ped) {
        definirPosicao(d);
        definirAgora(Date.now());
    } }; socket?.on('gps:posicao', handler); return () => { clearInterval(t); socket?.off('gps:posicao', handler); }; }, [socket, p.id_ped]);
    useEffect(() => {
        if (!gps || encerrado || usuario.tp_usr !== 'ENTREGADOR')
            return;
        if (!navigator.geolocation) {
            avisar('Este navegador não oferece localização.', true);
            definirGps(false);
            return;
        }
        let ultimoEnvio = 0;
        const observar = navigator.geolocation.watchPosition(async (local) => {
            if (Date.now() - ultimoEnvio < 10000)
                return;
            ultimoEnvio = Date.now();
            try {
                await api('/gps', { id_ped: p.id_ped, lat: local.coords.latitude, lng: local.coords.longitude, dt: new Date(local.timestamp).toISOString() });
            }
            catch (e) {
                avisar(e.message, true);
            }
        }, e => { avisar(e.code === 1 ? 'Permita o acesso à localização no navegador.' : 'Não foi possível obter sua localização.', true); definirGps(false); }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 });
        return () => navigator.geolocation.clearWatch(observar);
    }, [gps, encerrado, usuario.tp_usr, p.id_ped, avisar]);
    const proxima = avancos[p.st_ped];
    const enderecoDest = `${p.log_dest}, ${p.num_dest} · ${p.bairro?.nom_bai ?? ''}`;
    const enderecoLoja = `${p.end_loja.logradouro}, ${p.end_loja.numero} · ${p.end_loja.bairro}, ${p.end_loja.cidade} - ${p.end_loja.uf}`;
    const recente = posicao && !encerrado && agora - Date.parse(posicao.dt) <= 120000;
    return <Modal titulo={`Pedido #${String(p.num_ped).padStart(5, '0')}`} subtitulo={`Criado em ${data(p.dt_cad)} · ${p.empresa?.nom_fan ?? 'Remetente'}`} fechar={fechar} largo>
    <div className="detalhe-status"><Indicador valor={p.st_ped}/><Indicador valor={p.st_ped === 'CONCLUIDO' && p.st_pag === 'A_RECEBER' ? 'RECEBIDO' : p.st_pag}/>{p.st_ret && <span className="etiqueta-neutra">Com retorno</span>}{op && !encerrado && <button className="btn" onClick={() => definirEdicao(true)}><Pencil size={14}/>Editar pedido</button>}</div>
    {erro && <p className="aviso erro" role="alert">{erro}</p>}
    <div className="trajeto"><div><span className="bolinha origem"/><small>COLETA</small><strong>{p.tp_end === 'ORIGEM' ? p.nom_dest : p.empresa?.nom_fan ?? 'Estabelecimento'}</strong><p>{p.tp_end === 'ORIGEM' ? enderecoDest : enderecoLoja}</p></div><div><span className="bolinha destino"/><small>ENTREGA</small><strong>{p.tp_end === 'ORIGEM' ? p.empresa?.nom_fan : p.nom_dest}</strong><p>{p.tp_end === 'ORIGEM' ? enderecoLoja : enderecoDest}</p></div></div>
    <div className="detalhe-grid"><div className="info-bloco"><Phone size={16}/><div><small>Contato do destinatário</small><a href={`tel:${p.tel_dest}`}>{p.tel_dest}</a></div></div><div className="info-bloco"><Bike size={17}/><div><small>Entregador responsável</small><strong>{p.entregador?.usuario.nom_usr ?? 'Aguardando despacho'}</strong></div></div>{p.cmp_dest && <div className="info-bloco"><MapPin size={16}/><div><small>Complemento</small><strong>{p.cmp_dest}</strong></div></div>}{p.ref_dest && <div className="info-bloco"><Navigation size={16}/><div><small>Referência</small><strong>{p.ref_dest}</strong></div></div>}</div>
    <div className="financeiro-pedido"><h3><ReceiptText size={17}/>Valores do pedido</h3><div><span>Taxa de entrega<strong>{reais(p.vlr_tx)}</strong></span>{usuario.tp_usr === 'ENTREGADOR' && <span>Ganho do entregador<strong>{reais(p.vlr_ganho_ent)}</strong></span>}{p.st_pag === 'A_RECEBER' && <><span>Forma de pagamento<strong>{{ DINHEIRO: 'Dinheiro', PIX_LOJA: 'PIX para a loja', CARTAO_LOJA: 'Cartão para a loja', ONLINE_LOJA: 'Pagamento online para a loja' }[p.tp_pag_prev ?? ''] ?? 'Não informada'}</strong></span><span className={p.st_pag === 'A_RECEBER' ? p.st_ped === 'CONCLUIDO' ? 'recebido' : 'cobrar' : ''}>{p.st_ped === 'CONCLUIDO' ? 'Recebido na entrega' : 'Cobrar no local'}<strong>{reais(p.vlr_cobrar)}</strong></span></>}</div></div>
    {!encerrado && <section className="rastreio"><div><Radio size={18}/><div><strong>{recente ? 'Localização do entregador disponível' : 'Aguardando localização do entregador'}</strong><small>{recente && posicao ? `Última posição: ${data(posicao.dt)}` : 'A posição aparece durante a corrida e expira após 2 minutos.'}</small></div></div>{recente && posicao && <><button className="btn" onClick={() => definirMapa(v => !v)}>{mapa ? 'Ocultar mapa' : 'Ver no mapa'}<ExternalLink size={14}/></button>{mapa && <iframe title="Localização do entregador" className="mapa" src={`https://www.openstreetmap.org/export/embed.html?bbox=${posicao.lng - .008},${posicao.lat - .005},${posicao.lng + .008},${posicao.lat + .005}&layer=mapnik&marker=${posicao.lat},${posicao.lng}`} loading="lazy" referrerPolicy="no-referrer"/>}</>}{usuario.tp_usr === 'ENTREGADOR' && p.st_ped !== 'ATRIBUIDO' && <button className="btn" onClick={() => definirGps(v => !v)}>{gps ? 'Parar compartilhamento' : 'Compartilhar minha localização'}</button>}{gps && <small>A localização é compartilhada enquanto este detalhe estiver aberto.</small>}</section>}
    {op && <section className="historico"><h3><History size={17}/>Histórico do pedido</h3>{historico.map(l => <div className="historico-item" key={l.id_log}><i /><div><strong>{l.acao === 'CRIACAO' ? 'Chamada criada' : l.acao === 'DESPACHO' ? 'Entregador atribuído' : l.acao === 'EDICAO_ADMINISTRATIVA' ? 'Pedido editado pela operação' : `Status alterado para ${status[String(l.dados_nov.st_ped)] ?? String(l.dados_nov.st_ped)}`}</strong><small>{data(l.dt_cad)}</small><details><summary>Ver dados da alteração</summary><pre>{JSON.stringify({ anterior: l.dados_ant, novo: l.dados_nov }, null, 2)}</pre></details></div></div>)}</section>}
    {!encerrado && (op || usuario.tp_usr === 'ENTREGADOR') && <div className="detalhe-acoes">{op && ['PRONTO', 'ATRIBUIDO', 'ACEITO', 'EM_COLETA', 'NO_LOCAL'].includes(p.st_ped) && <button className="btn perigo" onClick={() => definirMudanca('CANCELADO')}>Cancelar pedido</button>}{proxima && <button className="btn primario grande" onClick={() => definirMudanca(proxima[1])}><Check size={18}/>{proxima[0]}</button>}</div>}
    {edicao && <EditarPedido p={p} administrador={usuario.tp_usr === 'ADMINISTRADOR'} fechar={() => definirEdicao(false)} pronto={() => { definirEdicao(false); atualizar(); avisar('Pedido atualizado e alteração registrada.'); }}/>}
    {mudanca && <Modal titulo={mudanca === 'CANCELADO' ? 'Cancelar este pedido?' : status[mudanca]} subtitulo={mudanca === 'CANCELADO' ? 'O cancelamento será registrado no histórico.' : 'Confirme a próxima etapa da corrida.'} fechar={() => definirMudanca(null)}><Formulario ocupado={ocupado} erro={erro} rotulo={mudanca === 'CANCELADO' ? 'Confirmar cancelamento' : 'Confirmar etapa'} enviar={async (d) => { definirOcupado(true); definirErro(''); try {
        const atualizado = await api('/pedidos/status', { id_ped: p.id_ped, versao: p.versao, st_ped: mudanca, ...(d.tp_rec ? { tp_rec: d.tp_rec } : {}) });
        definirP(anterior => ({ ...anterior, ...atualizado }));
        definirMudanca(null);
        atualizar();
        avisar('Status atualizado com sucesso.');
    }
    catch (e) {
        definirErro(e.message);
        atualizar();
    }
    finally {
        definirOcupado(false);
    } }}>{mudanca === 'CONCLUIDO' && p.st_ret && <p className="aviso">Confirme que a entrega e o retorno foram realizados antes de finalizar.</p>}{mudanca === 'CONCLUIDO' && p.st_pag === 'A_RECEBER' ? <><div className="aviso">Confirme o recebimento de <strong>{reais(p.vlr_cobrar)}</strong> antes de concluir.</div><Selecao titulo="Como foi recebido?" nome="tp_rec" valor={p.tp_pag_prev ?? ''}><option value="" disabled>Selecione a forma de recebimento</option><option value="DINHEIRO">Dinheiro com o entregador</option><option value="PIX_LOJA">PIX direto para a loja</option><option value="CARTAO_LOJA">Cartão direto para a loja</option><option value="ONLINE_LOJA">Pagamento online direto para a loja</option></Selecao></> : <p className="form-linha">Pedido #{p.num_ped} · {p.nom_dest}</p>}</Formulario></Modal>}
  </Modal>;
}
function EditarPedido({ p, administrador, fechar, pronto }) {
    const [bairros, definirBairros] = useState([]), [erro, definirErro] = useState(''), [ocupado, definirOcupado] = useState(false);
    useEffect(() => { api('/bairros').then(definirBairros).catch(e => definirErro(e.message)); }, []);
    return <Modal titulo="Editar pedido" subtitulo="Alterações ficam registradas com seu usuário e motivo." fechar={fechar} largo><Formulario ocupado={ocupado} erro={erro} rotulo="Salvar alterações" enviar={async (d) => { definirOcupado(true); definirErro(''); try {
        await api(`/pedidos/${p.id_ped}`, { ...d, versao: p.versao }, 'PATCH');
        pronto();
    }
    catch (e) {
        definirErro(e.message);
    }
    finally {
        definirOcupado(false);
    } }}><Campo titulo="Destinatário" nome="nom_dest" valor={p.nom_dest}/><Campo titulo="Telefone" nome="tel_dest" valor={p.tel_dest}/><Campo titulo="Rua" nome="log_dest" valor={p.log_dest}/><Campo titulo="Número" nome="num_dest" valor={p.num_dest}/><Campo titulo="Complemento" nome="cmp_dest" valor={p.cmp_dest ?? ''} obrigatorio={false}/><Campo titulo="Referência" nome="ref_dest" valor={p.ref_dest ?? ''} obrigatorio={false}/><Selecao titulo="Bairro" nome="id_bai" valor={p.id_bai}>{bairros.filter(b => b.st_atv || b.id_bai === p.id_bai).map(b => <option key={b.id_bai} value={b.id_bai}>{b.nom_bai}</option>)}</Selecao>{administrador && <>{p.st_pag === 'A_RECEBER' && <Campo titulo="Total a recolher, incluindo entrega" nome="vlr_cobrar" tipo="number" passo="0.01" min="0" valor={p.vlr_cobrar}/>}<Campo titulo="Taxa de entrega" nome="vlr_tx" tipo="number" passo="0.01" min="0" valor={p.vlr_tx}/><Campo titulo="Ganho do entregador" nome="vlr_ganho_ent" tipo="number" passo="0.01" min="0" valor={p.vlr_ganho_ent}/></>}<Campo titulo="Motivo da alteração (mínimo 10 caracteres)" nome="motivo"/><div className="aviso">Ao trocar o bairro, confira também a taxa e o ganho do entregador.</div></Formulario></Modal>;
}
