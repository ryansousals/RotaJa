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
