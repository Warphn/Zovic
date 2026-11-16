-- =====================================================================
-- Zovic — o evento music_listened também leva a música (HU-15)
--
-- Até aqui só music_play e music_skip podiam ter music_id. O valor
-- music_listened entrou no enum na migração anterior.
-- =====================================================================

ALTER TABLE user_event
    DROP CONSTRAINT user_event_music_id_check,
    ADD CONSTRAINT user_event_music_id_check
        CHECK (music_id IS NULL OR event_type IN ('music_play', 'music_skip', 'music_listened'));
