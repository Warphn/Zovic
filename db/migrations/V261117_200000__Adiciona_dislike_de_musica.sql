-- =====================================================================
-- Zovic — dislike de música (HU-20)
--
-- Cada linha é o dislike de uma conta numa música. A chave primária nas
-- duas colunas garante um dislike por conta e música. O like continua
-- sendo a música estar na Músicas Curtidas (HU-34). A API garante um
-- voto por conta: dar dislike tira o like, e dar like tira o dislike.
-- A recomendação (HU-25) não sugere música com dislike da conta.
-- =====================================================================

CREATE TABLE music_dislikes (
    user_id    integer     NOT NULL,
    music_id   integer     NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT music_dislikes_pkey PRIMARY KEY (user_id, music_id),
    CONSTRAINT music_dislikes_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES "user" (id) ON DELETE CASCADE,
    CONSTRAINT music_dislikes_music_id_fkey FOREIGN KEY (music_id)
        REFERENCES musics (id) ON DELETE CASCADE
);
