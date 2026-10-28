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
| GET /pedidos?pagina=1 | Autenticado | Lista de 20, com total, páginas e escopo por usuário |
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

A aplicação web integrada está em `web/`. Execute `iniciar.bat` para usar em http://localhost:3002. Os componentes de `exemplos/web` são referências da primeira versão e não fazem parte da aplicação atual.

Crie um aplicativo Expo TypeScript e instale `expo-location`, `expo-task-manager` e `expo-secure-store`. Copie o config e os módulos de `exemplos/mobile`. Grave token de login em SecureStore. Importe rastreamento no ponto de entrada, inicie após aceite e pare na conclusão, cancelamento ou logout. Use URL HTTPS acessível pelo aparelho; localhost do telefone não aponta para o computador. O componente `AcaoCorrida` recebe forma de recebimento selecionada pela tela pai e reconsulta o pedido em `atualizar`.

## Contratos do frontend integrado

- `GET /autenticacao/eu`: identidade e perfis vinculados; sessão por cookie HttpOnly ou Bearer.
- `GET /painel`: contagem de pedidos por status com escopo do perfil.
- `POST /cadastros/empresa` e `/cadastros/entregador`: usuário e parceiro criados atomicamente.
- `GET /usuarios`, `PATCH /usuarios/:id`: listagem e ativação controlada; não permite desativar administrador ou a própria conta.
- `PATCH /bairros/:id`, `PATCH /entregadores/:id`: atualização operacional.
- `POST /operacao/pedidos`: `{id_emp,pedido}`; abertura pelo operador, com auditoria do autor real.
- `GET /pedidos`: filtros `busca`, `status` e `pagina`; `ATIVOS` exclui concluídos e cancelados.
- `GET /pedidos/:id/gps`: última posição recente autorizada ou null.
- `GET /financeiro?inicio=ISO&fim=ISO`: resumo do período, caixas e repasses, sempre limitados ao perfil.

Na web, chamadas usam `/api` na mesma origem. Socket autentica pelo cookie e também aceita `auth.token` de integrações. Cadastros gerenciais incluem inativos; abertura de pedidos aceita somente bairro e empresa ativos. O cliente nunca escolhe remetente arbitrário.
