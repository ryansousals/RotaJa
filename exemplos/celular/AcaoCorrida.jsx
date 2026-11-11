import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import * as SecureStore from 'expo-secure-store';
const acoes = { ATRIBUIDO: ['Aceitar', 'ACEITO'], ACEITO: ['Recolhido', 'EM_ENTREGA'], EM_COLETA: ['Recolhido', 'EM_ENTREGA'], NO_LOCAL: ['Recolhido', 'EM_ENTREGA'], EM_ENTREGA: ['Finalizar Entrega', 'CONCLUIDO'], EM_RETORNO: ['Finalizar Entrega', 'CONCLUIDO'] };
export function AcaoCorrida({ api, pedido, atualizar, tp_rec }) {
    const [erro, definirErro] = useState(''), [ocupado, definirOcupado] = useState(false);
    const acao = acoes[pedido.st_ped];
    if (!acao)
        return <Text>Corrida encerrada</Text>;
    return <View style={{ padding: 24, backgroundColor: '#0F172A' }}><Text style={{ color: '#fff' }}>{erro}</Text><Pressable disabled={ocupado} accessibilityRole="button" style={{ padding: 24, backgroundColor: '#1D4ED8', borderRadius: 12 }} onPress={async () => {
            definirOcupado(true);
            try {
                if (acao[1] === 'CONCLUIDO' && pedido.st_pag === 'A_RECEBER' && !tp_rec)
                    throw Error('Selecione como o pagamento foi recebido');
                const token = await SecureStore.getItemAsync('token');
                const r = await fetch(api + '/pedidos/status', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id_ped: pedido.id_ped, versao: pedido.versao, st_ped: acao[1], tp_rec }) });
                if (!r.ok)
                    throw Error((await r.json()).erro);
                atualizar();
            }
            catch (e) {
                definirErro(e.message);
            }
            finally {
                definirOcupado(false);
            }
        }}><Text style={{ color: 'white', fontSize: 22, textAlign: 'center' }}>{ocupado ? 'Enviando…' : acao[0]}</Text></Pressable></View>;
}
