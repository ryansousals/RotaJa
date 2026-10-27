'use client';
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
type Pedido = { id_ped: string; num_ped: number; nom_dest: string; bairro: { nom_bai: string }; empresa: { nom_fan: string }; st_ped: string; id_ent: string | null; versao: number; dt_cad: string; dt_alt: string };
// Token recebido do fluxo de login; manter em memória, sem localStorage.
export function PainelOperador({ token, api }: { token: string; api: string }) {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [entregadores, setEntregadores] = useState<{ id_ent: string; usuario: { nom_usr: string } }[]>([]);
  const [erro, setErro] = useState('');
  const [agora, setAgora] = useState(Date.now());
  const [socket] = useState(() => io(api, { autoConnect: false, auth: { token }, transports: ['websocket'] }));
  useEffect(() => {
    let ativo = true;
    async function carregar() {
      try {
        const resultados = await Promise.all(['/pedidos', '/entregadores'].map(url => fetch(api + url, { headers: { Authorization: `Bearer ${token}` } })));
        if (resultados.some(r => !r.ok)) throw new Error('Não foi possível carregar a operação');
        const [lista, ent] = await Promise.all(resultados.map(r => r.json()));
        if (ativo) { setPedidos(lista.itens); setEntregadores(ent); }
      } catch (e) { if (ativo) setErro((e as Error).message); }
    }
    socket.auth = { token };
    socket.on('connect', carregar); // Reconsulta após reconexão: Redis Pub/Sub não guarda eventos.
    socket.on('pedido:atualizado', carregar); socket.connect();
    const timer = setInterval(() => setAgora(Date.now()), 30_000);
    return () => { ativo = false; clearInterval(timer); socket.off('connect', carregar); socket.off('pedido:atualizado', carregar); socket.disconnect(); };
  }, [api, token, socket]);
  return <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
    <h1 className="text-2xl font-semibold">Gerenciamento de entregas</h1>
    {erro && <p role="alert" className="my-4 text-red-400">{erro}</p>}
    <div className="mt-6 overflow-x-auto rounded-lg border border-slate-700"><table className="w-full text-left text-sm">
      <thead className="bg-slate-800"><tr>{['Pedido','Cliente','Bairro','Empresa','Status','Entregador','Alterado','Realizado','Ações'].map(c => <th key={c} className="p-3">{c}</th>)}</tr></thead>
      <tbody>{pedidos.map(p => { const min = Math.floor((agora - Date.parse(p.dt_cad)) / 60000); return <tr key={p.id_ped} className="border-t border-slate-800">
        <td className="p-3">#{p.num_ped}<span className={`ml-2 rounded px-2 py-1 ${p.st_ped === 'CONCLUIDO' ? 'bg-green-900' : min >= 20 ? 'bg-red-900' : 'bg-amber-900'}`}>{min} min</span></td>
        <td>{p.nom_dest}</td><td>{p.bairro.nom_bai}</td><td>{p.empresa.nom_fan}</td><td>{p.st_ped}</td>
        <td><select aria-label={`Entregador do pedido ${p.num_ped}`} value={p.id_ent ?? ''} disabled={!['PREPARANDO','ATRIBUIDO'].includes(p.st_ped)} className="rounded bg-slate-800 p-2" onChange={e => {
          socket.timeout(5000).emit('pedido:despachar', { id_ped: p.id_ped, id_ent: e.target.value, versao: p.versao }, (falha: unknown, resposta: { ok: boolean; mensagem?: string }) => {
            if (falha || !resposta?.ok) setErro(resposta?.mensagem ?? 'Conexão indisponível. Atualize a lista antes de tentar novamente.');
          });
        }}><option value="" disabled>Selecione</option>{entregadores.map(e => <option key={e.id_ent} value={e.id_ent}>{e.usuario.nom_usr}</option>)}</select></td>
        <td>{new Date(p.dt_alt).toLocaleString('pt-BR')}</td><td>{new Date(p.dt_cad).toLocaleString('pt-BR')}</td>
        <td><button className="p-3 underline" onClick={() => window.alert('Conecte aqui o modal de detalhes e /pedidos/:id/historico')}>Detalhes</button></td>
      </tr>; })}</tbody></table></div>
  </main>;
}
