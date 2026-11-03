-- =====================================================================
-- Zovic — eventos de reprodução passam a apontar para a música tocada
--
-- Base das estatísticas do painel de admin (acessos por música e por gênero)
-- e das reproduções recentes de cada usuário. Só music_play e music_skip
-- levam música; os demais eventos (cadastro, login, logout) ficam com NULL.
-- Eventos antigos de reprodução continuam válidos sem música: o CHECK só
-- proíbe música em evento que não é de reprodução.
--
-- ON DELETE CASCADE como as demais FKs; músicas removidas pelo painel usam
-- soft delete, então o histórico de reprodução delas continua contando.
-- =====================================================================

ALTER TABLE user_event
    ADD COLUMN music_id integer,
    ADD CONSTRAINT user_event_music_id_fkey FOREIGN KEY (music_id)
        REFERENCES musics (id) ON DELETE CASCADE,
    ADD CONSTRAINT user_event_music_id_check
        CHECK (music_id IS NULL OR event_type IN ('music_play', 'music_skip'));

CREATE INDEX user_event_music_id_idx ON user_event (music_id);
