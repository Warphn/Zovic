-- =====================================================================
-- Zovic — busca do catálogo (GET /api/search)
--
-- A busca não diferencia acentos ("agua" acha "Águas"): compara
-- lower(unaccent(nome)) dos dois lados. A extensão vem com o Postgres e é
-- "trusted", então não precisa de superusuário.
--
-- Sem índices por enquanto: o catálogo é pequeno e a leitura sequencial é
-- instantânea. Quando crescer, o caminho é pg_trgm com índice GIN sobre uma
-- função IMMUTABLE que embrulhe unaccent (unaccent é só STABLE e não entra
-- direto num índice).
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS unaccent;
