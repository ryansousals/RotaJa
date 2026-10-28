import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { io, type Socket } from 'socket.io-client';
import { ArrowUpRight, Bike, Building2, ChevronRight, CircleHelp, LayoutDashboard, LogOut, MapPinned, Menu, Package, ShieldCheck, Users, Wallet, X, Zap } from 'lucide-react';
import { api, eOperador, type Usuario } from './api';
import { Pedidos } from './Pedidos';
import { Cadastros } from './Cadastros';
import { Financeiro } from './Financeiro';
export type Avisar = (mensagem: string, erro?: boolean) => void;
const nomes: Record<string, string> = { entregas: 'Central de entregas', empresas: 'Empresas parceiras', entregadores: 'Entregadores', bairros: 'Bairros e tarifas', usuarios: 'Usuários e acessos', financeiro: 'Financeiro', ajuda: 'Ajuda e operação' };
export function App() {
  const [usuario, setUsuario] = useState<Usuario | null>(null), [carregando, setCarregando] = useState(true);
  const [pagina, setPagina] = useState(location.hash.slice(1) || 'entregas'), [menu, setMenu] = useState(false);
  const [versao, setVersao] = useState(0), [socket, setSocket] = useState<Socket | null>(null), [online, setOnline] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; erro: boolean } | null>(null);
  const avisar = useCallback<Avisar>((texto, erro = false) => setAviso({ texto, erro }), []);
  const agendado = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const atualizar = useCallback(() => { clearTimeout(agendado.current); agendado.current = setTimeout(() => setVersao(v => v + 1), 180); }, []);
  useEffect(() => () => clearTimeout(agendado.current), []);
  useEffect(() => { api<Usuario>('/autenticacao/eu').then(setUsuario).catch(() => {}).finally(() => setCarregando(false)); }, []);
  useEffect(() => { const expirar = () => { setUsuario(null); avisar('Sua sessão terminou. Entre novamente.', true); }; window.addEventListener('sessao-expirada', expirar); return () => window.removeEventListener('sessao-expirada', expirar); }, [avisar]);
  useEffect(() => { const h = () => setPagina(location.hash.slice(1) || 'entregas'); window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h); }, []);
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(null), 6000); return () => clearTimeout(t); }, [aviso]);
  useEffect(() => {
    if (!usuario) return;
    const s = io({ transports: ['websocket'], withCredentials: true }); setSocket(s);
    s.on('connect', () => { setOnline(true); atualizar(); }); s.on('disconnect', () => setOnline(false));
    s.on('connect_error', () => setOnline(false)); s.on('pedido:atualizado', atualizar);
    s.on('chamado:atribuido', () => { atualizar(); avisar('Você recebeu uma nova corrida.'); });
    const consultar = setInterval(atualizar, 30000); // Reconsulta de segurança se uma notificação se perder.
    return () => { clearInterval(consultar); s.disconnect(); setSocket(null); setOnline(false); };
  }, [usuario, atualizar, avisar]);
  if (carregando) return <div className="iniciando"><Marca/><p>Conectando à sua operação…</p></div>;
  if (!usuario) return <><Login entrar={u => { setUsuario(u); location.hash = 'entregas'; }} />{aviso && <div role="alert" className="toast erro">{aviso.texto}</div>}</>;
  const operacao = eOperador(usuario);
  const nav = operacao ? [['entregas', LayoutDashboard],['empresas', Building2],['entregadores', Bike],['bairros', MapPinned],['financeiro', Wallet],['usuarios', Users]] as const : [['entregas', Package],['financeiro', Wallet]] as const;
  const atual = nav.some(([p]) => p === pagina) || pagina === 'ajuda' ? pagina : 'entregas';
  return <div className="app-shell">
    {menu && <button aria-label="Fechar navegação" className="cortina" onClick={() => setMenu(false)}/>}
    <aside className={`sidebar ${menu ? 'aberto' : ''}`}><a href="#entregas" className="marca-link"><Marca/></a><div className="area-rotulo">{operacao ? 'WORKSPACE · OPERAÇÃO' : usuario.tp_usr === 'REMETENTE' ? 'PORTAL DO CLIENTE' : 'ESPAÇO DO ENTREGADOR'}</div>
      <div className="central"><span className="central-logo"><Building2 size={17}/></span><div><strong>Central RotaJá</strong><small>Gestão de logística</small></div><ChevronRight size={14}/></div>
      <span className="nav-legenda">PRINCIPAL</span><nav>{nav.map(([p, Icone]) => <a key={p} href={'#' + p} onClick={() => setMenu(false)} className={atual === p ? 'selecionado' : ''}><Icone size={18}/><span>{p === 'entregas' ? usuario.tp_usr === 'REMETENTE' ? 'Minhas chamadas' : usuario.tp_usr === 'ENTREGADOR' ? 'Minhas corridas' : 'Visão operacional' : nomes[p]}</span>{atual === p && <span className="nav-ponto"/>}</a>)}</nav>
      <div className="sidebar-inferior"><div className="dica"><Zap size={17}/><strong>Sua operação, conectada.</strong><p>Da chamada à entrega, tudo em um só lugar.</p></div><a href="#ajuda" className="ajuda-link"><CircleHelp size={17}/>Central de ajuda<ArrowUpRight size={14}/></a><div className="perfil"><span className="avatar">{usuario.nom_usr.slice(0,2).toUpperCase()}</span><div><strong>{usuario.nom_usr}</strong><small>{operacao ? 'Equipe de operação' : usuario.tp_usr === 'REMETENTE' ? 'Cliente parceiro' : 'Entregador'}</small></div><button title="Sair" aria-label="Sair da conta" className="icone" onClick={async () => { try { await api('/autenticacao/sair', {}); setUsuario(null); } catch (e) { avisar((e as Error).message, true); } }}><LogOut size={17}/></button></div></div>
    </aside>
    <div className="principal"><header className="topbar"><div className="breadcrumb"><button className="icone hamburguer" aria-label="Abrir menu" onClick={() => setMenu(true)}><Menu size={22}/></button><span>Workspace</span><ChevronRight size={14}/><strong>{nomes[atual]}</strong></div><div className="topbar-direita"><span className={`conexao ${online ? '' : 'offline'}`}><i/>{online ? 'Tempo real conectado' : 'Reconectando…'}</span><span className="data-topo">{new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</span><span className="avatar pequeno">{usuario.nom_usr[0]}</span></div></header>
    <main className="conteudo">
      {atual === 'entregas' && <Pedidos usuario={usuario} revisao={versao} atualizar={atualizar} avisar={avisar} socket={socket} online={online}/>}
      {['empresas','entregadores','bairros','usuarios'].includes(atual) && operacao && <Cadastros key={atual} pagina={atual} usuario={usuario} avisar={avisar} atualizar={atualizar} revisao={versao}/>}
      {atual === 'financeiro' && <Financeiro usuario={usuario} avisar={avisar} atualizar={atualizar} revisao={versao}/>}
      {atual === 'ajuda' && <><div className="pagina-titulo"><div><span className="sobretitulo">SUPORTE À OPERAÇÃO</span><h1>Como funciona o RotaJá</h1><p>Um fluxo simples para cada etapa da entrega.</p></div></div><div className="ajuda-grid">{[['01','Cadastre sua rede','Na operação, cadastre empresas, entregadores e bairros. A loja e o entregador recebem acessos individuais definidos no cadastro.'],['02','Abra uma chamada','Entre com o acesso da loja, escolha um bairro permitido e informe destinatário, endereço, retorno e cobrança.'],['03','Despache e acompanhe','Selecione o entregador na tabela. Ele aceita a corrida e avança pela coleta, entrega e retorno, quando houver.'],['04','Confira o financeiro','Filtre o período, gere o fechamento e confira o comprovante antes da quitação. Saldo negativo indica crédito do entregador.']].map(([n,t,d]) => <article className="cartao ajuda-card" key={n}><span>{n}</span><h2>{t}</h2><p>{d}</p></article>)}</div><div className="aviso">O compartilhamento de localização no navegador funciona enquanto a página estiver aberta e depende da sua permissão. Para rastreamento contínuo em segundo plano, utilize a integração Expo disponível no projeto.</div></>}
      <footer className="rodape"><span>RotaJá · Gestão de entregas</span><span><ShieldCheck size={13}/> Ambiente local · v0.2.0</span></footer>
    </main></div>
    {aviso && <div className={`toast ${aviso.erro ? 'erro' : 'sucesso'}`} role={aviso.erro ? 'alert' : 'status'}>{aviso.texto}<button aria-label="Dispensar aviso" onClick={() => setAviso(null)}><X size={16}/></button></div>}
  </div>;
}
function Marca() { return <div className="marca"><span className="marca-simbolo"><Zap fill="currentColor" size={23}/></span><strong>rota<span>já</span><i/></strong></div>; }
function Login({ entrar }: { entrar: (u: Usuario) => void }) {
  const [erro, setErro] = useState(''), [ocupado, setOcupado] = useState(false);
  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setOcupado(true); setErro(''); const d = Object.fromEntries(new FormData(e.currentTarget));
    try { await api('/autenticacao/entrar', d); entrar(await api<Usuario>('/autenticacao/eu')); } catch (e) { setErro(e instanceof Error ? e.message : 'Servidor indisponível'); } finally { setOcupado(false); }
  }
  return <div className="login"><section className="login-visual"><Marca/><div className="login-mensagem"><span className="etiqueta">LOGÍSTICA SEM COMPLICAÇÃO</span><h1>O próximo destino<br/>da sua operação.</h1><p>Conecte lojas e entregadores.<br/>Acompanhe cada entrega, do início ao fim.</p><div className="rota-ilustracao"><div className="rota-ponto"><Building2/><span>Coleta</span></div><div className="rota-trilha"><i/><i/><i/><Bike size={40}/><i/><i/><i/></div><div className="rota-ponto"><MapPinned/><span>Entrega</span></div></div></div><small>Controle na central. Agilidade na rua.</small></section><section className="login-form"><div className="login-caixa"><span className="sobretitulo">BEM-VINDO AO ROTAJÁ</span><h2>Acesse sua conta</h2><p>Entre para acompanhar sua operação.</p><form onSubmit={enviar}><label className="campo"><span>E-mail</span><input autoComplete="username" name="eml_usr" type="email" placeholder="voce@empresa.com.br" required autoFocus/></label><label className="campo"><span>Senha</span><input autoComplete="current-password" name="senha" type="password" placeholder="Sua senha de acesso" required/></label>{erro && <p className="aviso erro" role="alert">{erro}</p>}<button className="btn primario" disabled={ocupado}>{ocupado ? 'Entrando…' : 'Entrar na plataforma'}<ArrowUpRight size={18}/></button></form><div className="login-nota"><ShieldCheck size={18}/><span>Acesso exclusivo para usuários cadastrados pela sua central.</span></div></div><span className="login-direitos">© {new Date().getFullYear()} RotaJá · Todos os destinos começam aqui.</span></section></div>;
}
