# RotaJá · Central de entregas

Projeto integrado: React + TypeScript + Tailwind, Express, PostgreSQL/Prisma, Redis e Socket.IO. Interface em português para operação, cliente e entregador.

## Rodar localmente

1. Abra o Docker Desktop e aguarde iniciar (contêineres Linux).
2. Na pasta do projeto, dê dois cliques em **iniciar.bat**. Alternativa: `npm run local`.
3. Abra **http://localhost:3002**.
4. Entre com **ADMIN_EMAIL** e **ADMIN_SENHA** do arquivo **.env** na raiz.

A primeira execução cria a configuração com senhas aleatórias, compila os serviços, aplica migrações e cria o administrador. O caminho por iniciar.bat não exige Node instalado: tudo roda no Docker. O seed preserva a senha do administrador existente. Credenciais não entram no Git nem no pacote de entrega.

A porta 3002 evita conflito com outro projeto nesta máquina. Para alterar, configure WEB_PORT e WEB_ORIGINS no .env. Banco: localhost:55432. API: http://localhost:3001/saude. Redis: localhost:6379. Todos os serviços são publicados apenas localmente.

```powershell
docker compose ps
docker compose logs --tail 30 api web
docker compose stop
docker compose up -d --wait
```

Os volumes preservam os dados. Não exclua os volumes para atualizar o código. Editar senhas no .env não altera automaticamente senhas de bancos e usuários já existentes.

## Recursos

- **Operação:** indicadores, busca, filtros, paginação, despacho inline, detalhes e auditoria, edição justificada, cancelamento e status, abertura em nome da loja, cadastros de empresas/entregadores/bairros/usuários, tarifas, ativação, caixa, repasses, conferência e CSV.
- **Cliente:** abertura de chamados, bairro permitido, coleta ou entrega, retorno, pago/a receber, acompanhamento dos próprios pedidos e consulta de repasses.
- **Entregador:** interface responsiva, aceite, coleta, chegada, entrega, retorno, recebimento, localização com a página aberta, consulta e fechamento do próprio caixa.

Empresa e entregador são cadastrados junto com o usuário em uma transação. O menu Ajuda explica o ciclo. Somente a loja abre chamadas, usando seu próprio acesso. Não há auto-cadastro público.

## Financeiro

A_RECEBER recebe o total a recolher, já incluindo a taxa (sem somá-la novamente), e a forma de pagamento prevista. PAGO não solicita valor de produtos ou cobrança: mostra somente a taxa. Ganho do entregador difere da taxa comercial. Na conclusão, a forma de recebimento distingue dinheiro em custódia de pagamento direto à loja.

**Caixa = dinheiro recebido − ganhos de frete.** R$ 1.000 − R$ 70 = R$ 930 para o ADM. Saldo negativo indica crédito do entregador. Repasse à loja desconta os fretes do período e considera dinheiro recebido pela central. Quitação é conferência contábil, sem transferência bancária.

## Desenvolvimento e testes

Instale Node.js 22+ para editar e testar:

```powershell
npm ci
npm run db:gerar
npm --prefix web ci
npm run build
npm test
npm run build:web
npm run test:integracao
npm --prefix web exec playwright install chromium
npm run test:e2e
```

Os testes integrados exigem a stack ativa e criam dados sintéticos preservados para inspeção. Não use a base de produção. Credenciais são lidas do .env sem impressão. Ao repetir testes rapidamente, um 429 exige aguardar a janela de requisições.

Para atualização automática, mantenha banco/cache ativos e pare os contêineres api/web; execute `npm run dev` e `npm run dev:web` em terminais separados. O frontend usa a porta 3002 e encaminha /api e /socket.io à API. Para voltar ao modo completo, execute iniciar.bat.

## Estrutura

- src/: API e regras de negócio.
- prisma/: schema em português, migrações e seed.
- web/src/: aplicação React integrada.
- web/tests/: testes desktop e mobile.
- web/nginx.conf: proxy HTTP/WebSocket.
- scripts/: inicialização e testes da API.
- exemplos/mobile/: integração Expo de referência.
- docs/: arquitetura, contratos e validação.

