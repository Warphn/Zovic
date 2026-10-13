/**
 * Totais do sistema (ALL). Recalcula a linha única de system_data a partir do
 * que está no banco, contando só os registros ativos (sem deleted_at).
 */
import type { Seeder } from "./support.ts";

export const seedSystemData: Seeder["run"] = async (tx) => {
  const active = { where: { deletedAt: null } };
  const totals = {
    users: await tx.user.count(active),
    songs: await tx.music.count(active),
    playlists: await tx.playlist.count(active),
  };
  await tx.systemData.upsert({ where: { singleton: true }, create: totals, update: totals });
  return `${totals.users} usuários, ${totals.songs} músicas e ${totals.playlists} playlists ativos`;
};
