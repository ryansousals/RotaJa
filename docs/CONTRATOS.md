# Contratos e experiência de uso

| Método / rota | Perfil | Finalidade |
|---|---|---|
| POST /autenticacao/entrar | Público, limitado | Sessão de 1 hora |
| POST /autenticacao/sair | Autenticado | Revogação |
| POST /usuarios | Operação | Cadastro controlado |
| POST, GET /empresas; PATCH /empresas/:id | Operação | Gestão de lojas |
| POST, GET /entregadores | Operação | Cadastro e lista para despacho |
| GET /bairros | Autenticado | Select permitido |
| POST /bairros | Operação | Preços e ganhos |
| POST /pedidos | Remetente | Abertura idempotente |
| GET /pedidos?pagina=1 | Autenticado | Lista de 30, com escopo por usuário |
| GET /pedidos/:id | Autenticado | Detalhe autorizado |
| PATCH /pedidos/:id | Operação | Correção com versão e motivo |
| GET /pedidos/:id/historico | Operação | Auditoria |
| POST /pedidos/status | Operação/entregador atribuído | Próxima etapa |
| POST /gps | Entregador atribuído | Envio em background via HTTP |
| POST /caixas/fechar | Operação/próprio entregador | Fechamento por período |
| POST /caixas/:id/quitar | Operação | Conferência com comprovante |
| POST /repasses | Operação | Gerar acerto de loja por período |
| POST /repasses/:id/quitar | Operação | Confirmar acerto |

Financeiro por período: `{ "id_ent": "UUID", "dt_ini": "2026-10-26T00:00:00-03:00", "dt_fim": "2026-10-27T00:00:00-03:00" }`. Repasse troca `id_ent` por `id_emp`. Quitação recebe `{ "ref_comprovante": "identificador-do-comprovante" }`.

Socket conecta com `{ auth: { token }, transports: ['websocket'] }`. `pedido:despachar` recebe `{id_ped,id_ent,versao}` e callback `{ok,pedido}` ou `{ok:false,mensagem}`. Eventos `pedido:atualizado` e `chamado:atribuido` disparam reconsulta HTTP; `gps:posicao` recebe `{id_ped,lat,lng,dt}`. `gps:atualizar` usa o mesmo contrato de posição. Não há broadcast global de dados pessoais.

Erros: 401 sessão inválida; 403 sem permissão; 404 ausente; 409 concorrência/duplicidade/fechamento; 422 validação; 429 excesso; 500 erro interno sem stack exposta. Para mudança de status enviar `{id_ped,versao,st_ped,tp_rec?}`. Conclusão de A_RECEBER exige DINHEIRO, PIX_LOJA ou CARTAO_LOJA.

## Interfaces

Operação: grafite #1E293B, fundo #0F172A; tabela densa com as nove colunas do print. Ação de despacho inline, seleção bloqueada durante operação, retorno de erro e reconsulta em conflito. Exibir preparação em âmbar, concluído/pago em verde, espera excessiva/cobrança pendente em vermelho, sempre com texto além da cor. Cronômetro deve parar na conclusão: o componente exemplifica a espera; separar tempo de fila e ciclo total na aplicação final.

Remetente: formulário responsivo e rótulos claros. Select obrigatório de bairros, sem criação livre. Explicar coleta na loja ou no destinatário; mostrar adicional de retorno e total calculado pelo servidor na confirmação. Acompanhamento combina lista, linha do tempo e mapa, ocultando GPS quando a corrida terminar. Formulário de exemplo mantém erros visíveis, impede duplo envio e usa chave idempotente; a aplicação final deve tratar alteração dos dados após erro gerando nova chave.

Entregador: alvos de toque grandes, contraste, ações sequenciais. Mostrar os dois pontos da corrida conforme ENTREGA/ORIGEM, cobrança e retorno. Caixa deve exibir corridas, ganhos, dinheiro recebido e saldo com direção do acerto. Solicitar confirmação da forma de recebimento e comprovante antes de concluir. Não incentivar interação durante condução.

## Usar os exemplos

Crie duas aplicações Next.js com TypeScript e Tailwind e instale `socket.io-client`. Copie `exemplos/web` e renderize os componentes após login, passando `api` e `token`. Os exemplos não fazem parte da compilação da API. Complete modal de detalhes, autenticação visual, filtros, busca, todas as páginas e mapa antes de publicar.

Crie um aplicativo Expo TypeScript e instale `expo-location`, `expo-task-manager` e `expo-secure-store`. Copie o config e os módulos de `exemplos/mobile`. Grave token de login em SecureStore. Importe rastreamento no ponto de entrada, inicie após aceite e pare na conclusão, cancelamento ou logout. Use URL HTTPS acessível pelo aparelho; localhost do telefone não aponta para o computador. O componente `AcaoCorrida` recebe forma de recebimento selecionada pela tela pai e reconsulta o pedido em `atualizar`.
