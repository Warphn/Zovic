-- Nome de artista único entre os ativos, sem diferenciar maiúsculas de minúsculas
-- ("Lô Borges" e "lô borges" são o mesmo artista). Artista apagado (soft delete)
-- não conta, como no nome de gênero.
--
-- Antes do índice, os duplicados que já existem são fundidos no de menor id: os
-- vínculos com álbuns e músicas passam para ele, e os outros são apagados.

CREATE TEMPORARY TABLE artist_duplicate AS
SELECT id AS duplicate_id, kept_id
FROM (
    SELECT id, min(id) OVER (PARTITION BY lower(name)) AS kept_id
    FROM artist
    WHERE deleted_at IS NULL
) AS grouped
WHERE id <> kept_id;

INSERT INTO album_artist (album_id, artist_id)
SELECT album_artist.album_id, artist_duplicate.kept_id
FROM album_artist
JOIN artist_duplicate ON artist_duplicate.duplicate_id = album_artist.artist_id
ON CONFLICT DO NOTHING;

DELETE FROM album_artist
USING artist_duplicate
WHERE album_artist.artist_id = artist_duplicate.duplicate_id;

INSERT INTO artist_music (artist_id, music_id)
SELECT artist_duplicate.kept_id, artist_music.music_id
FROM artist_music
JOIN artist_duplicate ON artist_duplicate.duplicate_id = artist_music.artist_id
ON CONFLICT DO NOTHING;

DELETE FROM artist_music
USING artist_duplicate
WHERE artist_music.artist_id = artist_duplicate.duplicate_id;

UPDATE artist
SET deleted_at = now()
FROM artist_duplicate
WHERE artist.id = artist_duplicate.duplicate_id;

DROP TABLE artist_duplicate;

CREATE UNIQUE INDEX artist_name_key ON artist (lower(name)) WHERE deleted_at IS NULL;
