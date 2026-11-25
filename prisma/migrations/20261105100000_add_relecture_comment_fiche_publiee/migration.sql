-- Club ouvert, lot 2 : annotations sur les fiches publiées.
-- Uniquement additif : deux colonnes FACULTATIVES, un index, une clé étrangère.
-- Aucune donnée existante n'est modifiée ni supprimée.
-- À appliquer d'abord sur la branche Neon preview-club-ouvert, jamais
-- directement en production.

-- AlterTable
ALTER TABLE "RelectureComment" ADD COLUMN     "analyseId" INTEGER,
ADD COLUMN     "creditAccord" BOOLEAN;

-- CreateIndex
CREATE INDEX "RelectureComment_analyseId_idx" ON "RelectureComment"("analyseId");

-- AddForeignKey
ALTER TABLE "RelectureComment" ADD CONSTRAINT "RelectureComment_analyseId_fkey" FOREIGN KEY ("analyseId") REFERENCES "Analyse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
