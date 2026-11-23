"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EVENEMENT_LANCEMENT } from "./LancerBouton";

const INTERVALLE_MS = 15_000;
// Après un clic, le runner GitHub met environ une minute à prendre la première
// fiche : on rafraîchit pendant 10 minutes au plus, même sans fiche « en cours ».
const APRES_LANCEMENT_MS = 10 * 60_000;

// Rafraîchit la liste toutes les 15 s tant qu'une fiche est en cours (enCours,
// calculé par la page) ou peu après un lancement ; s'arrête sinon.
export default function RafraichissementAuto({ enCours }) {
  const router = useRouter();
  const [lanceA, setLanceA] = useState(null);

  useEffect(() => {
    const surLancement = () => setLanceA(Date.now());
    window.addEventListener(EVENEMENT_LANCEMENT, surLancement);
    return () => window.removeEventListener(EVENEMENT_LANCEMENT, surLancement);
  }, []);

  useEffect(() => {
    if (!enCours && lanceA == null) return;
    const id = setInterval(() => {
      if (!enCours && lanceA != null && Date.now() - lanceA > APRES_LANCEMENT_MS) {
        setLanceA(null);
        return;
      }
      router.refresh();
    }, INTERVALLE_MS);
    return () => clearInterval(id);
  }, [enCours, lanceA, router]);

  if (!enCours && lanceA == null) return null;
  return <p className="text-xs text-zinc-500">Mise à jour automatique toutes les 15 secondes.</p>;
}
