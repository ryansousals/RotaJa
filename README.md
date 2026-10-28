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

Empresa e entregador são cadastrados junto com o usuário em uma transação. O menu Ajuda explica o ciclo. Sem chamados ativos, use Nova chamada como operador ou entre pelo usuário da loja. Não há auto-cadastro público.

## Financeiro

A_RECEBER cobra produto + frete; PAGO considera pagamento na loja. Ganho do entregador difere da taxa comercial. Na conclusão, a forma de recebimento distingue dinheiro em custódia de pagamento direto à loja.

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
