/**
 * Playlists (LOCAL), com membros e músicas.
 *
 * Toda playlist tem ao menos um membro e ao menos um admin. As músicas de cada
 * uma são sorteadas com semente fixa: sempre as mesmas.
 */
import { byName, day, idOf, random, type Seeder } from "./support.ts";

const PLAYLISTS = [
  { name: "Para correr", isPrivate: false, color: "#E4572E", admins: ["Ana Andrade"], members: [] },
  { name: "Domingo em família", isPrivate: true, color: "#2E86AB", admins: ["Ana Andrade", "Bruno Andrade"], members: ["Carla Andrade", "Diego Andrade", "Elisa Andrade"] },
  { name: "Estudar sem distração", isPrivate: false, color: "#6C4AB6", admins: ["Nicolas Prado"], members: ["Olívia Santos"] },
  { name: "Churrasco", isPrivate: false, color: "#F2A541", admins: ["Felipe Costa"], members: ["Gabriela Costa"] },
  { name: "Viagem de carro", isPrivate: true, color: "#1B998B", admins: ["João Lima", "Karina Rocha"], members: [] },
  { name: "Só as tristes", isPrivate: true, color: "#3D405B", admins: ["Rafaela Dias"], members: [] },
  { name: "Festa da firma", isPrivate: false, color: "#D7263D", admins: ["Lucas Ferraz"], members: ["Marina Ferraz", "Pedro Nogueira"] },
  { name: "Acordar bem", isPrivate: false, color: null, admins: ["Sofia Teixeira"], members: [] },
  { name: "Descobertas da semana", isPrivate: false, color: "#4F772D", admins: ["João Lima"], members: [] },
  { name: "Playlist antiga", isPrivate: true, color: "#A44A3F", admins: ["Tiago Moura"], members: [], deleted: true },
] as const;

export const seedPlaylists: Seeder["run"] = async (tx) => {
  const rnd = random(11);
  const userIds = byName(await tx.user.findMany({ select: { id: true, name: true } }));
  const musicIds = (await tx.music.findMany({ where: { deletedAt: null }, select: { id: true }, orderBy: { id: "asc" } })).map((m) => m.id);

  let links = 0;
  for (const [i, playlist] of PLAYLISTS.entries()) {
    const admins: readonly string[] = playlist.admins;
    if (admins.length === 0) throw new Error(`Seed: a playlist "${playlist.name}" não tem admin.`);
    const musics = rnd.sample(musicIds, rnd.int(6, 15));
    links += musics.length;
    await tx.playlist.create({
      data: {
        name: playlist.name,
        isPrivate: playlist.isPrivate,
        color: playlist.color,
        createdAt: day(20 + i),
        deletedAt: "deleted" in playlist ? day(70) : null,
        users: {
          create: [
            ...playlist.admins.map((name) => ({ userId: idOf(userIds, name), isAdmin: true })),
            ...playlist.members.map((name) => ({ userId: idOf(userIds, name), isAdmin: false })),
          ],
        },
        musics: { create: musics.map((musicId) => ({ musicId })) },
      },
    });
  }
  return `${PLAYLISTS.length} playlists (1 com soft delete), ${links} músicas adicionadas`;
};
