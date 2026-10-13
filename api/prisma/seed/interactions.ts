/**
 * Interações dos usuários com as músicas (LOCAL): músicas salvas, avaliações,
 * comentários e eventos. Geradas com semente fixa: sempre as mesmas.
 *
 * Só usuários ativos interagem; os com soft delete têm apenas eventos antigos.
 * No fim, `musics.rating` recebe a média real das avaliações ativas.
 */
import { UserEventType } from "../../generated/prisma/enums.ts";
import { day, random, type Seeder } from "./support.ts";

const COMMENTS = [
  "Que música boa!",
  "Esse refrão não sai da minha cabeça.",
  "Ouvi no repeat a semana toda.",
  "A melhor parte é a ponte.",
  "Não curti muito o final.",
  "Me lembra minha infância.",
  "Perfeita para ouvir de manhã.",
  "A produção dessa faixa está incrível.",
  "Essa letra é muito sincera.",
  "Precisava de uma versão acústica.",
  "Esse solo de guitarra!",
  "Ritmo perfeito para correr.",
  "Fui no show e foi inesquecível.",
  "Melhor do álbum, sem dúvida.",
  "Achei um pouco longa.",
];

/** Notas de 1 a 5, com mais peso para as notas altas. */
const SCORES = [1, 2, 3, 3, 4, 4, 4, 5, 5, 5] as const;

export const seedInteractions: Seeder["run"] = async (tx) => {
  const rnd = random(2026);
  const users = await tx.user.findMany({ orderBy: { id: "asc" } });
  const active = users.filter((user) => !user.deletedAt);
  const musics = await tx.music.findMany({ where: { deletedAt: null }, orderBy: { id: "asc" } });

  // Músicas salvas: algumas removidas depois (soft delete).
  const saves = active.flatMap((user, u) =>
    rnd.sample(musics, rnd.int(6, 14)).map((music, k) => ({
      userId: user.id,
      musicId: music.id,
      createdAt: day(30 + u, k),
      deletedAt: rnd.chance(0.1) ? day(50 + u) : null,
    })),
  );
  await tx.musicUser.createMany({ data: saves });

  // Avaliações: uma ativa por usuário e música. Às vezes o usuário muda de
  // ideia: a nota antiga fica com soft delete e uma nova entra no lugar.
  const ratings = active.flatMap((user, u) =>
    rnd.sample(musics, rnd.int(5, 12)).flatMap((music, k) => {
      const first = { userId: user.id, musicId: music.id, rating: rnd.pick(SCORES), createdAt: day(32 + u, k) };
      if (!rnd.chance(0.1)) return [first];
      return [{ ...first, deletedAt: day(40 + u, k) }, { ...first, rating: rnd.pick(SCORES), createdAt: day(40 + u, k) }];
    }),
  );
  await tx.rating.createMany({ data: ratings });

  // Comentários: alguns marcam um momento da música (timestamp, em segundos).
  const comments = Array.from({ length: 80 }, (_, k) => {
    const music = rnd.pick(musics);
    return {
      userId: rnd.pick(active).id,
      musicId: music.id,
      comment: rnd.pick(COMMENTS),
      timestamp: rnd.chance(0.6) ? rnd.int(0, music.duration) : null,
      createdAt: day(35 + Math.floor(k / 4), k % 24),
      deletedAt: rnd.chance(0.08) ? day(60) : null,
    };
  });
  await tx.comment.createMany({ data: comments });

  // Eventos: cadastro e, nos usuários ativos, sessões com músicas tocadas ou puladas.
  const events = users.flatMap((user, u) => {
    const list: { userId: number; eventType: UserEventType; createdAt: Date }[] = [
      { userId: user.id, eventType: UserEventType.sign_up, createdAt: user.createdAt },
    ];
    const sessions = user.deletedAt ? 1 : rnd.int(3, 6);
    for (let s = 0; s < sessions; s++) {
      const start = 30 + u + s * 3;
      list.push({ userId: user.id, eventType: UserEventType.login, createdAt: day(start, 8) });
      const plays = rnd.int(2, 8);
      for (let p = 0; p < plays; p++) {
        const eventType = rnd.chance(0.25) ? UserEventType.music_skip : UserEventType.music_play;
        list.push({ userId: user.id, eventType, createdAt: day(start, 9 + p) });
      }
      list.push({ userId: user.id, eventType: UserEventType.logout, createdAt: day(start, 9 + plays) });
    }
    return list;
  });
  await tx.userEvent.createMany({ data: events });

  // Média das avaliações ativas, com duas casas. Música sem avaliação fica com NULL.
  await tx.$executeRaw`
    UPDATE musics AS m
    SET rating = r.average
    FROM (
      SELECT music_id, ROUND(AVG(rating), 2)::float8 AS average
      FROM rating
      WHERE deleted_at IS NULL
      GROUP BY music_id
    ) AS r
    WHERE r.music_id = m.id`;

  return `${saves.length} músicas salvas, ${ratings.length} avaliações, ${comments.length} comentários, ${events.length} eventos`;
};
