# Publicação do RotaJá

## Situação

Arquivos preparados para um servidor Linux com Docker Compose. A publicação pública depende da criação da conta, servidor e endereço DNS. Nenhum recurso pago é contratado pelas rotinas. O compose de produção é independente do local e usa volumes separados.

## Conta e servidor gratuitos

1. Crie sua própria conta em https://www.oracle.com/cloud/free/. A validação de identidade e cartão deve ser feita pelo titular.
2. Na região principal, crie Ubuntu em uma máquina Ampere A1 dentro da franquia Always Free apresentada no console. Confira os limites atuais e a estimativa antes de criar. A disponibilidade de capacidade não é garantida.
3. Guarde a chave SSH na sua máquina. Não a coloque no repositório. Libere SSH somente para seu IP e TCP 80/443 para o site, tanto na rede Oracle quanto no firewall do Ubuntu. UDP 443 é opcional para HTTP/3. Não exponha PostgreSQL, Redis ou API.
4. Escolha um domínio ou subdomínio gratuito de um provedor DNS e aponte-o para o IP público do servidor. Remova registros IPv6 incorretos. Não é necessário comprar domínio para usar um subdomínio gratuito.
5. Instale Docker Engine e o plugin Compose seguindo https://docs.docker.com/engine/install/ubuntu/. O usuário SSH precisa ter permissão para executar Docker.

## Instalação

Envie a versão atual do projeto ao servidor (ou clone o GitHub depois de confirmar que as mudanças locais foram publicadas). A pasta deve conter `servidor`, `interface` e `compose.producao.yml`.

```bash
cp infraestrutura/producao.env.example .env.producao
chmod 600 .env.producao
nano .env.producao
# Preencha DOMINIO sem protocolo, e-mail e senhas únicas.
# Para a senha do banco, use a saída de: openssl rand -hex 32
# Senha do administrador: pelo menos 16 caracteres.
bash rotinas/publicar.sh
```

O banco inicia com administrador e bairros oficiais. Não copia cadastros, pedidos ou usuários de teste locais. O seed não redefine a senha de um administrador existente. Uma migração de dados locais deve ser planejada e conferida separadamente.

Caddy obtém e renova HTTPS após o DNS apontar para o servidor e as portas estarem abertas. A interface, API e Socket.io usam o mesmo domínio. Cookies são HttpOnly, Secure e SameSite=Strict. A API confia em um único proxy; ela não pode ter porta pública ou acesso direto externo. Não coloque outro proxy/CDN à frente sem revisar essa configuração.

## Conferência após publicar

```bash
curl --fail https://SEU_DOMINIO/api/saude
docker compose --env-file .env.producao -f compose.producao.yml ps
```

Confira login/logout, conexão em tempo real, chamada como loja, atribuição de entregador e relatório. Habilite o acesso das empresas no painel apenas após a conferência. Certificado público e login por HTTPS precisam ser testados no servidor real.

## Backups e atualizações

```bash
bash rotinas/copiar-banco.sh
```

A rotina cria um arquivo PostgreSQL e verifica seu catálogo com `pg_restore`. Isso não substitui um ensaio de restauração. Copie backups para outro equipamento; o servidor gratuito pode ser recuperado pelo provedor.

Para agendar diariamente, use `crontab -e` no usuário com acesso ao Docker (ajuste o caminho real):

```cron
0 3 * * * cd /opt/rotaja && bash rotinas/copiar-banco.sh >> /opt/rotaja/backups-agendamento.log 2>&1
```

O agendamento não é instalado automaticamente. Monitore espaço e falhas; não há exclusão automática de cópias. Antes de atualizar o código, faça backup; depois execute `bash rotinas/publicar.sh`. A rotina também faz backup se o banco já estiver ativo. Nunca use `down -v` em produção: apagaria os volumes.

Para restaurar, use uma base isolada primeiro e valide contagens e relatórios. A restauração sobre produção exige interromper gravações e decidir quais dados serão substituídos; por isso não há comando destrutivo automático.

Referências: https://caddyserver.com/docs/automatic-https e https://expressjs.com/en/guide/behind-proxies/.
