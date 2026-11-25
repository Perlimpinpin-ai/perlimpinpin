-- Espace du Club : mesures proposées à l'analyse par les adhérents.
-- Uniquement additif : UNE nouvelle table, un index et une clé étrangère vers
-- "Adherent". Aucune table existante n'est modifiée, aucune donnée existante
-- n'est touchée. Sans cette table, la page du Club fonctionne (l'onglet
-- « Proposer une mesure » affiche alors « bientôt disponible »).
-- À appliquer d'abord sur la branche Neon preview-club-ouvert.

-- CreateTable
CREATE TABLE "PropositionClub" (
    "id" SERIAL NOT NULL,
    "adherentId" INTEGER,
    "candidat" TEXT NOT NULL,
    "mesure" TEXT NOT NULL,
    "source" TEXT,
    "pourquoi" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'recue',
    "reponse" TEXT,
    "propositionId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropositionClub_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PropositionClub_adherentId_createdAt_idx" ON "PropositionClub"("adherentId", "createdAt");

-- AddForeignKey
ALTER TABLE "PropositionClub" ADD CONSTRAINT "PropositionClub_adherentId_fkey" FOREIGN KEY ("adherentId") REFERENCES "Adherent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
