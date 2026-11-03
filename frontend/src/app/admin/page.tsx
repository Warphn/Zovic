"use client"

import { Loading, Notice, RankedBars, Section, StatTile } from "@/components/admin/panel"
import { adminApi } from "@/lib/admin/api"
import { useResource } from "@/lib/admin/use-resource"

// Usage stats: accounts, accesses per content and per category (genre)
export default function AdminOverviewPage() {
  const { data: stats, error, loading } = useResource(() => adminApi.stats(), [])

  if (error) return <Notice>{error}</Notice>
  if (loading || !stats) return <Loading />

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Usuários ativos"
          value={stats.users.active}
          hint={`${stats.users.newLast30Days.toLocaleString("pt-BR")} ${stats.users.newLast30Days === 1 ? "novo" : "novos"} nos últimos 30 dias`}
        />
        <StatTile label="Admins" value={stats.users.admins} hint={`${stats.users.deleted.toLocaleString("pt-BR")} ${stats.users.deleted === 1 ? "conta removida" : "contas removidas"}`} />
        <StatTile
          label="Reproduções"
          value={stats.plays.total}
          hint={`${stats.plays.last30Days.toLocaleString("pt-BR")} nos últimos 30 dias`}
        />
        <StatTile
          label="Músicas no catálogo"
          value={stats.catalog.musics}
          hint={`${stats.catalog.deletedMusics.toLocaleString("pt-BR")} removidas · ${stats.catalog.artists.toLocaleString("pt-BR")} artistas`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Acessos por conteúdo" description="As 10 músicas mais tocadas, por reproduções registradas.">
          <RankedBars
            unit="reproduções"
            empty="Nenhuma reprodução registrada ainda."
            items={stats.byContent.map((music) => ({
              key: music.musicId,
              label: music.name,
              sublabel: music.deleted ? `${music.artists.join(", ")} · removida` : music.artists.join(", "),
              value: music.plays,
              detail: `${music.streams.toLocaleString("pt-BR")} streams acumulados`,
              muted: music.deleted,
            }))}
          />
        </Section>

        <Section title="Acessos por categoria" description="Reproduções por gênero. Uma música com dois gêneros conta nos dois.">
          <RankedBars
            unit="reproduções"
            empty="Nenhum gênero cadastrado."
            items={stats.byGenre.map((genre) => ({
              key: genre.genreId,
              label: genre.name,
              value: genre.plays,
              swatch: genre.color,
              detail: stats.plays.total
                ? `${Math.round((genre.plays / stats.plays.total) * 100)}% das reproduções`
                : undefined,
            }))}
          />
        </Section>
      </div>
    </div>
  )
}
