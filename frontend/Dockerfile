FROM oven/bun:1.4.2

WORKDIR /app

# manifesto primeiro: o install só reroda quando as dependências mudam
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
# endereço da API que o navegador chama; o Next o embute no build
ARG NEXT_PUBLIC_API_URL=http://localhost:3333
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN bun run build

EXPOSE 3000
CMD ["bun", "run", "start"]
