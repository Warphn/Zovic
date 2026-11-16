-- =====================================================================
-- Zovic — número da faixa dentro do álbum (HU-10)
--
-- A página do álbum mostra as faixas em ordem, e antes album_music não
-- tinha ordem nenhuma: o front ordenava pelo id da música.
--
-- track_number: 1, 2, 3… dentro do álbum. A música entra como a última
-- faixa quando é ligada ao álbum, e editar a música não muda o número.
-- Pode ter buracos: tirar uma música do álbum não renumera as outras.
--
-- As linhas que já existem ganham a ordem do id da música, que é a ordem
-- em que o front já mostrava as faixas.
-- =====================================================================

ALTER TABLE album_music
    ADD COLUMN track_number smallint;

UPDATE album_music am
SET track_number = ordered.track_number
FROM (
    SELECT album_id, music_id,
           row_number() OVER (PARTITION BY album_id ORDER BY music_id) AS track_number
    FROM album_music
) ordered
WHERE ordered.album_id = am.album_id AND ordered.music_id = am.music_id;

ALTER TABLE album_music
    ALTER COLUMN track_number SET NOT NULL,
    ADD CONSTRAINT album_music_track_number_check CHECK (track_number > 0),
    ADD CONSTRAINT album_music_album_id_track_number_key UNIQUE (album_id, track_number);
