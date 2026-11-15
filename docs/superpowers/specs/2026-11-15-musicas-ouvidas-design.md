# Músicas ouvidas (HU-15) — design

Issue: #91 · Épico: Reprodução (#77) · Responsável: Victor · Prioridade: P0

## Intenção

O assinante quer saber quais músicas já ouviu, para voltar a elas ou procurar novidades. Hoje o histórico (HU-24) lista tudo o que começou a tocar, mesmo o que tocou por 2 segundos, e nenhuma tela mostra se uma música foi ouvida de verdade.

A história na issue é a fonte da verdade. Regras:

- Uma música conta como ouvida quando toca por mais de 30 segundos numa mesma reprodução.
- A marca é de cada conta. Membros do mesmo plano têm marcas separadas.
- A música ouvida tem um ícone no catálogo, na busca e nas playlists.
- "Já ouvidas" é uma aba da página de histórico, só com as músicas marcadas.

Critérios de aceite (cada um vira pelo menos um teste):

1. Uma música tocada por 20 s, depois parada, não fica marcada.
2. Uma música tocada por 31 s ganha o ícone na lista, na busca e nas playlists quando o assinante volta para elas.
3. Uma música ouvida por um membro não aparece marcada para outro membro do mesmo plano.
4. A aba "Já ouvidas" mostra só as músicas marcadas, da mais recente para a mais antiga.

## Objetivos e não objetivos

- **Objetivo:** cumprir os quatro critérios com a menor mudança que respeite portas e adaptadores.
- **Não objetivo:** impedir que alguém forje a marca. Ela só muda um ícone da própria conta.
- **Não objetivo:** mudar as estatísticas do admin, o contador `streams` ou o que entra no histórico. O `POST /musics/:id/plays` continua igual.
- **Antiobjetivo:** contar como ouvida uma música que a pessoa só pulou para o meio. "Tocar por 30 s" é tempo de som, não posição na faixa.

## Abordagens consideradas

1. **O front conta os segundos e avisa a API ao passar dos 30 s (escolhida pelo Victor).** A API recebe os segundos tocados, e o caso de uso aplica a regra. Tem uma rota nova e nenhuma mudança na resposta de `/plays`. Ela confia no número que o front envia, o que é aceitável pelo não objetivo acima.
2. **Como a 1, com a API conferindo o relógio.** O `POST /plays` devolveria o id da reprodução, e a API só marcaria depois de 30 s desde esse registro. Não dá para forjar a marca, mas exige uma rota a mais e uma mudança na resposta de `/plays`, e o desvio do relógio da VM do Docker complica os testes. Foi descartada porque protege algo que não precisa de proteção.

## Como funciona

### Banco

- **Evento novo:** `music_listened` no enum `user_event_type`. Cada reprodução que passou dos 30 s grava uma linha em `user_event`, com `user_id`, `music_id` e `created_at`. Não há tabela nova, e por isso a imagem do ER e o `GROUPS` do `db-erd.ts` não mudam.
- **CHECK:** a restrição que só aceita `music_id` em `music_play` e `music_skip` passa a aceitar também `music_listened`.
- **Duas migrações:** o Postgres não deixa usar um valor de enum na mesma transação em que ele foi criado, e o Flyway roda cada migração numa transação. Por isso, uma migração adiciona o valor e a seguinte troca o CHECK.

### Domínio (`api/domain`)

- **Constante:** `LISTENED_THRESHOLD_SECONDS = 30`.
- **Caso de uso `MarkMusicListened`:** recebe `userId`, `musicId` e `playedSeconds`.
  - Com `playedSeconds <= 30`, recusa com `BusinessRuleError` (409) e não marca nada. A regra é "mais de 30", então 30 s exatos não contam.
  - Com mais de 30, grava a marca pela porta.
  - Uma música inexistente ou removida dá `NotFoundError` (404).
- **Porta:** a gravação da marca e a lista das ouvidas ficam juntas na porta do histórico (`PlayHistory`), porque as duas leem e escrevem `user_event` do mesmo jeito.

### API (`api/adapters/http`)

- **`POST /musics/:id/listens`** (só assinante), corpo `{ "playedSeconds": number }`. Responde 204, 400 para corpo inválido, 404 para música inexistente e 409 para 30 s ou menos.
- **`GET /history/listened`** (só assinante): as músicas marcadas da conta, cada uma uma vez, da marca mais recente para a mais antiga.
  - Cada item tem o mesmo formato do `GET /history`, com `lastListenedAt` no lugar de `lastPlayedAt`.
  - Uma música removida pelo admin aparece com `isAvailable: false`, como no histórico.
