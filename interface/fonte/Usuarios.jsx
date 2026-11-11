import { useEffect, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Pencil, Plus, RefreshCw, Search, Users, X } from 'lucide-react';
import { api } from './api';
import { Campo, Formulario, Modal, Selecao, Vazio } from './componentes';
import { CadastroForm } from './Cadastros';
const perfis = ['ADMINISTRADOR', 'EMPRESAS', 'ENTREGADORES', 'CLIENTES'];
export function Usuarios({ usuario, avisar, revisao, atualizar }) {
    const [perfil, definirPerfil] = useState('ADMINISTRADOR'), [busca, definirBusca] = useState(''), [termo, definirTermo] = useState(''), [pagina, definirPagina] = useState(1);
    const [lista, definirLista] = useState({ itens: [], total: 0, paginas: 1 }), [carregando, definirCarregando] = useState(true), [erro, definirErro] = useState('');
    const [novo, definirNovo] = useState(false), [editar, definirEditar] = useState(null), [ocupado, definirOcupado] = useState(null);
    useEffect(() => { const t = setTimeout(() => { definirTermo(busca.trim()); definirPagina(1); }, 300); return () => clearTimeout(t); }, [busca]);
    useEffect(() => { let ativo = true; definirCarregando(true); api('/usuarios?' + new URLSearchParams({ perfil, busca: termo, pagina: String(pagina) })).then(d => { if (ativo) {
        definirLista(d);
        definirErro('');
        if (pagina > d.paginas)
            definirPagina(d.paginas);
    } }).catch(e => { if (ativo) {
        definirErro(e.message);
        definirLista({ itens: [], total: 0, paginas: 1 });
    } }).finally(() => { if (ativo)
        definirCarregando(false); }); return () => { ativo = false; }; }, [perfil, termo, pagina, revisao]);
    const permitido = (u) => usuario.tp_usr === 'ADMINISTRADOR' || !['ADMINISTRADOR', 'OPERADOR'].includes(u.tp_usr);
    async function alternar(u) { definirOcupado(u.id_usr); try {
        await api('/usuarios/' + u.id_usr, { st_atv: !u.st_atv }, 'PATCH');
        definirLista(l => ({ ...l, itens: l.itens.map(r => r.id_usr === u.id_usr ? { ...r, st_atv: !u.st_atv } : r) }));
        atualizar();
        avisar(u.st_atv ? 'Acesso desativado. Sessões encerradas.' : 'Acesso ativado.');
    }
    catch (e) {
        avisar(e.message, true);
    }
    finally {
        definirOcupado(null);
    } }
    return <><div className="pagina-titulo"><div><span className="sobretitulo">GESTÃO DE ACESSOS</span><h1 className="usuarios-titulo"><Users size={28}/>Usuários</h1><p>Gerencie os acessos da sua operação.</p></div><div className="acoes"><button className="btn primario" onClick={() => definirNovo(true)}><Plus size={18}/>Novo Usuário</button><button className="btn" aria-label="Atualizar usuários" title="Atualizar listagem" disabled={carregando} onClick={atualizar}><RefreshCw size={18}/></button></div></div>
    <section className="cartao"><div className="abas usuarios-abas" role="tablist" aria-label="Perfis de usuário">{perfis.map(p => <button key={p} role="tab" aria-selected={perfil === p} aria-controls="usuarios-lista" className={perfil === p ? 'ativa' : ''} onClick={() => { definirPerfil(p); definirPagina(1); definirLista({ itens: [], total: 0, paginas: 1 }); }}>{p}</button>)}</div>
      <form className="usuarios-busca" role="search" onSubmit={e => { e.preventDefault(); definirTermo(busca.trim()); definirPagina(1); atualizar(); }}><label className="pesquisa"><Search size={18}/><input aria-label="Pesquisar usuários por nome ou email" placeholder="Pesquisar usuários por nome ou email..." value={busca} onChange={e => definirBusca(e.target.value)}/></label><button className="btn primario" type="submit"><Search size={16}/>BUSCAR</button></form>
      {erro && <p role="alert" className="aviso erro">{erro}</p>}
      <div id="usuarios-lista" role="tabpanel" aria-label={perfil} aria-busy={carregando}><div className="tabela-scroll"><table><thead><tr>{['NOME', 'EMAIL', 'ATIVO', 'AÇÕES'].map(c => <th key={c}>{c}</th>)}</tr></thead><tbody>{lista.itens.map(u => <tr key={u.id_usr}><td><strong>{u.nom_usr}</strong>{u.id_usr === usuario.id_usr && <small className="celula-detalhe">Seu acesso</small>}</td><td>{u.eml_usr}</td><td><span className={`badge ${u.st_atv ? 'verde' : 'vermelho'}`}><i />{u.st_atv ? 'ATIVO' : 'INATIVO'}</span></td><td><div className="acoes"><button role="switch" aria-checked={!!u.st_atv} aria-label={`${u.st_atv ? 'Desativar' : 'Ativar'} usuário ${u.nom_usr}`} title={u.id_usr === usuario.id_usr ? 'Você não pode desativar seu próprio acesso' : u.st_atv ? 'Desativar acesso' : 'Ativar acesso'} disabled={!permitido(u) || u.id_usr === usuario.id_usr || ocupado !== null} className={`usuario-switch ${u.st_atv ? 'ligado' : 'desligado'}`} onClick={() => alternar(u)}><span>{u.st_atv ? <Check size={13}/> : <X size={13}/>}</span></button><button className="icone" aria-label={`Editar usuário ${u.nom_usr}`} title="Editar usuário" disabled={!permitido(u)} onClick={() => definirEditar(u)}><Pencil size={17}/></button></div></td></tr>)}</tbody></table></div>
      {!lista.itens.length && !carregando && !erro && <Vazio titulo="Nenhum usuário encontrado" texto="Experimente outro nome, e-mail ou perfil."/>}{carregando && !lista.itens.length && <p className="carregando">Carregando usuários…</p>}
      <div className="tabela-rodape"><span>{lista.total} usuários · 25 por página</span><div><button className="icone" aria-label="Página anterior de usuários" disabled={pagina === 1 || carregando} onClick={() => definirPagina(p => p - 1)}><ChevronLeft size={16}/></button><span>Página {pagina} de {lista.paginas}</span><button className="icone" aria-label="Próxima página de usuários" disabled={pagina >= lista.paginas || carregando} onClick={() => definirPagina(p => p + 1)}><ChevronRight size={16}/></button></div></div></div>
    </section>
    {editar && <DadosUsuario registro={editar} fechar={() => definirEditar(null)} pronto={() => { definirEditar(null); atualizar(); avisar('Dados do usuário atualizados.'); }}/>}
    {novo && <NovoUsuario perfilInicial={perfil} usuario={usuario} fechar={() => definirNovo(false)} pronto={p => { definirNovo(false); definirPerfil(p); definirBusca(''); definirTermo(''); definirPagina(1); atualizar(); avisar('Usuário cadastrado.'); }}/>}
  </>;
}
function DadosUsuario({ registro, fechar, pronto, perfil = 'CLIENTES' }) {
    const [erro, definirErro] = useState(''), [ocupado, definirOcupado] = useState(false);
    return <Modal titulo={registro ? 'Editar usuário' : 'Novo Usuário'} subtitulo={registro ? 'Atualize os dados de acesso.' : 'Defina os dados de acesso do usuário.'} fechar={fechar}><Formulario erro={erro} ocupado={ocupado} rotulo={registro ? 'Salvar alterações' : 'Cadastrar usuário'} enviar={async (d) => { definirOcupado(true); definirErro(''); try {
        if (!d.senha)
            delete d.senha;
        await api(registro ? '/usuarios/' + registro.id_usr : '/usuarios', { ...d, ...(!registro ? { tp_usr: perfil === 'ADMINISTRADOR' ? 'ADMINISTRADOR' : 'REMETENTE' } : {}) }, registro ? 'PATCH' : 'POST');
        pronto();
    }
    catch (e) {
        definirErro(e.message);
    }
    finally {
        definirOcupado(false);
    } }}><Campo titulo="Nome completo" nome="nom_usr" valor={registro?.nom_usr}/><Campo titulo="E-mail de acesso" nome="eml_usr" tipo="email" valor={registro?.eml_usr}/><Campo titulo={registro ? 'Nova senha (opcional, mínimo 16 caracteres)' : 'Senha inicial (mínimo 16 caracteres)'} nome="senha" tipo="password" obrigatorio={!registro} padrao=".{16,100}"/>{registro && <p className="aviso">Deixe a senha vazia para mantê-la. Ao alterar a senha, as sessões existentes serão encerradas.</p>}</Formulario></Modal>;
}
function NovoUsuario({ perfilInicial, usuario, fechar, pronto }) {
    const [perfil, definirPerfil] = useState(perfilInicial === 'ADMINISTRADOR' && usuario.tp_usr !== 'ADMINISTRADOR' ? 'CLIENTES' : perfilInicial), [continuar, definirContinuar] = useState(false);
    if (!continuar)
        return <Modal titulo="Novo Usuário" subtitulo="Selecione o perfil para cadastrar o acesso." fechar={fechar}><Selecao titulo="Perfil" nome="perfil" valor={perfil} mudar={v => definirPerfil(v)}>{perfis.filter(p => p !== 'ADMINISTRADOR' || usuario.tp_usr === 'ADMINISTRADOR').map(p => <option key={p} value={p}>{p}</option>)}</Selecao><div className="form-rodape"><button className="btn primario" onClick={() => definirContinuar(true)}>Continuar</button></div></Modal>;
    if (perfil === 'EMPRESAS' || perfil === 'ENTREGADORES')
        return <CadastroForm pagina={perfil === 'EMPRESAS' ? 'empresas' : 'entregadores'} usuario={usuario} fechar={fechar} pronto={() => pronto(perfil)}/>;
    return <DadosUsuario perfil={perfil} fechar={fechar} pronto={() => pronto(perfil)}/>;
}
