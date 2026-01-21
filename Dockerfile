# Imagem base
FROM node:20-alpine

# Ativa corepack (pnpm)
RUN corepack enable

# Diretório da app
WORKDIR /app

# Copia arquivos essenciais
COPY package.json pnpm-lock.yaml ./

# Instala dependências
RUN pnpm install --frozen-lockfile

# Copia o restante do código
COPY . .

# Build do backend
RUN pnpm build:api

# Porta do app
ENV PORT=5000
EXPOSE 5000

# Start
CMD ["pnpm", "start"]
