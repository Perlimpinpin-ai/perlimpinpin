-- Limite des tentatives de connexion au Club.
-- Uniquement additif : UNE nouvelle table et ses deux index. Aucune table
-- existante n'est modifiée, aucune donnée existante n'est touchée.
-- Le code fonctionne aussi sans cette table (compteur de repli en mémoire),
-- elle peut donc être appliquée avant ou après le déploiement.
-- À appliquer d'abord sur la branche Neon preview-club-ouvert.

-- CreateTable
CREATE TABLE "TentativeConnexion" (
    "id" SERIAL NOT NULL,
    "espace" TEXT NOT NULL,
    "cleEmail" TEXT,
    "cleIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TentativeConnexion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TentativeConnexion_cleEmail_createdAt_idx" ON "TentativeConnexion"("cleEmail", "createdAt");

-- CreateIndex
CREATE INDEX "TentativeConnexion_cleIp_createdAt_idx" ON "TentativeConnexion"("cleIp", "createdAt");
