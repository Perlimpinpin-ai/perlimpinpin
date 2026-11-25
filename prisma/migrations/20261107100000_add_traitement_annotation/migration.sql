-- Club ouvert, lot 5 : versions et historique.
-- Uniquement additif : UNE nouvelle table, ses index et clés étrangères.
-- Aucune table existante n'est modifiée (les relations ajoutées dans
-- schema.prisma sur Analyse, RelectureComment et DecisionRevision sont des
-- relations inverses, sans colonne). Aucune donnée existante n'est touchée.
-- À appliquer d'abord sur la branche Neon preview-club-ouvert, jamais
-- directement en production.

-- CreateTable
CREATE TABLE "TraitementAnnotation" (
    "id" SERIAL NOT NULL,
    "commentId" TEXT NOT NULL,
    "etat" TEXT NOT NULL,
    "analyseId" INTEGER,
    "decisionId" INTEGER,
    "categorie" TEXT,
    "reponse" TEXT,
    "retenu" BOOLEAN NOT NULL DEFAULT false,
    "rattachement" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TraitementAnnotation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TraitementAnnotation_commentId_createdAt_idx" ON "TraitementAnnotation"("commentId", "createdAt");

-- CreateIndex
CREATE INDEX "TraitementAnnotation_analyseId_idx" ON "TraitementAnnotation"("analyseId");

-- AddForeignKey
ALTER TABLE "TraitementAnnotation" ADD CONSTRAINT "TraitementAnnotation_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "RelectureComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraitementAnnotation" ADD CONSTRAINT "TraitementAnnotation_analyseId_fkey" FOREIGN KEY ("analyseId") REFERENCES "Analyse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraitementAnnotation" ADD CONSTRAINT "TraitementAnnotation_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "DecisionRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
