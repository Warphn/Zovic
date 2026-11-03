-- =====================================================================
-- Zovic — ordem das músicas dentro de cada playlist
--
-- O front deixa os admins da playlist arrastarem as músicas para reordenar, e
-- todos os que veem a playlist enxergam a mesma ordem: ela é da playlist, não
-- de cada usuário. Antes, music_playlist não tinha ordem nenhuma.
--
-- position: 0, 1, 2… dentro da playlist. Pode ter buracos (tirar uma música
-- não renumera as outras); a rota de reordenar renumera tudo de novo.
-- added_at: quando a música entrou na playlist.
--
-- O UNIQUE é DEFERRABLE INITIALLY DEFERRED porque reordenar troca as posições
-- num UPDATE só, e duas músicas passam um instante pela mesma posição: o
-- Postgres só confere no COMMIT.
--
-- As linhas que já existem ganham a ordem do id da música e, como data, o
-- momento em que esta migration roda.
-- =====================================================================

ALTER TABLE music_playlist
    ADD COLUMN position integer,
    ADD COLUMN added_at timestamptz NOT NULL DEFAULT now();

UPDATE music_playlist mp
SET position = ordered.position
FROM (
    SELECT music_id, playlist_id,
           row_number() OVER (PARTITION BY playlist_id ORDER BY music_id) - 1 AS position
    FROM music_playlist
) ordered
WHERE ordered.music_id = mp.music_id AND ordered.playlist_id = mp.playlist_id;

ALTER TABLE music_playlist
    ALTER COLUMN position SET NOT NULL,
    ADD CONSTRAINT music_playlist_position_check CHECK (position >= 0),
    ADD CONSTRAINT music_playlist_playlist_id_position_key UNIQUE (playlist_id, position)
        DEFERRABLE INITIALLY DEFERRED;

-- O índice do UNIQUE começa por playlist_id e já atende as buscas por playlist.
DROP INDEX music_playlist_playlist_id_idx;
