-- =====================================================================
-- Zovic — playlist "Músicas Curtidas" de cada conta (HU-34)
--
-- A coluna marca a playlist fixa que a curtida alimenta e guarda a conta
-- dona dela. É nula nas playlists comuns. O UNIQUE garante uma por conta,
-- mesmo se duas chamadas a criarem ao mesmo tempo (o INSERT usa
-- ON CONFLICT nessa coluna). Os membros continuam em playlist_user, com a
-- conta como admin. A playlist é criada sob demanda pela API, então não há
-- preenchimento para as contas que já existem.
-- =====================================================================

ALTER TABLE playlists
    ADD COLUMN liked_by_user_id integer
        CONSTRAINT playlists_liked_by_user_id_key UNIQUE
        CONSTRAINT playlists_liked_by_user_id_fkey REFERENCES "user" (id) ON DELETE CASCADE;
