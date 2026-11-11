-- Club ouvert, lot 4 : revue du dimanche.
-- Uniquement additif : cinq NOUVELLES tables, leurs index et clés étrangères.
-- Aucune table existante n'est modifiée (les relations ajoutées dans
-- schema.prisma sur Analyse et RelectureComment sont des relations inverses,
-- sans colonne). Aucune donnée existante n'est touchée.
-- À appliquer d'abord sur la branche Neon preview-club-ouvert, jamais
-- directement en production.

-- CreateTable
CREATE TABLE "RevueLot" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "propositionId" INTEGER,
    "clotureAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevueLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevueEtape" (
    "id" SERIAL NOT NULL,
    "revueLotId" INTEGER NOT NULL,
    "etape" TEXT NOT NULL,
    "batchId" TEXT,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevueEtape_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TriAnnotation" (
    "id" SERIAL NOT NULL,
    "commentId" TEXT NOT NULL,
    "categorie" TEXT NOT NULL,
    "justification" TEXT,
    "reponse" TEXT,
    "source" TEXT NOT NULL,
    "revueLotId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TriAnnotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevisionProposee" (
    "id" SERIAL NOT NULL,
    "revueLotId" INTEGER NOT NULL,
    "propositionId" INTEGER NOT NULL,
    "analyseSourceId" INTEGER NOT NULL,
    "contenuPropose" JSONB NOT NULL,
    "resume" JSONB NOT NULL,
    "commentIds" JSONB NOT NULL,
    "etapes23" BOOLEAN NOT NULL DEFAULT false,
    "coutPipeline" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevisionProposee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionRevision" (
    "id" SERIAL NOT NULL,
    "revisionId" INTEGER NOT NULL,
    "decision" TEXT NOT NULL,
    "analysePublieeId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RevueLot_createdAt_idx" ON "RevueLot"("createdAt");

-- CreateIndex
CREATE INDEX "RevueEtape_revueLotId_createdAt_idx" ON "RevueEtape"("revueLotId", "createdAt");

-- CreateIndex
CREATE INDEX "TriAnnotation_commentId_createdAt_idx" ON "TriAnnotation"("commentId", "createdAt");

-- CreateIndex
CREATE INDEX "TriAnnotation_revueLotId_idx" ON "TriAnnotation"("revueLotId");

-- CreateIndex
CREATE INDEX "RevisionProposee_propositionId_createdAt_idx" ON "RevisionProposee"("propositionId", "createdAt");

-- CreateIndex
CREATE INDEX "RevisionProposee_revueLotId_idx" ON "RevisionProposee"("revueLotId");

-- CreateIndex
CREATE INDEX "DecisionRevision_revisionId_createdAt_idx" ON "DecisionRevision"("revisionId", "createdAt");

-- AddForeignKey
ALTER TABLE "RevueEtape" ADD CONSTRAINT "RevueEtape_revueLotId_fkey" FOREIGN KEY ("revueLotId") REFERENCES "RevueLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriAnnotation" ADD CONSTRAINT "TriAnnotation_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "RelectureComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriAnnotation" ADD CONSTRAINT "TriAnnotation_revueLotId_fkey" FOREIGN KEY ("revueLotId") REFERENCES "RevueLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionProposee" ADD CONSTRAINT "RevisionProposee_revueLotId_fkey" FOREIGN KEY ("revueLotId") REFERENCES "RevueLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionProposee" ADD CONSTRAINT "RevisionProposee_analyseSourceId_fkey" FOREIGN KEY ("analyseSourceId") REFERENCES "Analyse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionRevision" ADD CONSTRAINT "DecisionRevision_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "RevisionProposee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionRevision" ADD CONSTRAINT "DecisionRevision_analysePublieeId_fkey" FOREIGN KEY ("analysePublieeId") REFERENCES "Analyse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
