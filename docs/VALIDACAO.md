# Validação local — 27/10/2026

Ambiente iniciado via Docker Compose no Windows, com API Node, PostgreSQL 17 e Redis 7.4. Migração `202610270001_inicial` aplicada com sucesso e administrador criado pelo seed. Senhas aleatórias estão no `.env` local, excluído do Git.

- API: `http://localhost:3001/saude`.
- PostgreSQL: `127.0.0.1:55432` (5432 estava ocupada por outro serviço).
- Redis: `127.0.0.1:6379`.
- Compilação TypeScript aprovada e quatro testes unitários aprovados.
- Teste integrado aprovado com banco e Redis reais: login, cadastro de empresa/entregador/bairro, pedido idempotente, rejeição de bairro inexistente, despacho por Socket.IO, avanço da corrida, conclusão com dinheiro, fechamento e quitação de caixa, repasse e quitação, histórico e logout.
- Pedido sintético #1 preservado para inspeção. Produto R$ 93, frete e ganho R$ 7, cobrança R$ 100, saldo do caixa R$ 93 e repasse à loja R$ 93.

Reproduzir: `npm run local` e depois `npm run test:integracao`. Cada teste integrado cria seu próprio conjunto de dados sintéticos e os preserva. Frontends e app mobile permanecem exemplos de integração; não foram compilados nem homologados como aplicações completas.
