-- =====================================================================
-- Quem removeu o comentário (HU-23)
-- =====================================================================
-- A remoção continua lógica (deleted_at). deleted_by guarda quem removeu: o próprio autor ou o
-- admin que moderou. Os comentários removidos antes desta migration ficam sem esse registro.
-- Apagar a conta de quem removeu não desfaz a remoção, só perde o registro.

ALTER TABLE comments
    ADD COLUMN deleted_by integer,
    ADD CONSTRAINT comments_deleted_by_fkey FOREIGN KEY (deleted_by)
        REFERENCES "user" (id) ON DELETE SET NULL,
    ADD CONSTRAINT comments_deleted_by_check CHECK (deleted_by IS NULL OR deleted_at IS NOT NULL);
