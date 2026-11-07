# Visual leve: paleta, tipografia e formas do front

Branch `chore/visual-leve`, a partir da `main` depois da HU-33 (#120). Só o front muda. Nenhuma rota, regra de negócio ou história muda.

## Objetivo

Deixar o Zovic mais moderno, leve e bonito sem perder a identidade que já existe: a capa de disco na cor da playlist, com a moldura impressa e as iniciais, e o player em perspectiva.

## Diagnóstico

O que pesa hoje, medido no código da `main`:

| Problema | Onde | Efeito |
| --- | --- | --- |
| Fundo creme `#efe7d8`, vermelho `#d33a2c` e sombras em marrom | `app/globals.css` | Quente e denso. É o visual mais comum de página gerada por IA |
| O vermelho é `--primary`, `--destructive` e `--ring` ao mesmo tempo | `app/globals.css` | "Começar a ouvir" tem a cor de "Excluir" |
| 60 usos de `font-mono` em rótulos, contagens e tempos | 17 arquivos | Ar técnico, de terminal |
| `text-[9px]`, `text-[10px]` e `text-[11px]` | 12 arquivos, quase tudo na barra | Texto pequeno demais para ler |
| Inter sem escala, com `medium`, `semibold` e `bold` misturados | todo o front | Hierarquia sem regra |
| Oito sombras escritas à mão com `rgba(23,21,18,0.45)` | 6 arquivos | Peso, e a paleta não muda num lugar só |
| Botão `default` com `h-7 text-xs`, e cada página corrige o tamanho | `components/ui/button.tsx` | Botões de quatro alturas diferentes |
| Presets de cor do Tailwind, com luminosidades diferentes, e um chamado "Clássico Spotify" | `components/color-picker.tsx` | As capas lado a lado não formam um conjunto |
| O título da aba é "Frontend" | `app/layout.tsx` | Aparece na apresentação |
| "Carregando…" em texto nas seções | `/inicio`, `/album`, `/genero`, `/historico` | A página pula quando os dados chegam |
| "→" no fim dos links | `/inicio` | Detalhe de modelo pronto |

## Direção

**A loja é clara, as capas dão a cor.** Como numa parede de discos, a interface fica neutra e clara. A cor aparece só nas capas, nas playlists, nos gêneros e no que está tocando. A ousadia fica num lugar só, o player.

### Cores

| Token | Hoje | Novo | Contraste |
| --- | --- | --- | --- |
| `--color-paper` (fundo) | `#efe7d8` | `#F3F4F1` | |
| `--color-paper-bright` (superfície) | `#f8f3e7` | `#FFFFFF` | |
| `--color-ink` (texto) | `#171512` | `#191B1F` | 15,6:1 no fundo |
| `--muted-foreground` | `#565043` | `#5E636B` | 5,5:1 no fundo |
| `--muted` | `#b9ad91` | `#D9DCD6` | |
| `--color-rule` (linha) | `#c9bfa9` | `#E2E4E0` | |
| `--color-teal` (principal) | `#1e7f82` | `#1A7173` | 5,2:1 no fundo, 5,8:1 com texto branco |
| `--color-red` (excluir e admin) | `#d33a2c` | `#C4372B` | 4,8:1 no fundo |

- `--primary` e `--ring` passam a ser o teal. `--destructive` continua no vermelho.
- A cor padrão do que toca fora de uma playlist (`DEFAULT_COLOR` da barra) também passa ao teal.
- A bolinha do admin e o painel de admin continuam em `--color-red`, como hoje.
- O cabeçalho sobre seção escura usa os tokens, não os hex fixos.

### Sombras

Três tokens no `@theme`, todos com `--color-ink` em transparência baixa:

- `--shadow-sm`: `0 1px 2px` a 6%. Para as capas pequenas.
- `--shadow-md`: `0 1px 2px` a 6% mais `0 8px 24px -12px` a 18%. Para os cartões no hover, menus e capas grandes.
- `--shadow-lg`: `0 2px 4px` a 6% mais `0 24px 48px -24px` a 25%. Para a barra flutuante e as cartas do player.

Nenhuma sombra fica escrita à mão nos componentes.

### Tipografia

- **Família:** Instrument Sans, pelo `next/font/google`, com os eixos `wght` (400 a 700) e `wdth` (75 a 100) e os subconjuntos `latin` e `latin-ext`. Não é dependência nova.
- **Títulos** (h1, h2, nomes de playlist e álbum, iniciais das capas): peso 600 e `font-stretch-semi-condensed` (87,5%). A largura separa título de interface, sem uma segunda família.
- **Interface:** peso 400 para texto e 500 para ênfase. Nada de `font-bold` fora dos títulos.
- **Escala:** 12, 14, 16, 20, 28, 40 e 56 px (`text-xs`, `sm`, `base`, `xl`, `[28px]`, `[40px]`, `[56px]`). Nada abaixo de 12 px.
- **Números:** a mesma família com `tabular-nums`. O `font-mono` só fica no `<kbd>` das teclas.

### Formas

| Elemento | Canto |
| --- | --- |
| Botões, chips, conta e botões de tocar | pílula (`rounded-full`) |
| Capas de álbum e de playlist | 6 px (`rounded-md`), quadradas como disco |
| Cartões, menus e barra | 16 px (`rounded-2xl`) |
| Cartas do player | 24 px, como hoje |

Botões: `default` com `h-9 px-4 text-sm` e `lg` com `h-11 px-5 text-base`. As páginas deixam de corrigir o tamanho.

### Cores das playlists

Os presets passam a ser 11 cores com a mesma luminosidade e saturação em OKLCH (L 0,52, C 0,105), mudando só o tom. Todas aceitam texto branco com contraste de pelo menos 5:1. As playlists antigas mantêm a cor que têm. O `getPlaylistAccentStyle` continua escurecendo as cores claras.

| Nome | Cor |
| --- | --- |
| Vermelho-disco | `#9C4E49` |
| Laranja tropical | `#98552C` |
| Ouro bossa | `#886108` |
| Oliva | `#67701C` |
| Verde-mata | `#357A47` |
| Teal Zovic | `#1A7173` |
| Azul-oceano | `#12719C` |
| Anil | `#4B67A5` |
| Violeta | `#6E5B9F` |
| Ameixa | `#8A5186` |
| Grafite | `#404952` |

## Telas e componentes

- **Barra de reprodução:**
  - flutua solta das bordas (`mx-3 mb-3`, `rounded-2xl`), em superfície branca com `--shadow-lg` e sem a borda de cima;
  - o título usa `text-sm font-medium` e o artista `text-xs`;
  - a barra de progresso tem 4 px e mostra um marcador redondo de 12 px no hover e no foco;
  - os tempos usam `text-xs tabular-nums`;
  - o botão de tocar usa a cor de destaque (`bg-primary`), em vez de preto.
- **Carregamento:** um `Skeleton` (`components/ui/skeleton.tsx`) no formato das linhas e das capas, com `motion-safe:animate-pulse`. O texto "Carregando…" continua só para leitores de tela.
- **Gêneros na tela inicial:** blocos sólidos na cor do gênero, com o texto em contraste pelo `getContrastTextColor`, como o `PlaylistTile`.
- **Links "Ver histórico" e "Ver todas":** sem o "→".
- **`/entrar` e `/cadastro`:** o formulário fica sem borda, numa superfície branca com `--shadow-md`.

## O momento marcante: o fundo do player

No `/player`, o fundo da página recebe 9% da cor do que toca: `color-mix(in oklab, <cor> 9%, var(--background))`.

- **Ordem da cor:** a da playlist de origem; sem playlist, a cor do primeiro gênero da faixa atual; sem gênero, o teal.
- **Transição:** a troca dura 700 ms e não acontece com `prefers-reduced-motion`.
- **Escopo:** o resto do app continua neutro.

A cor do gênero sai do catálogo que já está em cache (`GET /musics`). A regra fica numa função pura testada, `ambientColorOf`.

## Testes

- **Presets:** todos com contraste de pelo menos 4,5:1 com texto branco, `getContrastTextColor` igual a `text-white`, nomes únicos e nenhum nome de marca.
- **`ambientColorOf`:** a ordem playlist → gênero → padrão, e os casos de faixa de amostra (id não numérico) e de faixa sem gênero.
- **Conferência visual:** com prints de `/`, `/entrar`, `/inicio`, `/playlist/[id]`, `/player` e `/admin`, em 1440 px e 390 px.

## Fora desta entrega

- **Modo escuro.** O `color-scheme` continua `light`.
- **Extrair a cor da imagem da capa.** O gênero já dá uma cor por faixa, sem processar imagem.
- **Trocar a cor das playlists que já existem.**
- **Mudar o layout das telas.** Esta entrega muda a pele, não a estrutura.

## Combinar com o time

As mudanças de token atingem as telas de todos (admin, comentários, planos). Antes do PR, avisar o time e pedir a revisão de quem cuida de cada área. Com a entrega em 24/11, a ordem do plano permite parar depois de qualquer tarefa com o app consistente.
