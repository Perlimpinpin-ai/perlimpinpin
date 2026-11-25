-- File d'attente des fiches d'étape 1 (page /test/depot, npm run file-attente).
-- Uniquement additif : UNE nouvelle table, son index unique (slug) et un index
-- (statut, createdAt). Aucune table existante n'est modifiée, aucune donnée
-- existante n'est touchée, aucune clé étrangère.
-- À appliquer d'abord sur une branche Neon de test.

-- CreateTable
CREATE TABLE "FicheEtape1" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "contenu" JSONB NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'en_attente',
    "source" TEXT NOT NULL,
    "deposePar" TEXT,
    "erreurs" JSONB,
    "analyseId" INTEGER,
    "coutPipeline" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "traiteeAt" TIMESTAMP(3),

    CONSTRAINT "FicheEtape1_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FicheEtape1_slug_key" ON "FicheEtape1"("slug");

-- CreateIndex
CREATE INDEX "FicheEtape1_statut_createdAt_idx" ON "FicheEtape1"("statut", "createdAt");
