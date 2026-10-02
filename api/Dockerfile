FROM oven/bun:1.4.2

WORKDIR /app

# manifesto primeiro: o install só reroda quando as dependências mudam
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY . .

EXPOSE 3333
CMD ["bun", "run", "infra/server.ts"]