- **Uma rota para dois usos:** o front tira dessa lista tanto a aba quanto o conjunto de ids que acende os ícones. Não precisa de outra rota, nem de mudar `GET /musics`, `/search` ou `/playlists/:id/musics`.

### Front (`frontend/`)

- **Contagem:** o `PlaybackAudio` soma o tempo de som de cada reprodução (`listenId` da `playback-store`) a partir dos `timeupdate`.
  - Só soma o avanço pequeno entre dois eventos seguidos, o que deixa de fora os saltos de busca para frente ou para trás.
  - Pausar não zera a soma.
  - Ao passar de 30 s, chama `POST /musics/:id/listens` uma vez por reprodução e depois invalida a consulta das ouvidas.
  - Como no `recordPlay`, uma falha não atrapalha a música.
  - Uma reprodução nova da mesma faixa começa a soma do zero.
- **Lógica pura:** a soma e a decisão de "já avisou nesta reprodução" ficam num módulo puro em `frontend/src/lib`, com teste no `bun test`. O componente só liga os eventos do `<audio>` a esse módulo.
- **Ícone de "ouvida":** aparece nas listas de faixas da página do álbum, do gênero e do artista, do início, da página de resultados da busca e da página da playlist.
  - Usa o `GET /history/listened` (um hook como `useListenedMusicIds`, que devolve um `Set`).
  - Fica ao lado do título, com `aria-label` e `title` "Já ouvida".
  - As sugestões que abrem embaixo da barra de busca ficam sem ícone, porque não há espaço.
- **Aba "Já ouvidas":** a página `/historico` ganha duas abas, "Todas" (a lista de hoje) e "Já ouvidas". A segunda lista o `GET /history/listened` com o mesmo visual da primeira.

## Testes por critério

| Critério | Teste |
| --- | --- |
| 1. 20 s não marca | Domínio: `MarkMusicListened` recusa 20 s e 30 s, e a porta não recebe nada. Front: o módulo de soma não avisa com 20 s de som nem com um salto para 0:45. |
| 2. 31 s acende o ícone | Domínio: aceita 31 s. Integração: `POST /musics/:id/listens` com 31 faz a música aparecer em `GET /history/listened`. |
| 3. Marcas separadas no plano | Integração: duas contas do mesmo plano familiar, e a marca de uma não aparece no `GET /history/listened` da outra. |
| 4. Aba em ordem | Integração (adaptador do banco): três marcas em momentos diferentes voltam da mais recente para a mais antiga, cada música uma vez. |

## Documentação no mesmo PR

- **Rotas novas:** `openapi.ts`, requisições no Bruno (`api/bruno/`) e a tabela de rotas em `docs/api.md`.
- **Migrações:** `docs/banco-de-dados.md` e a linha de `user_event` em `docs/modelo-er.md`, com o evento novo e o CHECK. A imagem do ER não muda, porque não há tabela nova.
- **Porta e caso de uso novos:** `docs/models.md`.
- **Hooks e chamadas novas do cliente da API:** `frontend/src/lib/api/README.md`.
- **Uso de IA:** `docs/prompts/prompts.md`.

## Decisões tomadas por mim (Claude), para conferir

- O evento `music_listened` vai em `user_event`, sem tabela nova, para seguir o histórico, que já é montado com eventos, e para não mexer na imagem do ER.
- 30 s exatos não contam ("mais de 30 segundos").
- Uma recusa por tempo insuficiente responde 409, o código que o `error-handler` já usa para `BusinessRuleError`.
- Música explícita para menor não tem regra própria. O áudio já é recusado, então ela não chega a tocar 30 s.
- As sugestões da barra de busca ficam sem ícone.
- O ícone também aparece na aba "Todas" do histórico. Na aba "Já ouvidas" ele é redundante e fica de fora.

## Fica para quem implementar

O nome e a forma exata do ícone (dentro do conjunto de ícones que já existe), o nome dos arquivos das migrações no padrão `V<data>__<Descrição>.sql`, o limite do "avanço pequeno" entre dois `timeupdate`, e se a aba guarda o estado na URL.
