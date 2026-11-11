'use client';
import { useEffect, useState } from 'react';
export function NovoChamado({ token, api }) {
    const [bairros, definirBairros] = useState([]);
    const [mensagem, definirMensagem] = useState(''), [enviando, definirEnviando] = useState(false);
    const [pagamento, definirPagamento] = useState('PAGO');
    const [chave, definirChave] = useState(() => crypto.randomUUID());
    useEffect(() => { fetch(api + '/bairros', { headers: { Authorization: `Bearer ${token}` } }).then(async (r) => { if (!r.ok)
        throw Error(); definirBairros(await r.json()); }).catch(() => definirMensagem('Não foi possível carregar os bairros')); }, [api, token]);
    async function enviar(e) {
        e.preventDefault();
        definirEnviando(true);
        const form = e.currentTarget;
        const d = Object.fromEntries(new FormData(form));
        if (!d.cmp_dest)
            delete d.cmp_dest;
        if (!d.ref_dest)
            delete d.ref_dest;
        try {
            const r = await fetch(api + '/pedidos', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...d, st_ret: d.st_ret === 'true', chave_idem: chave }) });
            const resposta = await r.json();
            if (!r.ok)
                throw Error(resposta.erro ?? 'Não foi possível criar o chamado');
            definirMensagem(`Chamado #${resposta.num_ped} criado`);
            form.reset();
            definirPagamento('PAGO');
            definirChave(crypto.randomUUID());
        }
        catch (erro) {
            definirMensagem(erro.message);
        }
        finally {
            definirEnviando(false);
        }
    }
    return <form onSubmit={enviar} className="mx-auto grid max-w-3xl gap-4 p-6 text-slate-900">
    <h1 className="text-2xl font-semibold">Nova chamada</h1>
    {['nom_dest', 'tel_dest', 'log_dest', 'num_dest', 'cmp_dest', 'ref_dest'].map((nome, i) => <label key={nome}>{['Nome completo', 'Telefone com DDD', 'Rua', 'Número', 'Complemento', 'Referência'][i]}<input name={nome} required={i < 4} className="mt-1 block w-full rounded border p-3"/></label>)}
    <label>Bairro<select name="id_bai" required className="block w-full rounded border p-3" defaultValue=""><option value="" disabled>Selecione um bairro permitido</option>{bairros.map(b => <option key={b.id_bai} value={b.id_bai}>{b.nom_bai} — R$ {b.vlr_tx_ent}</option>)}</select></label>
    <label>Tipo de endereço<select name="tp_end" className="ml-2 border p-3"><option value="ENTREGA">Entrega no destinatário</option><option value="ORIGEM">Coleta no destinatário</option></select></label>
    <label>Retorno<select name="st_ret" className="ml-2 border p-3"><option value="false">Não</option><option value="true">Sim</option></select></label>
    <label>Pagamento<select name="st_pag" onChange={e => definirPagamento(e.target.value)} className="ml-2 border p-3"><option value="PAGO">Pago na loja</option><option value="A_RECEBER">Cobrar produto e frete na rua</option></select></label>
    {pagamento === 'A_RECEBER' && <><label>Forma de pagamento<select name="tp_pag_prev"><option value="DINHEIRO">Dinheiro</option><option value="PIX_LOJA">PIX para a loja</option><option value="CARTAO_LOJA">Cartão para a loja</option></select></label><label>Total a recolher, incluindo frete (R$)<input name="vlr_cobrar" required pattern="[0-9]+([.][0-9]{1,2})?" inputMode="decimal" className="ml-2 border p-3"/></label></>}
    <button disabled={enviando || !bairros.length} className="rounded bg-blue-800 p-4 text-white disabled:opacity-50">{enviando ? 'Enviando…' : 'Abrir chamado'}</button><p role="status">{mensagem}</p>
  </form>;
}