## Limites

O frontend entregue é web responsivo para os três perfis. A integração Expo permanece como referência; não há APK/IPA homologado. GPS web exige permissão e funciona enquanto o detalhe da corrida estiver aberto. Posições expiram após dois minutos. O mapa OpenStreetMap exige internet e só carrega ao clicar em Ver no mapa.

Não há transferência bancária, conferência automática de PIX, estornos, recuperação de senha ou push nativo. Pedidos encerrados não são reescritos. Publicação externa exige TLS, segredos gerenciados, backups, monitoramento e as demais medidas descritas em docs/ARQUITETURA.md.

Referências: [Vite](https://vite.dev/guide/), [Tailwind](https://tailwindcss.com/docs/installation/using-vite), [Socket.IO](https://socket.io/docs/v4/redis-adapter), [Prisma 6](https://www.prisma.io/docs/orm/v6/overview/databases/postgresql).

## Taxas por loja e cobrança inclusiva

Em **Empresas parceiras → Taxas por bairro**, o administrador escolhe o bairro e salva a taxa de entrega e o adicional de retorno exclusivos da loja. Todos os bairros ativos continuam disponíveis para todas as lojas. Sem personalização, vale a taxa padrão do bairro. Alterar o padrão afeta somente próximas chamadas de lojas sem personalização; alterar uma tarifa da loja não modifica pedidos existentes. Os ganhos do entregador continuam definidos no cadastro do bairro.

Na abertura, somente a loja autenticada pode criar o pedido. **Pago** mostra a taxa, sem campo de valor. **A receber** solicita forma de pagamento e o total a recolher, incluindo a taxa; a taxa aparece separada para conferência. Exemplo: total R$ 100 e taxa R$ 7 resultam em cobrança de R$ 100 e produto calculado de R$ 93. A forma prevista é confirmada pelo entregador na conclusão.

## Portal das empresas

Acesse **http://localhost:3002/empresa**. A administração cria a loja e seu acesso em **Empresas parceiras → Cadastrar empresa**, informando e-mail e senha inicial. A empresa entra com essas credenciais e é encaminhada ao seu resumo. Não há auto-cadastro público.

O portal reúne:
- Resumo de chamadas abertas no período, chamadas ativas e total histórico.
- Taxas das entregas concluídas no período, recebimentos em dinheiro e pagamentos diretos à loja.
- Saldo atual a receber da administração (ou a pagar), incluindo corridas ainda sem fechamento e fechamentos pendentes, sem duplicar valores.
- Repasses recebidos pela data de quitação, histórico de acertos e referências de comprovantes em Financeiro.
- Nova chamada, acompanhamento e histórico das entregas, exportação do resumo em CSV.
- Consulta das tarifas da própria loja e dos dados cadastrais. Somente o administrador altera taxas, inclusive pela API.

O período é interpretado em America/Fortaleza. Chamadas são contadas por abertura; gastos de frete por conclusão; repasses recebidos por quitação. O saldo atual considera todo o histórico e não muda ao filtrar o período. PIX/cartão direto à loja não entram como dinheiro a repassar. Acertos negativos representam dívida da loja com a central. A quitação registra conferência e não realiza transferência bancária.

## Controle administrativo de acesso

Na tela de login, escolha **Entrar como ADM** ou **Entrar como Empresa**. Entregadores mantêm o acesso pelo link **Sou entregador**. A API valida se o perfil corresponde à opção escolhida; escolher ADM não concede privilégios. Integrações anteriores podem omitir `area`, sem mudar as permissões do usuário.

No topo do painel do administrador, **Desligar empresas / Ligar empresas** controla o acesso de todas as lojas. É uma pausa geral persistida no banco, sem alterar os estados individuais das empresas. Ao desligar, lojas conectadas são avisadas e desconectadas; novas entradas e requisições ficam bloqueadas. Administradores, operadores e entregadores continuam trabalhando. Ao religar, empresas individualmente inativas ou excluídas permanecem bloqueadas.

Em Empresas parceiras, o ícone de lixeira abre **Excluir empresa** com confirmação. A exclusão é lógica: remove a loja da listagem operacional, desativa seu usuário e preserva pedidos, valores pendentes e repasses. CPF/CNPJ e e-mail ficam reservados ao histórico; não é possível reativar a empresa excluída pelo botão comum de ativação. Quitações históricas continuam disponíveis à administração.

Erros de cadastro agora diferenciam e-mail duplicado, CPF/CNPJ duplicado, vínculo de usuário, registro ausente e conflito concorrente. Um cadastro de empresa malsucedido não deixa usuário órfão. Os campos preenchidos permanecem no formulário para correção.

## Relatórios e caixa diário (30/10/2026)

No menu **Relatórios**, escolha chamadas, repasse de empresas ou repasse de entregadores. Defina o período em horário de Fortaleza e clique em **Gerar relatório**. O CSV e a impressão/PDF usam o resultado gerado; alterar filtros exige gerar novamente. A impressão usa folha A3 horizontal para acomodar todas as colunas. Consultas acima de 10.000 chamadas pedem um intervalo menor, sem exportar resultados truncados.

**Fazer Repasse** consulta entregas ainda não quitadas; **Não Fazer Repasse** consulta as já quitadas. Esses filtros não executam pagamentos. A quitação continua sendo uma conferência manual com referência do comprovante no Financeiro/Caixa.

- O RotaJá registra chamadas, com um número único compartilhado entre pedido e chamada. Não há catálogo de pedidos separado.
- Comissão de chamadas = taxa comercial registrada − ganho fixo registrado do entregador. O percentual exibido é a proporção efetiva dessa diferença sobre as taxas do período. Não é aplicada a comissão de 12% do sistema de referência.
- Comissão de cobrança e taxa de serviço são zero: esses encargos não são cobrados atualmente. Vales, acréscimos avulsos, devolvidos e perdas arcadas não têm lançamento no modelo atual e aparecem como **— (não disponível)**, não como movimentações inventadas. Retorno contratado não equivale a devolução.
- Saldo da empresa = dinheiro recebido em custódia − taxas de entrega. PIX, cartão e pagamento online vão diretamente para a loja. Nunca somar esses valores novamente ao repasse.
- Relatórios de chamadas filtram a data de criação; repasses usam a conclusão. Pedidos não concluídos não produzem saldo financeiro.

Em **Caixa diário**, abra o caixa com entregador, início, valor inicial e observações. Só é permitida uma abertura em andamento por entregador. Não é permitido abrir antes do último fechamento. Caixas abertos aparecem mesmo fora do filtro de datas.

Ao fechar, confira sistema versus informado para dinheiro, cartão, Pix e online. A prévia fixa o fim do período; entregas concluídas depois desse instante ficam para o próximo fechamento. O próximo período pode começar exatamente no fim do anterior para não deixar intervalos descobertos. Aberturas iniciadas à meia-noite incluem as entregas concluídas desde esse horário.

**Esperado = total no sistema + abertura + outros + pós meia-noite − fechamento parcial. Diferença = informado − esperado.** A abertura é dinheiro de troco; inclua-a no dinheiro informado. Cartão/Pix/online representam a conferência dos recebimentos da loja, não dinheiro físico do entregador. Parcial significa retirada já conferida. Ajustes e diferenças exigem observação. Ganhos de entrega ficam separados dessa comparação e o saldo para o ADM conserva a regra dinheiro em custódia − ganhos.

Salvar cria um fechamento pendente com cópia imutável dos valores, observações, autor e data. A operação valida a quitação com comprovante. Fechamentos antigos continuam disponíveis, identificados como sem conferência detalhada. O índice parcial no PostgreSQL impede duas aberturas simultâneas mesmo sob concorrência.

O botão **Sair** no topo revoga a sessão no Redis, remove o cookie HttpOnly e desconecta os canais de tempo real. Não há token persistido no armazenamento do navegador.

Validação adicional: `npx tsx scripts/verificar-relatorios.ts` e `npm --prefix web run test:e2e -- relatorios.spec.ts`. Os testes criam cadastros e movimentações fictícias identificadas como teste no banco local.

## Registro de Caixa — 03/11/2026

A aba inicial é **Fech. Pendentes**. As seis abas são Abertura de Caixa, Fech. Pendentes, Fech. Concluídos, Fech. Geral, Fech. Geral Concluído e Registro de Troco. Operação acessa todas; entregador acessa apenas seus próprios caixas, sem registrar trocos ou acertos administrativos.

Os filtros usam um dia de Fortaleza (padrão: hoje) e entregador. Caixas abertos de turnos anteriores permanecem pendentes até o acerto; a coluna Total no sistema mostra apenas as corridas do dia selecionado, enquanto o fechamento definitivo confere todo o turno. Abertura discrimina fundo inicial, saldo de troco e recebimentos das corridas. Fechamentos quitados são consultados pelo dia do fim do período (fim exclusivo à meia-noite pertence ao dia anterior).

**Disponível** exige entregador e usuário ativos e nenhuma corrida atribuída/em andamento. O servidor também bloqueia o fechamento se houver corrida ativa, mesmo que o botão tenha sido habilitado antes do despacho.

O lápis registra acertos parciais com valores separados por dinheiro, Pix, cartão e online. O gráfico mostra seus totais e histórico. Valores já conferidos são descontados da conferência seguinte. O ícone de caixa abre o fechamento definitivo. Troco de entrada aumenta o dinheiro em poder do entregador; troco de saída representa devolução à central. Trocos e parciais preservam autor, observação e horário; chaves de idempotência evitam duplicação. Não é permitido retirar ou conferir mais que o saldo disponível. Lançamentos não são apagados ou editados retroativamente.

**Saldo restante para ADM no caixa diário = dinheiro recebido + fundo inicial + troco líquido − ganhos − parciais em dinheiro.** Pix/cartão/online continuam diretamente com a loja. Esta fórmula substitui a simplificação da seção anterior para caixas com abertura; caixas antigos são preservados. A diferença de conferência continua separada, sem alterar automaticamente o valor das entregas. O parcial exibido na modal vem dos lançamentos, não de um campo livre.

Fech. Geral mostra a movimentação do dia e os totais por forma de pagamento. O dinheiro após parciais é um total anterior ao acerto final, não saldo bancário. Encerrar exige dia terminado e todos os caixas daquele dia quitados. O encerramento sempre inclui toda a operação, mesmo com filtro individual, e arquiva uma fotografia imutável com autor/data/observação. Novas aberturas ou fechamentos retroativos no dia encerrado são rejeitados. Não há transferência bancária automática.

### Fluxo simplificado e entregadores (03/11/2026)
Novos chamados entram como PRONTO. O despacho exige entregador ativo com abertura de caixa vigente (id_cx nulo), inclusive em turnos que atravessam a meia-noite. Após atribuir: Aceitar → A recolher; Recolhido → Enviando; Finalizar Entrega → Concluído. Corridas com retorno são finalizadas após completar também o retorno, na mesma ação. Estados intermediários antigos continuam legíveis, mas não são novas etapas.

GET /entregadores?caixa_aberto=true alimenta as seleções de despacho e repasse. Consultas financeiras mantêm os registros históricos. DELETE /entregadores/:id é exclusivo do administrador: bloqueia caixa aberto, caixa não quitado, corrida ativa e corrida concluída sem acerto. A exclusão é lógica: preserva CPF, e-mail, pedidos e finanças; desativa o acesso e desconecta a sessão. Não permite reativação pelo cadastro de usuários.
