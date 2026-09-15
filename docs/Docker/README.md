# Comandos do Projeto

Documentação dos comandos disponíveis via `Makefile` para build e execução da aplicação com Docker.

## Pré-requisitos

- [Docker](https://docs.docker.com/get-docker/) instalado
- `make` instalado (já vem por padrão no Linux/macOS; no Windows, use WSL ou instale via chocolatey)

## Comandos disponíveis

### `make build`

Constrói a imagem Docker da aplicação a partir do `Dockerfile` presente na raiz do projeto.

Faz:
```bash
docker build -t nome-da-imagem:latest .
```

- Lê o `Dockerfile` e executa cada instrução (baixar imagem base, copiar arquivos, instalar dependências, etc)
- Gera uma imagem local nomeada `nome-da-imagem:latest`
- O `.` no final indica que o contexto de build é a pasta atual

**Como rodar:**
```bash
make build
```

---

### `make run`

Sobe um container a partir da imagem já construída.

Faz:
```bash
docker run -p 3000:3000 nome-da-imagem:latest
```

- Cria e inicia um container com base na imagem `nome-da-imagem:latest`
- Mapeia a porta 3000 do container para a porta 3000 da sua máquina (`host:container`)
- A aplicação fica acessível em `http://localhost:3000`

**Como rodar:**
```bash
make run
```

> ⚠️ É preciso rodar `make build` pelo menos uma vez antes, para que a imagem exista.

---

### `make stop`

Para o container em execução.

Faz:
```bash
docker stop nome-da-imagem || true
```

- Envia um sinal de parada para o container
- O `|| true` evita que o comando falhe (com erro no terminal) caso o container já esteja parado ou não exista

**Como rodar:**
```bash
make stop
```

---

### `make clean`

Remove a imagem Docker construída, liberando espaço em disco.

Faz:
```bash
docker rmi nome-da-imagem:latest || true
```

- Apaga a imagem local
- Não afeta o código-fonte, apenas a imagem gerada pelo build
- Útil quando você quer forçar um build totalmente do zero

**Como rodar:**
```bash
make clean
```

---

### `make rebuild`

Atalho que executa `clean` e depois `build`, útil quando algo no cache do Docker está causando comportamento estranho.

Faz:
```bash
make clean
make build
```

**Como rodar:**
```bash
make rebuild
```

## Personalizando nome da imagem e tag

O `Makefile` usa variáveis para o nome da imagem e a tag, então dá pra sobrescrever na hora de rodar sem editar o arquivo:

```bash
make build IMAGE_NAME=minha-app TAG=v2
make run IMAGE_NAME=minha-app TAG=v2
```

## Comandos úteis do Docker (fora do Makefile)

| Comando | O que faz |
|---|---|
| `docker images` | Lista todas as imagens construídas localmente |
| `docker ps` | Lista os containers em execução |
| `docker ps -a` | Lista todos os containers, incluindo os parados |
| `docker logs <container>` | Mostra os logs de um container |
| `docker exec -it <container> sh` | Abre um terminal interativo dentro do container |