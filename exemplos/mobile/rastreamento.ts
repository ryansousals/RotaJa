import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
// Importar este módulo no início do app. Usar build nativo: não funciona no Expo Go.
const TAREFA = 'rastreamento-corrida';
TaskManager.defineTask(TAREFA, async ({ data, error }) => {
  if (error || !data) return;
  const contexto = await SecureStore.getItemAsync('corrida-ativa');
  if (!contexto) return;
  const { id_ped, api } = JSON.parse(contexto);
  const token = await SecureStore.getItemAsync('token');
  if (!token) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  const ultima = locations.at(-1);
  if (ultima) await fetch(api + '/gps', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id_ped, lat: ultima.coords.latitude, lng: ultima.coords.longitude, dt: new Date(ultima.timestamp).toISOString() }) });
});
export async function iniciarRastreamento(id_ped: string, api: string) {
  const frente = await Location.requestForegroundPermissionsAsync();
  if (frente.status !== 'granted') throw Error('Autorize a localização para rastrear a corrida');
  const fundo = await Location.requestBackgroundPermissionsAsync();
  if (fundo.status !== 'granted') throw Error('Autorize a localização em segundo plano');
  await SecureStore.setItemAsync('corrida-ativa', JSON.stringify({ id_ped, api }));
  await Location.startLocationUpdatesAsync(TAREFA, { accuracy: Location.Accuracy.High, distanceInterval: 30, timeInterval: 10000, showsBackgroundLocationIndicator: true, foregroundService: { notificationTitle: 'Corrida em andamento', notificationBody: 'RotaJá está compartilhando sua posição durante a corrida.' } });
}
export async function pararRastreamento() {
  if (await Location.hasStartedLocationUpdatesAsync(TAREFA)) await Location.stopLocationUpdatesAsync(TAREFA);
  await SecureStore.deleteItemAsync('corrida-ativa');
}
