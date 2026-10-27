FROM node:22-bookworm-slim AS dependencias
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
FROM dependencias AS compilacao
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
FROM compilacao AS migracao
CMD ["npx", "prisma", "migrate", "deploy"]
FROM node:22-bookworm-slim AS producao
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
COPY --from=compilacao /app/node_modules ./node_modules
COPY --from=compilacao /app/dist ./dist
COPY package.json ./
USER node
EXPOSE 3001
CMD ["node", "dist/servidor.js"]
