# Validação local — 27/10/2026

Ambiente iniciado via Docker Compose no Windows, com API Node, PostgreSQL 17 e Redis 7.4. Migração `202610270001_inicial` aplicada com sucesso e administrador criado pelo seed. Senhas aleatórias estão no `.env` local, excluído do Git.

- API: `http://localhost:3001/saude`.
- PostgreSQL: `127.0.0.1:55432` (5432 estava ocupada por outro serviço).
- Redis: `127.0.0.1:6379`.
- Compilação TypeScript aprovada e quatro testes unitários aprovados.
- Teste integrado aprovado com banco e Redis reais: login, cadastro de empresa/entregador/bairro, pedido idempotente, rejeição de bairro inexistente, despacho por Socket.IO, avanço da corrida, conclusão com dinheiro, fechamento e quitação de caixa, repasse e quitação, histórico e logout.
- Pedido sintético #1 preservado para inspeção. Produto R$ 93, frete e ganho R$ 7, cobrança R$ 100, saldo do caixa R$ 93 e repasse à loja R$ 93.

Reproduzir: `npm run local` e depois `npm run test:integracao`. Cada teste integrado cria seu próprio conjunto de dados sintéticos e os preserva.

## Frontend integrado — versão 0.2.0

- Frontend React/Vite/Tailwind compilado e servido por Nginx em `http://localhost:3002`.
- Fluxo de navegador aprovado em desktop e viewport mobile de 390px: administrador cadastra loja, entregador e bairro; cliente abre pedido com cobrança; operação despacha por socket; entregador aceita e conclui todas as etapas; caixa exibe os R$ 93 esperados e cliente encontra a corrida no histórico.
- Sessão por cookie HttpOnly permanece após recarregar. Cliente não acessa usuários administrativos (403). Logout remove a sessão.
- Login sem rolagem horizontal no celular. Capturas de desktop e mobile inspecionadas visualmente.
- Windows PowerShell: inicializador compatível com .NET Framework, cria senhas sem depender de APIs exclusivas do PowerShell 7. Docker aplica migração e seed automaticamente.
- Serviços de execução com healthcheck: web, API, PostgreSQL e Redis. Migração/seed são tarefas que encerram com código zero.
- Rate-limit original preservado; eventos e ações simultâneas são agrupados no frontend para evitar consultas duplicadas.
- Vite atualizado para 6.4.5; validação e rate-limit da API atualizados para versões corrigidas.
- Resultado final: **3 testes de navegador, 4 testes unitários e teste integrado da API aprovados**. O terceiro teste de navegador gera caixa e repasse, confirma ambos com comprovantes e baixa o CSV. O inicializador real foi executado pelo Windows PowerShell com sucesso.
- Auditoria do frontend: zero alertas na verificação realizada. Alertas remanescentes de ferramentas Prisma descritos abaixo.

O nativo Expo continua como integração de referência, sem homologação em aparelho. Nenhum teste simula transferência bancária real.

### Dependências de ferramentas

A auditoria identificou alertas transitivos na cadeia do Prisma CLI 6 (`@prisma/config`, `deepmerge-ts`, `effect`). Não foi aplicado upgrade forçado para Prisma 7, que exige adaptação própria. O CLI processa apenas o schema e a configuração locais nesta stack. A migração de versão deve ser planejada antes de publicação em produção. Os demais alertas identificados nas dependências diretas Vite, Zod e express-rate-limit foram corrigidos nesta entrega.
