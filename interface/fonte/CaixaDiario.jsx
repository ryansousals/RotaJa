import { useEffect, useState } from 'react';
import { api, data, reais, eOperador } from './api';
import { Modal, Campo, Selecao, Formulario } from './componentes';
const nomes = { dinheiro: 'Dinheiro', cartao: 'Cartão', pix: 'Pix', online: 'Pagamento online' };
const cents = (v) => Math.round(Number(v || 0) * 100);
function horarioAtualFortaleza() {
    const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    const valor = (tipo) => partes.find(p => p.type === tipo).value;
    return `${valor('year')}-${valor('month')}-${valor('day')}T${valor('hour')}:${valor('minute')}:${valor('second')}`;
}
export function Abrir({ usuario, fechar, pronto }) {
    const [inicio] = useState(horarioAtualFortaleza);
    const [ent, definirEnt] = useState([]), [erro, definirErro] = useState(''), [ocupado, definirOcupado] = useState(false);
    useEffect(() => { if (eOperador(usuario))
        api('/entregadores').then(definirEnt).catch(e => definirErro(e.message)); }, [usuario]);
    return <Modal titulo="Abertura de caixa" fechar={fechar}><Formulario erro={erro} ocupado={ocupado} rotulo="Salvar abertura" enviar={async (d) => { definirOcupado(true); try {
        await api('/caixa-diario/abrir', { ...d, id_ent: eOperador(usuario) ? d.id_ent : usuario.entregador?.id_ent, dt_ab: new Date(d.dt_ab + '-03:00').toISOString() });
        pronto();
    }
    catch (e) {
        definirErro(e.message);
    }
    finally {
        definirOcupado(false);
    } }}>{eOperador(usuario) ? <Selecao titulo="Entregador" nome="id_ent"><option value="" disabled>Selecione</option>{ent.filter(e => e.st_atv).map(e => <option key={e.id_ent} value={e.id_ent}>{e.usuario.nom_usr}</option>)}</Selecao> : <p>{usuario.nom_usr}</p>}<Campo titulo="Início (horário de Fortaleza)" nome="dt_ab" tipo="datetime-local" passo="1" valor={inicio}/><Campo titulo="Valor da abertura" nome="vlr_ab" tipo="number" passo="0.01" min="0" valor="0"/><Campo titulo="Observações da abertura" nome="obs_ab" obrigatorio={false}/></Formulario></Modal>;
}
export function Resumo({ c, ganho }) { return <div className="totais-caixa">{[['Total no sistema', c.total_sistema], ['Total informado', c.total_informado], ['Fechamento parcial', c.parcial], ['Valor da abertura', c.abertura], ['Total em entregas (ganhos)', ganho], ['Total esperado', c.total_esperado], ['Diferença de caixa', c.diferenca]].map(([n, v]) => <div key={n}><small>{n}</small><strong className={n === 'Diferença de caixa' && Number(v) < 0 ? 'valor-negativo' : ''}>{reais(v)}</strong></div>)}</div>; }
export function Fechar({ previa: p, sair, pronto }) {
    const [informado, definirInformado] = useState({ dinheiro: '0', cartao: '0', pix: '0', online: '0' }), [parcial] = useState(p.total_parcial ?? '0'), [outros, definirOutros] = useState('0'), [pos, definirPos] = useState('0'), [obs, definirObs] = useState(''), [erro, definirErro] = useState(''), [ocupado, definirOcupado] = useState(false);
    const ts = Object.values(p.sistema).reduce((s, v) => s + cents(v), 0), ti = Object.values(informado).reduce((s, v) => s + cents(v), 0), esperado = ts + cents(p.ab.vlr_ab) + cents(p.troco) + cents(outros) + cents(pos) - cents(parcial);
    return <Modal largo titulo="Fechamento diário" subtitulo={p.ab.entregador.usuario.nom_usr} fechar={() => { if (!ocupado)
        sair(); }}><form onSubmit={async (e) => { e.preventDefault(); definirOcupado(true); definirErro(''); try {
        await api(`/caixa-diario/${p.ab.id_ab}/fechar`, { dt_fim: p.dt_fim, informado, parcial, outros, pos_meia_noite: pos, observacoes: obs });
        pronto();
    }
    catch (e) {
        definirErro(e.message);
    }
    finally {
        definirOcupado(false);
    } }}>
 <p>Conferência de {data(p.ab.dt_ab)} até {data(p.dt_fim)} · {p.resumo.qtd_peds} entregas</p><div className="conferencia-grid">{Object.keys(nomes).map(k => <section className={'conferencia-forma ' + k} key={k}><h3>{nomes[k]}</h3><div><label className="campo"><span>No sistema</span><input readOnly value={reais(p.sistema[k])}/></label><label className="campo"><span>{nomes[k]} informado</span><input type="number" min="0" step="0.01" required value={informado[k]} onChange={e => definirInformado({ ...informado, [k]: e.target.value })}/></label></div></section>)}<label className="campo"><span>Outros (ajuste do esperado)</span><input type="number" step="0.01" required value={outros} onChange={e => definirOutros(e.target.value)}/></label><label className="campo"><span>Pós meia-noite (ajuste do esperado)</span><input type="number" step="0.01" required value={pos} onChange={e => definirPos(e.target.value)}/></label><label className="campo"><span>Fechamento parcial registrado</span><input readOnly value={reais(parcial)}/></label></div>
 <label className="campo"><span>Observações</span><textarea rows={3} maxLength={4000} value={obs} onChange={e => definirObs(e.target.value)} placeholder="Justifique diferenças, retiradas e ajustes de turno."/></label><h3>Totais registrados</h3><Resumo c={{ total_sistema: (ts / 100).toFixed(2), total_informado: (ti / 100).toFixed(2), parcial, abertura: ((cents(p.ab.vlr_ab) + cents(p.troco)) / 100).toFixed(2), total_esperado: (esperado / 100).toFixed(2), diferenca: ((ti - esperado) / 100).toFixed(2) }} ganho={p.resumo.vlr_tot_ganho}/><p className="nota-relatorio">Esperado = sistema + fundo inicial + saldo de troco + outros + pós meia-noite − parcial. A abertura exibida inclui o saldo de troco. Parciais são os lançamentos previamente registrados. Ganhos são apresentados separadamente; não são descontados desta conferência. Recebimentos digitais são diretos à loja. Ajustes não alteram os valores das entregas nem os repasses.</p>{erro && <p className="aviso erro" role="alert">{erro}</p>}<div className="form-rodape"><button className="btn" type="button" onClick={sair} disabled={ocupado}>Sair</button><button className="btn primario" disabled={ocupado}>{ocupado ? 'Salvando…' : 'Salvar fechamento'}</button></div></form></Modal>;
}
