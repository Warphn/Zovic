-- =====================================================================
-- Zovic — imagem de capa da playlist (HU-35) e foto do artista (HU-36)
--
-- Como album.cover_file: guarda só o nome do arquivo no armazenamento
-- (<uuid>.jpg, .png ou .webp), no mesmo diretório das capas (COVER_DIR).
-- As duas são opcionais: NULL é a playlist ou o artista sem imagem.
-- =====================================================================

ALTER TABLE playlists
    ADD COLUMN cover_file varchar(255);

ALTER TABLE artist
    ADD COLUMN image_file varchar(255);
