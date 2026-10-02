# Frontend

## Configuração do Ambiente

Instale o [Bun](https://bun.com/). É o runtime e o gerenciador de pacotes usado neste projeto, tanto no frontend quanto no backend.

Em seguida, instale as dependências do projeto:

```bash
bun install
```

Para rodar, basta usar:

```bash
bun dev
```

Para o fluxo completo com banco e API, veja o [README da raiz](../README.md).

## Lint

O projeto usa [Oxlint](https://oxc.rs), configurado em `.oxlintrc.json`. Ele também roda no pre-commit.

```bash
bun run lint       # aponta os problemas
bun run lint:fix   # corrige o que for automático
```

## Gerenciamento de Dependências

Para adicionar uma nova dependência de produção, use:

```bash
bun add <package-name>
```

Para adicionar uma nova dependência de desenvolvimento, use:

```bash
bun add -D <package-name>
```

Para remover uma dependência, use:

```bash
bun remove <package-name>
```
