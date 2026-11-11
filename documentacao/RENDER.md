# Publicação gratuita de avaliação: Render + Neon

Esta opção dispensa a criação de uma máquina Oracle. Usa Render Web Service Free, Render Key Value Free e Neon Free. Não crie PostgreSQL gratuito no Render: ele expira em 30 dias. O serviço web dorme após 15 minutos sem tráfego e pode demorar cerca de um minuto para voltar. O Redis gratuito perde sessões e posições GPS temporárias ao reiniciar; pedidos e finanças permanecem no PostgreSQL. A própria Render desaconselha o plano gratuito para produção.

## 1. Banco no Neon

Crie sua conta em https://console.neon.tech/signup e um projeto Free chamado RotaJa. Escolha PostgreSQL 17 e, se disponível, Frankfurt para ficar próximo ao Render. No botão Connect, copie somente a URL PostgreSQL, sem `psql` e sem aspas. Use a conexão direta (pooling desligado), com `sslmode=require`, pois ela também será usada nas migrações. Guarde a URL como segredo; não a envie pelo chat ou coloque no Git.

## 2. Render

Crie a conta em https://dashboard.render.com/register com GitHub. Autorize acesso ao repositório `ryansousals/RotaJa`. Use New > Blueprint, selecione o repositório e o arquivo `render.yaml` na branch main.

Preencha os três campos solicitados:

- DATABASE_URL: URL secreta do banco Neon.
- ADMIN_EMAIL: e-mail que usará no login do RotaJá.
- ADMIN_SENHA: senha única com pelo menos 16 caracteres.

Confira que os dois serviços estão no plano Free antes de aplicar. O projeto usa somente um Key Value gratuito; se já houver outro no workspace, não exclua dados para liberar a vaga. Pare e revise a configuração. Se o provedor exigir plano pago no cadastro, não prossiga com contratação automática.

## 3. Aguardar a publicação

O Docker compila a interface e a API. Ao iniciar, aplica migrações e cria administrador/bairros sem copiar dados locais. A URL `https://…onrender.com` aparece no painel. Ela serve o site, `/api` e `/socket.io` no mesmo endereço. HTTPS é gerenciado pela Render. O nome exato da URL pode ter um sufixo.

Teste `/api/saude`, login, logout e conexão em tempo real. Cadastre uma loja e entregador de avaliação antes de usar o fluxo de entrega. O computador local pode ficar desligado. Não se configura Caddy nem `compose.producao.yml` nessa modalidade.

Se usar domínio próprio depois, defina WEB_ORIGINS com o endereço HTTPS exato (ou lista separada por vírgula) e publique novamente. Sem essa variável, a aplicação aceita a URL RENDER_EXTERNAL_URL fornecida pela hospedagem.

## Limites e dados

O plano Neon Free tem cotas de armazenamento, computação e tráfego. Acompanhe-as no painel; não são recursos ilimitados. Não importe a base local sem revisar os dados de teste. Guarde backups periódicos fora do provedor com `pg_dump` compatível com a versão do PostgreSQL. A rotina `copiar-banco.sh` pertence à instalação em servidor próprio e não funciona diretamente com Neon.

Esta configuração não contrata recursos pagos. Para operação real contínua, escolha recursos com capacidade e disponibilidade adequadas antes de colocar lojas dependentes do sistema.

Referências verificadas: https://render.com/docs/free, https://render.com/docs/blueprint-spec, https://neon.com/pricing.
