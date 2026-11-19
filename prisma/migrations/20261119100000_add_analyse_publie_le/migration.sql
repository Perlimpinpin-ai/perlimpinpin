-- Date de publication des analyses (branche date-publication).
-- Uniquement additif : UNE nouvelle colonne, nulle par défaut. Aucune donnée
-- existante n'est supprimée ni modifiée en dehors de cette colonne ; le score,
-- les textes et Proposition.dateDeclaration ne sont pas touchés.
-- À appliquer d'abord sur une branche Neon de test, puis sur la production
-- après sauvegarde (logs/sauvegardes/) et accord d'Arno.
ALTER TABLE "Analyse" ADD COLUMN "publieLe" TIMESTAMP(3);

-- Rattrapage : les fiches déjà en ligne (et les anciennes versions remplacées)
-- reprennent leur date actuelle (createdAt), pour que l'ordre des listes et la
-- date affichée ne changent pas. Les brouillons et la corbeille restent nuls.
UPDATE "Analyse" SET "publieLe" = "createdAt" WHERE "statut" IN ('publie', 'remplacee') AND "publieLe" IS NULL;
