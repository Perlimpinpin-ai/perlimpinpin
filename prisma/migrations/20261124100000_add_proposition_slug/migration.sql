-- Adresse des fiches reprenant le titre (branche url-titre).
-- Uniquement additif : UNE nouvelle colonne, nulle par défaut, et son index
-- unique (plusieurs NULL restent permis par PostgreSQL). Aucune donnée
-- existante n'est modifiée ; aucun score n'est touché.
-- Le remplissage des fiches déjà publiées est fait à part, par
-- scripts/remplir-slugs.js (simulation d'abord, écriture sur --ecrire).
-- À appliquer seulement après sauvegarde (scripts/sauvegarder-avant-slug.js →
-- logs/sauvegardes/) et accord d'Arno, avec `npx prisma migrate deploy`
-- (jamais `migrate dev` sur la production : pas de shadow database).
-- Retour arrière : DROP INDEX "Proposition_slug_key"; ALTER TABLE "Proposition" DROP COLUMN "slug";
ALTER TABLE "Proposition" ADD COLUMN "slug" TEXT;

CREATE UNIQUE INDEX "Proposition_slug_key" ON "Proposition"("slug");
