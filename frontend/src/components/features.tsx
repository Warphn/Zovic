// What Zovic does, beyond the playlist the hero shows: one row per area of the site, set like
// the credits on the back of a sleeve. The keys and genres are the real ones.
const FEATURES = [
  {
    title: "Busca enquanto você digita",
    description:
      "Faixas, artistas e playlists aparecem já nas primeiras letras. Clique numa faixa e ela toca ali mesmo, sem trocar de página.",
  },
  {
    title: "Player com fila de verdade",
    description:
      "A fila fica à vista, com a faixa anterior ao lado. Avance com as setas, a roda do mouse ou arrastando. Tocou uma faixa avulsa? O Zovic emenda sugestões do catálogo.",
    keys: ["←", "→", "Enter"],
  },
  {
    title: "Playlists com encarte",
    description:
      "Cada playlist ganha nome, cor de encarte e a ordem que você arrastar. Pública ou privada, em grade ou em lista.",
  },
  {
    title: "Curta e avalie",
    description: "Guarde as faixas que você ama e dê notas de 1 a 5 para lembrar do que vale a pena ouvir de novo.",
  },
]

const GENRES = ["Rock", "Pop", "MPB", "Samba", "Sertanejo", "Funk", "Hip-Hop", "Eletrônica", "Jazz"]

export default function Features() {
  return (
    <section id="recursos" className="scroll-mt-16 bg-background">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-24 md:grid-cols-[1fr_1.4fr] md:gap-16 md:px-8 md:py-32">
        <div>
          <span className="mb-4 block font-mono text-xs text-muted-foreground">Recursos</span>
          <h2 className="text-4xl leading-[1.05] font-medium tracking-[-0.03em] sm:text-5xl">
            Tudo para ouvir, do play à playlist
          </h2>
          <p className="mt-6 max-w-sm text-lg leading-relaxed text-muted-foreground">
            Um site de música completo: catálogo por gênero, busca, player, fila e as suas coleções
          </p>
        </div>

        <div>
          <dl className="border-t border-ink/10">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="grid gap-2 border-b border-ink/10 py-6 sm:grid-cols-[14rem_1fr] sm:gap-8">
                <dt className="text-lg font-medium tracking-[-0.01em]">{feature.title}</dt>
                <dd className="text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                  {feature.keys && (
                    <span className="mt-3 flex gap-2">
                      {feature.keys.map((key) => (
                        <kbd
                          key={key}
                          className="rounded-sm border border-border bg-surface px-1.5 py-0.5 font-mono text-xs text-foreground"
                        >
                          {key}
                        </kbd>
                      ))}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>

          {/* The catalog's genres, as the site files them */}
          <div className="mt-10">
            <p className="mb-3 font-mono text-xs text-muted-foreground">Do samba ao eletrônico</p>
            <ul className="flex flex-wrap gap-2">
              {GENRES.map((genre) => (
                <li key={genre} className="rounded-md border border-ink/10 bg-surface px-3 py-1.5 text-sm">
                  {genre}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
