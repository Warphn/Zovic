-- =====================================================================
-- Zovic — imagem de capa do álbum (HU-28)
--
-- cover_file guarda só o nome do arquivo no armazenamento (<uuid>.jpg,
-- .png ou .webp), como musics.audio_file: o diretório (COVER_DIR) pode
-- mudar sem migrar os dados. Fica NULL nos álbuns que já existem; o
-- domínio exige a capa em todo álbum novo.
-- =====================================================================

ALTER TABLE album
    ADD COLUMN cover_file varchar(255);
