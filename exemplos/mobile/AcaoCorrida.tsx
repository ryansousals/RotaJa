import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import * as SecureStore from 'expo-secure-store';
const acoes: Record<string, [string, string]> = { ATRIBUIDO: ['Aceitar','ACEITO'], ACEITO: ['Iniciar coleta','EM_COLETA'], EM_COLETA: ['Cheguei no local','NO_LOCAL'], NO_LOCAL: ['Iniciar entrega','EM_ENTREGA'], EM_ENTREGA: ['Concluir entrega','CONCLUIDO'], EM_RETORNO: ['Concluir retorno','CONCLUIDO'] };
export function AcaoCorrida({ api, pedido, atualizar, tp_rec }: { api: string; pedido: { id_ped: string; versao: number; st_ped: string; st_ret: boolean; st_pag: string }; atualizar: () => void; tp_rec?: 'DINHEIRO' | 'PIX_LOJA' | 'CARTAO_LOJA' }) {
  const [erro, setErro] = useState(''), [ocupado, setOcupado] = useState(false);
  const acao = pedido.st_ped === 'EM_ENTREGA' && pedido.st_ret ? ['Iniciar retorno','EM_RETORNO'] : acoes[pedido.st_ped];
  if (!acao) return <Text>Corrida encerrada</Text>;
  return <View style={{ padding: 24, backgroundColor: '#0F172A' }}><Text style={{ color: '#fff' }}>{erro}</Text><Pressable disabled={ocupado} accessibilityRole="button" style={{ padding: 24, backgroundColor: '#1D4ED8', borderRadius: 12 }} onPress={async () => {
    setOcupado(true);
    try {
      if (acao[1] === 'CONCLUIDO' && pedido.st_pag === 'A_RECEBER' && !tp_rec) throw Error('Selecione como o pagamento foi recebido');
      const token = await SecureStore.getItemAsync('token');
      const r = await fetch(api + '/pedidos/status', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id_ped: pedido.id_ped, versao: pedido.versao, st_ped: acao[1], tp_rec }) });
      if (!r.ok) throw Error((await r.json()).erro); atualizar();
    } catch (e) { setErro((e as Error).message); } finally { setOcupado(false); }
  }}><Text style={{ color: 'white', fontSize: 22, textAlign: 'center' }}>{ocupado ? 'Enviando…' : acao[0]}</Text></Pressable></View>;
}
