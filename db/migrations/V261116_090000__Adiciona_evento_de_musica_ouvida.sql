-- =====================================================================
-- Zovic — evento de música ouvida (HU-15)
--
-- Uma música conta como ouvida quando toca por mais de 30 segundos numa
-- mesma reprodução. Cada reprodução que passa desse limite grava um
-- music_listened em user_event, com a música. A aba "Já ouvidas" do
-- histórico e o ícone nas listas de faixas leem esses eventos.
--
-- O CHECK que aceita a música no evento muda na migração seguinte: o
-- Postgres não deixa usar um valor novo de enum na mesma transação em
-- que ele foi criado, e o Flyway roda cada migração numa transação.
-- =====================================================================

ALTER TYPE user_event_type ADD VALUE 'music_listened';
