# Visual leve: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** trocar a pele creme e pesada do front por uma base neutra e clara, com a Instrument Sans, formas por hierarquia, presets de cor harmônicos, barra flutuante e o fundo do player tingido pelo que toca.

**Architecture:** só o front. A paleta, as sombras e a fonte mudam em um lugar (`globals.css` e `layout.tsx`). Os componentes deixam de ter cor, sombra e tamanho escritos à mão. As duas regras com lógica, os presets e a cor do fundo do player, ficam em código puro testado.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind 4.3, `next/font/google`, `bun test`, oxlint.

**Spec:** [docs/superpowers/specs/2026-11-07-visual-leve-design.md](../specs/2026-11-07-visual-leve-design.md)

## Global Constraints

- **Branch:** `chore/visual-leve`. Commits em Conventional Commits, em português, com escopo `frontend` e o rodapé `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Use `git add` com caminhos explícitos e **nunca** `api/bruno/auth/*.bru`.
- **Nenhuma dependência nova.** A fonte vem do `next/font/google`, que já está no Next.
- **Valores fixos:** os hex, as sombras, a escala de tipo e os cantos são os da spec. Não invente valores intermediários.
- **Proibido depois da tarefa que os remove:**
  - `font-mono` fora de `<kbd>`;
  - `text-[9px]`, `text-[10px]` e `text-[11px]`;
  - `rgba(23,21,18` e qualquer `shadow-[...]` escrito à mão;
  - "→" em texto de link.
- **Nomes:** identificadores em inglês e descritivos. Comentários e textos de tela em português.
- **Verificação antes de cada commit**, em `frontend/`: `bun run lint`, `bun run test` e `bunx tsc --noEmit`.
- **Conferência visual:**
  - por script com o Chrome do PC (`puppeteer-core` no scratchpad, fora do repositório);
  - o ambiente sobe com `bun start full`, depois de conferir com `docker ps` que os containers `zovic-*` da produção estão parados;
  - conta `ana.andrade@zovic.test` (senha `zovic123`) para as telas de assinante e `elisa.andrade@zovic.test` para o admin;
  - reaproveite o cookie de sessão entre as execuções, porque o login tem limite de 5 tentativas a cada 15 minutos;
  - larguras de 1440 px e 390 px.

## Review Focus

1. **Playlist antiga com cor clara** (`#f59e0b`, `#84cc16`): a capa continua com texto preto, e o destaque da página continua escurecido e legível. Teste de `getPlaylistAccentStyle` na Task 2.
2. **Cabeçalho sobre seção escura** ("Como funciona" e rodapé da landing): o texto do cabeçalho continua claro ali, agora vindo dos tokens. Conferência visual na Task 1.
3. **Gênero com cor muito clara** (um amarelo, por exemplo): o bloco sólido da tela inicial usa texto preto, e o fundo do player continua sutil. Teste de `ambientColorOf` na Task 9 e conferência na Task 7.
4. **A barra flutuante cobre o fim da página:** a última faixa de `/playlist/[id]`, de `/historico` e de `/album/[id]` continua visível e clicável com a barra aberta. Conferência na Task 6.
5. **`prefers-reduced-motion`:** o esqueleto não pulsa e o fundo do player troca de cor sem transição. Conferência por busca na Task 7 e na Task 9.

---

### Task 1: Paleta e sombras

**Files:**
- Modify: `frontend/src/app/globals.css`
- Modify: `frontend/src/components/header.tsx` (a troca de tokens sobre seção escura)
- Modify: `frontend/src/components/color-picker.tsx` (só a constante nova)
- Modify: `frontend/src/components/playback-bar.tsx` (`DEFAULT_COLOR`)
- Modify: `frontend/src/app/playlist/page.tsx`, `frontend/src/components/auth-form.tsx` e `frontend/src/components/search/suggestion-renderers.tsx` (hex fixos)
- Modify: `frontend/src/app/player/page.tsx`, `frontend/src/components/hero-preview.tsx`, `frontend/src/components/playlist-tile.tsx` e `frontend/src/components/record-sleeve.tsx` (sombras)

**Interfaces:**
- Produces:
  - `export const DEFAULT_ACCENT_COLOR = "#1a7173"` em `components/color-picker.tsx`;
  - as classes `shadow-sm`, `shadow-md` e `shadow-lg` com os valores da spec, definidas no `@theme`.

- [ ] **Step 1:** trocar os valores de `:root` pelos da tabela "Cores" da spec. `--primary` e `--ring` passam a `var(--color-teal)`, `--destructive` fica em `var(--color-red)`, e `--color-paper-bright` vira `#ffffff`.
- [ ] **Step 2:** criar `--shadow-sm`, `--shadow-md` e `--shadow-lg` no `@theme`, com `--color-ink` em `color-mix`. Apagar o `--shadow-popover` e trocar o `shadow-popover` do menu da conta por `shadow-md`.
- [ ] **Step 3:** no `header.tsx`, trocar `#171512` e `#efe7d8` da troca sobre seção escura por `var(--color-ink)` e `var(--color-paper)`.
- [ ] **Step 4:** trocar as oito sombras escritas à mão pelos tokens:
  - capa pequena: `shadow-sm`;
  - capa grande, hover de cartão e prévia da landing: `shadow-md`;
  - cartas do player: `shadow-lg`.
- [ ] **Step 5:** usar o `DEFAULT_ACCENT_COLOR`:
  - na barra, no lugar do `DEFAULT_COLOR` vermelho;
  - em `playlist/page.tsx`, no lugar do fallback `"#d33a2c"`.

  Trocar também os `"#171512"` de `auth-form.tsx` e `suggestion-renderers.tsx` por `"#191b1f"`.
- [ ] **Step 6:** buscar `rgba(23,21,18`, `#d33a2c`, `#171512` e `#efe7d8` em `frontend/src`, fora dos testes. Esperado: nenhum resultado.
- [ ] **Step 7:** rodar as verificações e conferir `/` (inclusive com o cabeçalho sobre "Como funciona"), `/entrar`, `/inicio` e `/admin`. Esperado: tudo verde e nenhum vermelho em botão principal.
- [ ] **Step 8: Commit.** `feat(frontend): troca a paleta creme por uma base neutra e clara`

### Task 2: Presets de cor harmônicos

**Files:**
- Modify: `frontend/src/components/color-picker.tsx` (`PRESET_COLORS`)
- Test: `frontend/src/components/color-picker.test.ts`

**Interfaces:**
- Consumes: `DEFAULT_ACCENT_COLOR` (Task 1). O preset "Teal Zovic" usa o mesmo valor.
- Produces: `PRESET_COLORS`, agora com as 11 cores da tabela "Cores das playlists" da spec. O primeiro preset passa a ser "Teal Zovic", que vira a cor de uma playlist nova.

- [ ] **Step 1: Escrever os testes.** Use um helper de módulo `contrastRatio(foregroundHex: string, backgroundHex: string): number`, com a luminância relativa da WCAG. Os testes:
  - `every preset reads white text at 4.5:1 or more`: `contrastRatio("#ffffff", preset.color) >= 4.5` e `getContrastTextColor(preset.color) === "text-white"`, para todos;
  - `preset names are unique and name no brand`: os nomes não repetem e nenhum contém "Spotify";
  - `first preset is the Zovic teal`: `PRESET_COLORS[0].color === DEFAULT_ACCENT_COLOR`;
  - `light playlist colors get a darkened accent`: `getPlaylistAccentStyle("#f59e0b")["--primary"]` contém `color-mix`, e `getPlaylistAccentStyle("#1a7173")["--primary"] === "#1a7173"`.

  Renomear o `describe` atual, que fala em "Spotify Background", para `color picker`.
- [ ] **Step 2:** `bun test src/components/color-picker.test.ts`. Esperado: FAIL no contraste, no nome de marca e no primeiro preset.
- [ ] **Step 3:** trocar `PRESET_COLORS` pela tabela da spec, em minúsculas, na ordem: Teal Zovic primeiro, depois as outras.
- [ ] **Step 4:** rodar o teste de novo e depois `bun test src/lib/album-cover.test.ts`, que usa os presets. Esperado: PASS nos dois.
- [ ] **Step 5: Commit.** `feat(frontend): troca os presets de cor por uma paleta com o mesmo contraste`

### Task 3: Fonte, títulos e aba

**Files:**
- Modify: `frontend/src/app/layout.tsx`
- Modify: os títulos (h1 e h2) das telas, as iniciais das capas e os nomes de playlist e álbum, nos arquivos que hoje usam `tracking-[-0.03em]` (21 usos) ou `tracking-[-0.02em]` (6 usos)

**Interfaces:**
- Produces: `--font-sans` com a Instrument Sans e o padrão de título `font-semibold font-stretch-semi-condensed tracking-[-0.02em]`.

- [ ] **Step 1:** em `layout.tsx`, trocar a `Inter` por `Instrument_Sans({ subsets: ["latin", "latin-ext"], axes: ["wdth"], variable: "--font-sans" })`, sem `weight`, porque a fonte é variável. O `metadata` passa a ter `title: "Zovic"` e `description: "Streaming de música com busca, fila e playlists com a sua cara"`.
- [ ] **Step 2:** aplicar o padrão de título nos usos de `tracking-[-0.03em]` e `tracking-[-0.02em]`. Os tamanhos seguem a escala da spec: 56 px no hero, 40 px nas seções da landing, 28 px nos títulos de página e 20 px nos títulos de seção. O `font-black` do título do admin (`app/admin/layout.tsx`) vira o mesmo padrão.
- [ ] **Step 3:** rodar as verificações e conferir `/`, `/inicio` e `/playlist/[id]`. Esperado: a aba mostra "Zovic", e os acentos (ç, ã, é) aparecem na mesma fonte.
- [ ] **Step 4: Commit.** `feat(frontend): adota a Instrument Sans com títulos estreitos`

### Task 4: Escala de texto sem mono

**Files:**
- Modify: os 17 arquivos com `font-mono` e os 12 com `text-[9-11px]` (lista com `grep -rlE "font-mono|text-\[(9|10|11)px\]" frontend/src`)

- [ ] **Step 1:** trocar `font-mono` por `tabular-nums` onde há número, e removê-lo onde há só texto. Manter o `font-mono` só no `<kbd>` (`features.tsx` e `player/page.tsx`).
- [ ] **Step 2:** trocar `text-[9px]`, `text-[10px]` e `text-[11px]` por `text-xs`, e `font-bold` por `font-medium` fora dos títulos.
- [ ] **Step 3:** rodar `grep -rnE "text-\[(9|10|11)px\]" frontend/src` e `grep -rn "font-mono" frontend/src | grep -v kbd`. Esperado: nenhum resultado.
- [ ] **Step 4:** rodar as verificações e conferir a barra de reprodução, `/playlist/[id]` e os comentários de uma faixa. Esperado: nada cortado nem quebrando linha onde antes cabia.
- [ ] **Step 5: Commit.** `feat(frontend): troca a fonte mono e os textos minúsculos pela escala da spec`

### Task 5: Botões e cantos

**Files:**
- Modify: `frontend/src/components/ui/button.tsx`
- Modify: `frontend/src/components/hero.tsx`, `frontend/src/components/plans.tsx`, `frontend/src/components/call-to-action.tsx`, `frontend/src/app/player/page.tsx` e `frontend/src/app/playlist/page.tsx` (tamanhos corrigidos à mão)
- Modify: as capas e os cartões cujo canto não segue a tabela "Formas" da spec

- [ ] **Step 1:** no `buttonVariants`:
  - a base passa de `rounded-md` a `rounded-full` e de `text-xs/relaxed` a `text-sm`;
  - `default` fica `h-9 gap-1.5 px-4`;
  - `lg` fica `h-11 gap-2 px-5 text-base`;
  - os tamanhos de ícone (`icon`, `icon-sm`, `icon-lg`) ficam iguais.
- [ ] **Step 2:** apagar os ajustes de tamanho dos botões: `h-12 px-6 text-base`, `h-11 ... px-5 text-sm` e `h-9 px-4 text-sm`. Buscar `buttonVariants({ size: "lg" })` e `size="lg"` seguidos de `className` com altura.
- [ ] **Step 3:** aplicar a tabela "Formas":
  - `PlaylistTile`, `AlbumCoverImage` e `Sleeve`: `rounded-md`;
  - cartões, menus e o cartão "Nova playlist": `rounded-2xl`.
- [ ] **Step 4:** rodar as verificações e conferir `/`, `/planos` e `/playlist`. Esperado: todos os botões principais com a mesma altura em cada tamanho.
- [ ] **Step 5: Commit.** `feat(frontend): padroniza os botões em pílula e os cantos por hierarquia`

### Task 6: Barra de reprodução flutuante

**Files:**
- Modify: `frontend/src/components/playback-bar.tsx`

- [ ] **Step 1:** trocar o contêiner por `sticky bottom-3 z-30 mx-3 mb-3 h-20 rounded-2xl bg-surface shadow-lg`, sem `border-t`, `backdrop-blur` e `shadow-lg` antigos.
- [ ] **Step 2:** título com `text-sm font-medium`, artista com `text-xs text-muted-foreground`, tempos com `text-xs tabular-nums` e botão de tocar com `bg-primary text-primary-foreground`.
- [ ] **Step 3:** barra de progresso com trilho `h-1` e um marcador `size-3 rounded-full bg-primary` na posição do progresso, que aparece com `group-hover` e `group-focus-visible`. O foco do botão da barra ganha `focus-visible:ring-2 ring-ring/50`.
- [ ] **Step 4:** rodar as verificações e conferir, com uma música tocando, a última linha de `/playlist/[id]`, `/historico` e `/album/[id]` em 1440 px e 390 px. Esperado: a barra não cobre a última linha (Review Focus 4). Se cobrir, dar à página um `pb-28`.
- [ ] **Step 5: Commit.** `feat(player): deixa a barra de reprodução flutuante e mais leve`

### Task 7: Esqueletos e tela inicial

**Files:**
- Create: `frontend/src/components/ui/skeleton.tsx`
- Modify: `frontend/src/components/track-row.tsx`
- Modify: `frontend/src/app/inicio/page.tsx`
- Modify: `frontend/src/app/album/[id]/page.tsx`, `frontend/src/app/genero/[id]/page.tsx` e `frontend/src/app/historico/page.tsx` ("Carregando…")

**Interfaces:**
- Produces:
  - `export function Skeleton({ className }: { className?: string }): JSX.Element`, com `motion-safe:animate-pulse rounded-md bg-foreground/[0.06]` e `aria-hidden`;
  - `export function TrackRowSkeleton({ count }: { count: number }): JSX.Element` em `track-row.tsx`. Ele renderiza `count` linhas na altura do `TrackRow` e um `<span className="sr-only">Carregando…</span>`.

- [ ] **Step 1:** criar `Skeleton` e `TrackRowSkeleton`.
- [ ] **Step 2:** na tela inicial, o `QueryStatus` ganha `placeholder: React.ReactNode`, mostrado enquanto carrega no lugar do texto:
  - "Mais tocadas": `TrackRowSkeleton` com 10;
  - "Ouvidas recentemente": `TrackRowSkeleton` com 5;
  - playlists e "Novidades": quatro `Skeleton` quadrados;
  - "Gêneros": seis `Skeleton` com a altura dos blocos.
- [ ] **Step 3:** em álbum, gênero e histórico, trocar o "Carregando…" pelo `TrackRowSkeleton` com 8.
- [ ] **Step 4:** fazer os blocos de "Gêneros" sólidos: `backgroundColor: genre.color`, a classe de `getContrastTextColor(genre.color)`, sem borda, com `rounded-2xl` e `hover:shadow-md`. A contagem usa `opacity-75`.
- [ ] **Step 5:** tirar o "→" de "Ver histórico" e "Ver todas".
- [ ] **Step 6:** rodar `grep -rn "animate-pulse" frontend/src | grep -v motion-safe`. Esperado: nenhum resultado. Rodar as verificações e conferir `/inicio` com rede lenta (DevTools, "Slow 4G") e um gênero de cor clara (Review Focus 3).
- [ ] **Step 7: Commit.** `feat(frontend): troca o texto de carregamento por esqueletos e deixa os gêneros sólidos`

### Task 8: Landing e entrada

**Files:**
- Modify: `frontend/src/components/auth-form.tsx`, `frontend/src/components/hero-preview.tsx`, `frontend/src/components/features.tsx` e `frontend/src/components/plans.tsx`

- [ ] **Step 1:** em `auth-form.tsx`, o contêiner do formulário perde `border border-border` e `shadow-xs` e ganha `shadow-md`. Os campos ficam em `bg-surface`.
- [ ] **Step 2:** em `hero-preview.tsx`, tirar a borda `border-ink/10` do cartão e o `border-t` da lista. A linha que toca mantém o fundo `bg-background/60`.
- [ ] **Step 3:** em `features.tsx` e `plans.tsx`, trocar `border-ink/10` por `border-border`, e as fichas de gênero por `rounded-full bg-surface` sem borda.
- [ ] **Step 4:** rodar as verificações e conferir `/` e `/entrar` em 1440 px e 390 px.
- [ ] **Step 5: Commit.** `feat(frontend): tira bordas da landing e do formulário de entrada`

### Task 9: Fundo do player na cor do que toca

**Files:**
- Create: `frontend/src/lib/player-ambient.ts`
- Test: `frontend/src/lib/player-ambient.test.ts`
- Modify: `frontend/src/app/player/page.tsx`

**Interfaces:**
- Consumes: `DEFAULT_ACCENT_COLOR` (Task 1), `CatalogMusic` de `@/lib/api/catalog` e o `CATALOG_TRACK_ID` de `lib/track-cover.ts`, que passa a ser exportado.
- Produces:
  - `export const AMBIENT_TINT_PERCENT = 9`;
  - `export function ambientColorOf(input: { playlistColor: string | null; trackId: string | null; musics: CatalogMusic[] }): string`.

- [ ] **Step 1: Escrever os testes**, com um helper de módulo `music(id, genreColors)` que monta um `CatalogMusic` mínimo:
  - `playlist color wins`: com `playlistColor: "#8a5186"` e uma faixa de gênero `#357a47`, devolve `"#8a5186"`;
  - `first genre of the current track without a playlist`: com a faixa `"3"` de gêneros `["#357a47", "#12719c"]`, devolve `"#357a47"`;
  - `light genre color is kept`: com o gênero `"#fde047"`, devolve `"#fde047"`, porque o tingido de 9% já é sutil;
  - `falls back to the Zovic teal`: devolve `DEFAULT_ACCENT_COLOR` para a faixa sem gênero, para o id de amostra `"t1"`, para `trackId: null` e para a faixa que não está em `musics`.
- [ ] **Step 2:** `bun test src/lib/player-ambient.test.ts`. Esperado: FAIL, porque o módulo não existe.
- [ ] **Step 3:** implementar `ambientColorOf` em `lib/player-ambient.ts`.
- [ ] **Step 4:** rodar o teste de novo. Esperado: PASS.
- [ ] **Step 5:** no `/player`:
  - o contêiner da página recebe `backgroundColor: color-mix(in oklab, ${ambient} ${AMBIENT_TINT_PERCENT}%, var(--background))`;
  - também recebe `transition-[background-color] duration-700 ease-out motion-reduce:transition-none`;
  - o `ambient` vem de `ambientColorOf`, com `playlist?.color ?? null`, o id da faixa atual e os `catalogMusics` que a página já lê.
- [ ] **Step 6:** rodar as verificações e conferir, no `/player`:
  - uma playlist;
  - uma faixa avulsa, avançando entre gêneros diferentes;
  - o mesmo com "reduzir movimento" ligado no sistema (Review Focus 5).

  Esperado: o fundo muda de cor a cada troca de gênero, sem transição com o movimento reduzido.
- [ ] **Step 7: Commit.** `feat(player): tinge o fundo do player com a cor do que toca`

### Task 10: Conferência final e PR

- [ ] **Step 1:** rodar `bun run lint`, `bun run test` e `bunx tsc --noEmit` em `frontend/`. Esperado: tudo verde.
- [ ] **Step 2:** tirar os prints da spec (`/`, `/entrar`, `/inicio`, `/playlist/[id]`, `/player` e `/admin`, em 1440 px e 390 px) e comparar com os da `main`.
- [ ] **Step 3:** registrar o uso de IA em `docs/prompts/prompts.md`, no formato que já está lá: a proposta, a paleta em OKLCH e o plano.
- [ ] **Step 4: Commit.** `docs(frontend): registra o uso de IA na revisão visual`
- [ ] **Step 5:** só com o OK de quem pediu, abrir o PR `feat(frontend): visual mais leve, com nova paleta, fonte e barra flutuante`. O corpo traz os prints de antes e depois e marca os responsáveis de cada área para revisar as telas deles.
