FROM oven/bun:1.4.2

WORKDIR /app

# manifesto primeiro: o install só reroda quando as dependências mudam
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

EXPOSE 3000
CMD ["bun", "run", "start"]
