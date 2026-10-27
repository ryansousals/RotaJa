# Versionamento

Execute `powershell -File scripts/iniciar-git.ps1`. Configure sua identidade com `git config user.name "Seu nome"` e `git config user.email "seu@email"`.

Commits sugeridos, executados após revisão:

```powershell
git add .gitignore .dockerignore .env.example package.json package-lock.json tsconfig.json scripts
git commit -m "chore(base): configura projeto TypeScript e convencoes"
git add prisma
git commit -m "feat(banco): modela pedidos cadastros caixa e repasses"
git add src tests
git commit -m "feat(api): implementa chamados despacho e fechamento de caixa"
git add Dockerfile docker-compose.yml
git commit -m "chore(docker): integra api postgres e redis"
git add exemplos docs README.md
git commit -m "docs(arquitetura): documenta fluxos e exemplos das interfaces"
```

Não versionar senhas, arquivos `.env`, dados reais ou dumps. Migrações são versionadas. Branches por módulo, revisão por PR e validação de schema, compilação e testes antes da integração. O repositório local foi inicializado e versionado a pedido do usuário; envio para um remoto depende da configuração do destino.
