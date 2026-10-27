# RotaJá — gestão de entregas

Base de referência em TypeScript com API Express, PostgreSQL/Prisma, Redis e Socket.IO. Inclui arquitetura, migração inicial, Docker e exemplos React/Next e Expo inspirados nos fluxos dos prints fornecidos.

## Escopo entregue

A API implementa sessões, usuários, empresas, entregadores, bairros, pedidos, edição administrativa auditada, despacho, estados da corrida, GPS, fechamento de caixa e repasses. `exemplos/` contém componentes de integração, não aplicações completas publicadas. Leia as limitações em [arquitetura](docs/ARQUITETURA.md) antes de usar dados reais.

## Iniciar no Windows

Requisitos: Node 22+, npm e Docker Desktop com contêineres Linux.

Inicialização automatizada: `npm run local`. O script cria `.env` com senhas aleatórias se necessário, sobe os contêineres, instala as dependências locais e cria o administrador. O banco usa a porta local **55432** para evitar conflito com instalações existentes. Credenciais ficam apenas no `.env`, ignorado pelo Git. Para trocar a senha de um volume já inicializado é necessário alterar a senha também no banco; editar `.env` sozinho não altera dados existentes.

```powershell
Copy-Item .env.example .env
# Edite .env: senhas, origens e endereço do administrador.
npm ci
npm run db:gerar
docker compose up -d db cache
npx prisma migrate deploy
npm run db:seed
npm run dev
```

API: `http://localhost:3001/saude`. Para contêineres: `docker compose up --build -d`. O serviço `migracao` aplica o schema antes da API. A criação do administrador é explícita: execute o seed pelo host com o banco acessível. Nunca use uma senha de exemplo em produção. Caracteres especiais da senha precisam ser codificados na URL de conexão; no Compose, prefira senha aleatória alfanumérica ou altere a montagem da URL para secrets.

```powershell
npm run build
npm test
npx prisma validate
npm run test:integracao
```

O teste integrado exige os serviços e o administrador ativos e cria registros sintéticos identificados como teste: loja, entregador, bairro, pedido concluído, caixa e repasse quitados. Ele verifica o despacho real por WebSocket, idempotência, restrição de bairro e revogação de sessão. Os registros são preservados para inspeção; execute apenas na base local de desenvolvimento.

Para consultar os serviços: `docker compose ps`. Para parar preservando dados: `docker compose stop`. Para voltar a iniciar: `docker compose up -d`. Não há aplicação web completa na porta 3000 nesta entrega: o serviço executável é a API na porta 3001.

## Primeiro fluxo

1. `POST /autenticacao/entrar` com `eml_usr` e `senha`; envie o token retornado em `Authorization: Bearer TOKEN`.
2. Operador cria usuários via `POST /usuarios`, vinculando remetente em `/empresas` e entregador em `/entregadores`.
3. Operador cria `/bairros` com preços e ganhos, inclusive valores de retorno.
4. Remetente consulta `/bairros`, abre `/pedidos` e acompanha `/pedidos` e os eventos.
5. Operador usa `pedido:despachar` no socket autenticado; entregador avança por `POST /pedidos/status`.
6. Ao concluir, registre `tp_rec` quando houver cobrança. Encerre o período em `/caixas/fechar` e confirme a prestação em `/caixas/:id/quitar`.

Exemplo de abertura (dinheiro enviado como string decimal):

```json
{
  "id_bai": "UUID_DO_BAIRRO",
  "chave_idem": "identificador-unico-do-formulario",
  "nom_dest": "Maria Silva",
  "tel_dest": "5589999999999",
  "log_dest": "Rua das Flores",
  "num_dest": "120",
  "tp_end": "ENTREGA",
  "st_ret": false,
  "st_pag": "A_RECEBER",
  "vlr_prod": "93.00"
}
```

Com frete de R$ 7,00, a cobrança será R$ 100,00. O cliente não envia taxa nem ganho do motoboy: a API obtém os valores do bairro e guarda o snapshot no pedido. Reenvios devem preservar a chave e os dados; altere a chave quando editar o formulário após uma tentativa rejeitada ou um pedido criado.

## Arquivos

- [Schema em português](prisma/schema.prisma)
- [Infraestrutura](docker-compose.yml) e [Dockerfile](Dockerfile)
- [Serviços de domínio](src/servicos.ts) e [API e sockets](src/servidor.ts)
- [Arquitetura, segurança e evolução](docs/ARQUITETURA.md)
- [Contratos e interfaces](docs/CONTRATOS.md)
- [Git e commits em português](docs/GIT.md)

Referências técnicas: [Prisma 6 / PostgreSQL](https://www.prisma.io/docs/orm/v6/overview/databases/postgresql), [transações](https://www.prisma.io/docs/orm/v6/prisma-client/queries/transactions), [Socket.IO Redis adapter](https://socket.io/docs/v4/redis-adapter). As versões foram fixadas no projeto para permitir reprodução; atualizações devem passar por revisão e testes.
