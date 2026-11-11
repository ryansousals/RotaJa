import { Usuarios } from './Usuarios';
import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { ArrowUpRight, Bike, Building2, ChevronRight, CircleHelp, LayoutDashboard, LogOut, MapPinned, Menu, Package, ShieldCheck, Users, Wallet, X, Zap } from 'lucide-react';
import { api, eOperador } from './api';
import { Pedidos } from './Pedidos';
import { Cadastros } from './Cadastros';
import { PortalEmpresa, TarifasConsulta, MinhaEmpresa } from './PortalEmpresa';
import { ControleSistema } from './ControleSistema';
import { Relatorios } from './Relatorios';
import { CaixaDiario } from './CaixaRegistro';
import { Financeiro } from './Financeiro';
const nomes = { relatorios: 'Relatórios', caixa: 'Caixa diário', resumo: 'Resumo da loja', tarifas: 'Minhas tarifas', conta: 'Minha empresa', 'nova-chamada': 'Nova chamada', entregas: 'Central de entregas', empresas: 'Empresas parceiras', entregadores: 'Entregadores', bairros: 'Bairros e tarifas', usuarios: 'Usuários', financeiro: 'Financeiro', ajuda: 'Ajuda e operação' };
export function Aplicacao() {
    const [usuario, definirUsuario] = useState(null), [carregando, definirCarregando] = useState(true);
    const [pagina, definirPagina] = useState(location.hash.slice(1)), [menu, definirMenu] = useState(false);
    const [versao, definirVersao] = useState(0), [socket, definirSocket] = useState(null), [online, definirOnline] = useState(false);
    const [saindo, definirSaindo] = useState(false);
    async function sair() {
        definirSaindo(true);
        try {
            await api('/autenticacao/sair', {});
            socket?.disconnect();
            definirUsuario(null);
            definirMenu(false);
            definirAviso(null);
            history.replaceState(null, '', location.pathname);
        }
        catch (e) {
            avisar(e.message, true);
        }
        finally {
            definirSaindo(false);
        }
    }
    const [aviso, definirAviso] = useState(null);
    const avisar = useCallback((texto, erro = false) => definirAviso({ texto, erro }), []);
    const agendado = useRef(undefined);
    const atualizar = useCallback(() => { clearTimeout(agendado.current); agendado.current = setTimeout(() => definirVersao(v => v + 1), 180); }, []);
    useEffect(() => () => clearTimeout(agendado.current), []);
    useEffect(() => { api('/autenticacao/eu').then(definirUsuario).catch(() => { }).finally(() => definirCarregando(false)); }, []);
    useEffect(() => { const bloquear = (e) => { definirUsuario(null); avisar(e.detail, true); }; window.addEventListener('acesso-bloqueado', bloquear); return () => window.removeEventListener('acesso-bloqueado', bloquear); }, [avisar]);
    useEffect(() => { const expirar = () => { definirUsuario(null); avisar('Sua sessão terminou. Entre novamente.', true); }; window.addEventListener('sessao-expirada', expirar); return () => window.removeEventListener('sessao-expirada', expirar); }, [avisar]);
    useEffect(() => { const h = () => definirPagina(location.hash.slice(1) || 'entregas'); window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h); }, []);
    useEffect(() => { if (!aviso)
        return; const t = setTimeout(() => definirAviso(null), 6000); return () => clearTimeout(t); }, [aviso]);
    useEffect(() => {
        if (!usuario)
            return;
        const s = io({ transports: ['websocket'], withCredentials: true });
        definirSocket(s);
        s.on('connect', () => { definirOnline(true); atualizar(); });
        s.on('disconnect', () => definirOnline(false));
        s.on('acesso:bloqueado', (d) => { definirUsuario(null); avisar(d.mensagem, true); });
        s.on('connect_error', () => definirOnline(false));
        s.on('pedido:atualizado', atualizar);
        s.on('chamado:atribuido', () => { atualizar(); avisar('Você recebeu uma nova corrida.'); });
        const consultar = setInterval(atualizar, 30000); // Reconsulta de segurança se uma notificação se perder.
        return () => { clearInterval(consultar); s.disconnect(); definirSocket(null); definirOnline(false); };
    }, [usuario, atualizar, avisar]);
    if (carregando)
        return <div className="iniciando"><Marca /><p>Conectando à sua operação…</p></div>;
    if (!usuario)
        return <><Acesso entrar={u => { definirUsuario(u); location.hash = u.tp_usr === 'REMETENTE' ? 'resumo' : 'entregas'; }}/>{aviso && <div role="alert" className="toast erro">{aviso.texto}</div>}</>;
    const operacao = eOperador(usuario);
    const nav = operacao ? [['entregas', LayoutDashboard], ['empresas', Building2], ['entregadores', Bike], ['bairros', MapPinned], ['financeiro', Wallet], ['relatorios', Package], ['caixa', Wallet], ['usuarios', Users]] : usuario.tp_usr === 'REMETENTE' ? [['resumo', LayoutDashboard], ['entregas', Package], ['financeiro', Wallet], ['relatorios', Package], ['tarifas', MapPinned], ['conta', Building2]] : [['entregas', Package], ['financeiro', Wallet], ['relatorios', Package], ['caixa', Wallet]];
    const atual = nav.some(([p]) => p === pagina) || pagina === 'ajuda' || pagina === 'nova-chamada' && usuario.tp_usr === 'REMETENTE' ? pagina : usuario.tp_usr === 'REMETENTE' ? 'resumo' : 'entregas';
    return <div className="aplicacao-shell">
    {menu && <button aria-label="Fechar navegação" className="cortina" onClick={() => definirMenu(false)}/>}
    <aside className={`sidebar ${menu ? 'aberto' : ''}`}><a href="#entregas" className="marca-link"><Marca /></a><div className="area-rotulo">{operacao ? 'WORKSPACE · OPERAÇÃO' : usuario.tp_usr === 'REMETENTE' ? 'PORTAL DO CLIENTE' : 'ESPAÇO DO ENTREGADOR'}</div>
      <div className="central"><span className="central-logo"><Building2 size={17}/></span><div><strong>{usuario.empresa?.nom_fan ?? 'Central RotaJá'}</strong><small>Gestão de logística</small></div><ChevronRight size={14}/></div>
      <span className="nav-legenda">PRINCIPAL</span><nav>{nav.map(([p, Icone]) => <a key={p} href={'#' + p} onClick={() => definirMenu(false)} className={atual === p ? 'selecionado' : ''}><Icone size={18}/><span>{p === 'entregas' ? usuario.tp_usr === 'REMETENTE' ? 'Minhas chamadas' : usuario.tp_usr === 'ENTREGADOR' ? 'Minhas corridas' : 'Visão operacional' : nomes[p]}</span>{atual === p && <span className="nav-ponto"/>}</a>)}</nav>
      <div className="sidebar-inferior"><div className="dica"><Zap size={17}/><strong>Sua operação, conectada.</strong><p>Da chamada à entrega, tudo em um só lugar.</p></div><a href="#ajuda" className="ajuda-link"><CircleHelp size={17}/>Central de ajuda<ArrowUpRight size={14}/></a><div className="perfil"><span className="avatar">{usuario.nom_usr.slice(0, 2).toUpperCase()}</span><div><strong>{usuario.nom_usr}</strong><small>{operacao ? 'Equipe de operação' : usuario.tp_usr === 'REMETENTE' ? 'Cliente parceiro' : 'Entregador'}</small></div><button title="Sair" aria-label="Sair da conta" className="icone" disabled={saindo} onClick={sair}><LogOut size={17}/></button></div></div>
    </aside>
    <div className="principal"><header className="topbar"><div className="breadcrumb"><button className="icone hamburguer" aria-label="Abrir menu" onClick={() => definirMenu(true)}><Menu size={22}/></button><span>Workspace</span><ChevronRight size={14}/><strong>{nomes[atual]}</strong></div><div className="topbar-direita"><span className={`conexao ${online ? '' : 'offline'}`}><i />{online ? 'Tempo real conectado' : 'Reconectando…'}</span><span className="data-topo">{new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</span><span className="avatar pequeno">{usuario.nom_usr[0]}</span><span className="nome-topo">{usuario.nom_usr}</span><button className="btn compacto" aria-label="Sair pelo topo" disabled={saindo} onClick={sair}><LogOut size={16}/>{saindo ? 'Saindo…' : 'Sair'}</button></div></header>
    <main className="conteudo">
      {usuario.tp_usr === 'ADMINISTRADOR' && <ControleSistema />}
      {(atual === 'entregas' || atual === 'nova-chamada') && <Pedidos key={atual} abrirNovo={atual === 'nova-chamada'} usuario={usuario} revisao={versao} atualizar={atualizar} avisar={avisar} socket={socket} online={online}/>}
      {['empresas', 'entregadores', 'bairros'].includes(atual) && operacao && <Cadastros key={atual} pagina={atual} usuario={usuario} avisar={avisar} atualizar={atualizar} revisao={versao}/>}
      {atual === 'usuarios' && operacao && <Usuarios usuario={usuario} avisar={avisar} revisao={versao} atualizar={atualizar}/>}
      {usuario.tp_usr === 'REMETENTE' && atual === 'resumo' && <PortalEmpresa usuario={usuario} revisao={versao}/>}
      {usuario.tp_usr === 'REMETENTE' && atual === 'tarifas' && <TarifasConsulta />}
      {usuario.tp_usr === 'REMETENTE' && atual === 'conta' && <MinhaEmpresa usuario={usuario}/>}
      {atual === 'relatorios' && <Relatorios usuario={usuario}/>}
      {atual === 'caixa' && usuario.tp_usr !== 'REMETENTE' && <CaixaDiario usuario={usuario}/>}
      {atual === 'financeiro' && <Financeiro usuario={usuario} avisar={avisar} atualizar={atualizar} revisao={versao}/>}
      {atual === 'ajuda' && <><div className="pagina-titulo"><div><span className="sobretitulo">SUPORTE À OPERAÇÃO</span><h1>Como funciona o RotaJá</h1><p>Um fluxo simples para cada etapa da entrega.</p></div></div><div className="ajuda-grid">{[['01', 'Cadastre sua rede', 'Na operação, cadastre empresas, entregadores e bairros. A loja e o entregador recebem acessos individuais definidos no cadastro.'], ['02', 'Abra uma chamada', 'Entre com o acesso da loja, escolha um bairro permitido e informe destinatário, endereço, retorno e cobrança.'], ['03', 'Despache e acompanhe', 'Selecione o entregador na tabela. Ele aceita a corrida e avança pela coleta, entrega e retorno, quando houver.'], ['04', 'Confira o financeiro', 'Filtre o período, gere o fechamento e confira o comprovante antes da quitação. Saldo negativo indica crédito do entregador.']].map(([n, t, d]) => <article className="cartao ajuda-card" key={n}><span>{n}</span><h2>{t}</h2><p>{d}</p></article>)}</div><div className="aviso">O compartilhamento de localização no navegador funciona enquanto a página estiver aberta e depende da sua permissão. Para rastreamento contínuo em segundo plano, utilize a integração Expo disponível no projeto.</div></>}
      <footer className="rodape"><span>RotaJá · Gestão de entregas</span><span><ShieldCheck size={13}/> Ambiente local · v0.2.0</span></footer>
    </main></div>
    {aviso && <div className={`toast ${aviso.erro ? 'erro' : 'sucesso'}`} role={aviso.erro ? 'alert' : 'status'}>{aviso.texto}<button aria-label="Dispensar aviso" onClick={() => definirAviso(null)}><X size={16}/></button></div>}
  </div>;
}
function Marca() { return <div className="marca"><span className="marca-simbolo"><Zap fill="currentColor" size={23}/></span><strong>rota<span>já</span><i /></strong></div>; }
function Acesso({ entrar }) {
    const [area, definirArea] = useState(location.pathname === '/empresa' ? 'EMPRESA' : location.pathname === '/entregador' ? 'ENTREGADOR' : 'ADM');
    const [erro, definirErro] = useState(''), [ocupado, definirOcupado] = useState(false);
    async function enviar(e) {
        e.preventDefault();
        definirOcupado(true);
        definirErro('');
        const d = Object.fromEntries(new FormData(e.currentTarget));
        try {
            await api('/autenticacao/entrar', { ...d, area });
            entrar(await api('/autenticacao/eu'));
        }
        catch (e) {
            definirErro(e instanceof Error ? e.message : 'Servidor indisponível');
        }
        finally {
            definirOcupado(false);
        }
    }
    return <div className="login"><section className="login-visual"><Marca /><div className="login-mensagem"><span className="etiqueta">LOGÍSTICA SEM COMPLICAÇÃO</span><h1>O próximo destino<br />da sua operação.</h1><p>Conecte lojas e entregadores.<br />Acompanhe cada entrega, do início ao fim.</p><div className="rota-ilustracao"><div className="rota-ponto"><Building2 /><span>Coleta</span></div><div className="rota-trilha"><i /><i /><i /><Bike size={40}/><i /><i /><i /></div><div className="rota-ponto"><MapPinned /><span>Entrega</span></div></div></div><small>Controle na central. Agilidade na rua.</small></section><section className="login-form"><div className="login-caixa"><span className="sobretitulo">BEM-VINDO AO ROTAJÁ</span><h2>{area === 'EMPRESA' ? 'Acesso da empresa' : area === 'ENTREGADOR' ? 'Acesso do entregador' : 'Acesse sua conta'}</h2><p>{location.pathname === '/empresa' ? 'Chamadas, taxas e repasses da sua loja.' : 'Entre para acompanhar sua operação.'}</p><div className="login-opcoes" aria-label="Tipo de acesso"><button type="button" aria-pressed={area === 'ADM'} onClick={() => { definirArea('ADM'); definirErro(''); }}>Entrar como ADM</button><button type="button" aria-pressed={area === 'EMPRESA'} onClick={() => { definirArea('EMPRESA'); definirErro(''); }}>Entrar como Empresa</button></div><button className="login-entregador" type="button" onClick={() => { definirArea('ENTREGADOR'); definirErro(''); }}>Sou entregador</button><form onSubmit={enviar}><label className="campo"><span>E-mail</span><input autoComplete="username" name="eml_usr" type="email" placeholder="voce@empresa.com.br" required autoFocus/></label><label className="campo"><span>Senha</span><input autoComplete="current-password" name="senha" type="password" placeholder="Sua senha de acesso" required/></label>{erro && <p className="aviso erro" role="alert">{erro}</p>}<button className="btn primario" disabled={ocupado}>{ocupado ? 'Entrando…' : 'Entrar na plataforma'}<ArrowUpRight size={18}/></button></form><div className="login-nota"><ShieldCheck size={18}/><span>Acesso exclusivo para usuários cadastrados pela sua central. <a href="/empresa">Portal das empresas</a></span></div></div><span className="login-direitos">© {new Date().getFullYear()} RotaJá · Todos os destinos começam aqui.</span></section></div>;
}
