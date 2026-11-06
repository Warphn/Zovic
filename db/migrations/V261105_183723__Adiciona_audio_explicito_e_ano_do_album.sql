-- =====================================================================
-- Zovic — áudio e conteúdo explícito na música, ano no álbum (HU-28)
--
-- audio_file guarda só o nome do arquivo no armazenamento (<uuid>.mp3), e
-- não um caminho absoluto: o diretório (AUDIO_DIR) pode mudar sem migrar os
-- dados. Fica NULL nas músicas que já existem, que não têm áudio; o domínio
-- exige o arquivo em toda música nova.
--
-- year é opcional porque os álbuns que já existem não têm ano. O limite
-- "até o ano atual" não cabe num CHECK (o valor muda com o tempo), então
-- quem o garante é o domínio (Album.create e Album.changeYear).
-- =====================================================================

ALTER TABLE musics
    ADD COLUMN audio_file  varchar(255),
    ADD COLUMN is_explicit boolean NOT NULL DEFAULT false;

ALTER TABLE album
    ADD COLUMN year smallint,
    ADD CONSTRAINT album_year_check CHECK (year >= 1900);
