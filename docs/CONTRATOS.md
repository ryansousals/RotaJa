# Contratos e experiência de uso

| Método / rota | Perfil | Finalidade |
|---|---|---|
| POST /autenticacao/entrar | Público, limitado | Sessão de 1 hora |
| POST /autenticacao/sair | Autenticado | Revogação |
| POST /usuarios | Operação | Cadastro controlado |
| POST, GET /empresas; PATCH /empresas/:id | Operação | Gestão de lojas |
| POST, GET /entregadores | Operação | Cadastro e lista para despacho |
| GET /bairros | Autenticado | Select permitido |
| POST /bairros; PATCH /bairros/:id | Administrador | Preços padrão e ganhos |
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
- `PATCH /entregadores/:id`: atualização operacional; bairros e preços são exclusivos do administrador.
- `POST /operacao/pedidos`: desabilitado (403). Apenas lojas abrem chamadas em `POST /pedidos`.
- `GET /pedidos`: filtros `busca`, `status` e `pagina`; `ATIVOS` exclui concluídos e cancelados.
- `GET /pedidos/:id/gps`: última posição recente autorizada ou null.
- `GET /financeiro?inicio=ISO&fim=ISO`: resumo do período, caixas e repasses, sempre limitados ao perfil.

Na web, chamadas usam `/api` na mesma origem. Socket autentica pelo cookie e também aceita `auth.token` de integrações. Cadastros gerenciais incluem inativos; abertura de pedidos aceita somente bairro e empresa ativos. O cliente nunca escolhe remetente arbitrário.

## Tarifas e abertura de chamadas

`GET /empresas/:id/tarifas` (operação) lista todos os bairros e o preço efetivo da loja, com `personalizada`. `PUT /empresas/:id/tarifas/:bairro` (somente ADMINISTRADOR) recebe `{ "vlr_tx_ent": "9.00", "vlr_tx_ret": "4.00" }`. `GET /bairros` para REMETENTE já retorna os valores efetivos da própria loja, sem selecionar outra empresa.

O corpo de `POST /pedidos` mantém os dados de endereço, bairro, retorno e chave idempotente. Para `PAGO`, omitir `vlr_cobrar` e `tp_pag_prev`. Para `A_RECEBER`, informar ambos: `vlr_cobrar: "100.00"` é o total inclusivo e `tp_pag_prev` aceita `DINHEIRO`, `PIX_LOJA`, `CARTAO_LOJA`. O total não pode ser inferior à taxa; `vlr_prod` não é aceito na entrada, sendo calculado no servidor. `PATCH /pedidos/:id` também usa total inclusivo; somente ADM altera campos financeiros, com motivo e versão. Operadores ainda podem corrigir dados de endereço.

A migração adiciona `tx_taxas_empresas` com chave composta empresa/bairro e `tp_pag_prev` opcional em pedidos, preservando histórico e recebimentos existentes. Pedidos antigos não terão forma prevista preenchida artificialmente.

## Resumo exclusivo da empresa

`GET /portal/resumo?inicio=ISO&fim=ISO` exige REMETENTE com empresa ativa. Intervalo inclusivo no início, exclusivo no fim, máximo de 366 dias. Não aceita `id_emp`: o escopo é obtido da sessão. Consulta usa transação RepeatableRead para evitar dupla contagem durante fechamento/quitação concorrentes.

Retorna contagens por status/data de abertura, total histórico, ativos atuais, taxas e recebimentos por conclusão no período, repasses positivos quitados por data de pagamento e oito últimas chamadas. O saldo global é `soma(dinheiro - taxa dos concluídos sem repasse) + soma(repasses PENDENTE)`. Separado em `sem_fechamento` e `em_fechamento`; `a_receber` e `a_pagar` mostram a direção do saldo líquido. Fechamentos QUITADO não voltam ao saldo. Valores monetários são Decimal, serializados como strings.

Frontend: `/empresa` abre o acesso de parceiros; o perfil REMETENTE inicia em `#resumo`, com `#entregas`, `#nova-chamada`, `#financeiro`, `#tarifas` (consulta) e `#conta` (consulta). Sessões e permissões são as mesmas do backend, sem privilégios derivados da URL.

## Pausa geral e exclusão

- Login aceita `area?: ADM | EMPRESA | ENTREGADOR`, validada contra o perfil após conferir a senha. ADM inclui ADMINISTRADOR/OPERADOR. Não cria ou promove usuários.
- `GET /sistema/empresas`: somente ADM, retorna `st_emp_lig`, `versao`, data e autor da última alteração.
- `PATCH /sistema/empresas`: somente ADM, `{st_emp_lig:boolean, versao:number}`. Versão desatualizada retorna 409; estado persistido em `cfg_sistema`.
- `DELETE /empresas/:id`: somente ADM, exclusão lógica idempotente (204); preenche `dt_exc`, desativa empresa/usuário e desconecta a sala do usuário. Não remove pedidos nem repasses.
- Todo acesso autenticado REMETENTE verifica o estado da empresa e a pausa geral. Estado bloqueado retorna 423; usuário desativado retorna 401. Conexões Socket.IO também validam o estado; `acesso:bloqueado` avisa o navegador antes da desconexão.
- Na abertura de pedido, o estado geral é novamente verificado dentro da transação. Listagem de empresas exclui `dt_exc != null`; edição comum não alcança excluídas.

Validação específica: `npx tsx scripts/verificar-controle.ts`. Executar apenas em ambiente de teste/local: cria uma empresa fictícia, pausa o acesso geral brevemente e restaura o estado anterior em `finally`. A empresa fictícia é excluída logicamente ao finalizar. Testes web de controle também restauram o estado anterior.
