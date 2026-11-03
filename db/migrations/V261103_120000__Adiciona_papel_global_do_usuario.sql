-- =====================================================================
-- Zovic — papel global do usuário na plataforma
--
-- Diferente de plan_user.is_admin (admin de uma assinatura) e de
-- playlist_user.is_admin (admin de uma playlist): este papel vale para a
-- plataforma inteira e libera as rotas /api/admin.
--
-- Enum em vez de boolean para caber um papel intermediário depois (ex.:
-- curador do catálogo) sem trocar o tipo da coluna.
-- O cliente não escolhe o papel no cadastro (input: false em
-- api/adapters/auth/create-auth.ts); o primeiro admin é promovido pelo
-- script `bun run admin:promote <email>`.
-- =====================================================================

CREATE TYPE user_role AS ENUM ('user', 'admin');

ALTER TABLE "user"
    ADD COLUMN role user_role NOT NULL DEFAULT 'user';
