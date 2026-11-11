FROM node:22-bookworm-slim AS dependencias
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY servidor ./servidor
FROM dependencias AS migracao
CMD ["npx", "prisma", "migrate", "deploy"]
FROM dependencias AS dependencias_producao
RUN npm prune --omit=dev --ignore-scripts --no-audit --no-fund
FROM node:22-bookworm-slim AS producao
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
COPY --from=dependencias_producao /app/node_modules ./node_modules
COPY --from=dependencias /app/servidor ./servidor
COPY package.json ./
USER node
EXPOSE 3001
CMD ["node", "servidor/servidor.js"]
