-- =====================================================================
-- Zovic — papel do usuário na plataforma (issue #1: admin, assinante e visitante)
--
-- "visitante" é quem não tem conta, então não aparece no banco. Toda conta nasce
-- assinante; virar admin só acontece direto no banco (não há rota da API que mude
-- o papel, e o Better Auth recusa o campo no cadastro: input: false).
--
-- Não confundir com plan_user.is_admin (dono do plano família) nem com
-- playlist_user.is_admin (quem administra uma playlist).
--
-- "Maior de idade" não é coluna: a API calcula a partir de birthdate a cada
-- requisição, para não ficar desatualizado no aniversário.
-- =====================================================================

ALTER TABLE "user"
    ADD COLUMN role varchar(20) NOT NULL DEFAULT 'assinante',
    ADD CONSTRAINT user_role_check CHECK (role IN ('admin', 'assinante'));
