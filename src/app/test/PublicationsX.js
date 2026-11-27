/* eslint-disable @next/next/no-img-element -- image générée par /api/carte, déjà au bon format. */
import { cheminCarte, slugCandidat, titreCarte } from "@/lib/carte";
import { LONGUEUR_X_MAX, avertissementsReseaux, tweetsReseaux, valeursReseaux } from "@/lib/reseaux";
import EncadreARelire from "./EncadreARelire";
import TweetModifiable from "./TweetModifiable";

// « Publications X » d'une fiche : pour chaque format, l'image (route
// /api/carte/[id]) et les tweets, marqueurs remplis. Composant serveur, montré
// seulement aux personnes déverrouillées (/test/[id] et /test/reseaux/[id]).
// Rien n'est jamais écrit en base d'ici : pour corriger durablement un texte,
// on passe par le chat avec Claude.
// `partage` (page de partage) : bouton Télécharger, et chaque tweet modifiable
// sur place (compteur X en direct, Copier et Ouvrir dans X sur le texte modifié).

const FORMATS = [
  { format: "score", titre: "La carte", moment: "jour J", prefixe: "fil." },
  { format: "chiffre", titre: "Le chiffre", moment: "J+2", prefixe: "chiffre." },
  { format: "tient", titre: "Tient / tient pas", moment: "J+4", prefixe: "tient." },
];

function Tweet({ tweet, numero, partage }) {
  if (partage) return <TweetModifiable numero={numero} texteInitial={tweet.texte} />;
  const tropLong = tweet.longueur > LONGUEUR_X_MAX;
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2 text-xs text-zinc-500">
        <span className="font-semibold uppercase tracking-wide">{numero}</span>
        <span className={tropLong ? "font-semibold text-red-700" : ""}>
          {tweet.longueur} / {LONGUEUR_X_MAX}
          {tropLong ? " : trop long" : ""}
        </span>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-900">{tweet.texte}</p>
    </li>
  );
}

// Points « tient / tient pas » : le texte de l'image, et dessous la version
// courte reprise dans le tweet, pour vérifier qu'ils disent la même chose.
function PointsTient({ tient }) {
  const cotes = [
    ["✅ Ce qui tient", tient.tient, tient.tient_court],
    ["❌ Ce qui ne tient pas", tient.tient_pas, tient.tient_pas_court],
  ];
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 text-sm">
      {cotes.map(([titre, textes, courts]) => (
        <div key={titre} className="flex flex-col gap-2">
          <p className="font-semibold text-zinc-900">{titre}</p>
          <ul className="flex flex-col gap-2">
            {textes.map((texte, i) => (
              <li key={i} className="flex flex-col">
                <span className="text-zinc-900">{texte}</span>
                {courts?.[i] ? (
                  <span className="text-zinc-500">
                    Tweet{i >= 2 ? " (non repris)" : ""} : {courts[i]}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default function PublicationsX({ proposition, analyse, brouillon = false, partage = false }) {
  const candidatNom = proposition.candidat.nom;
  const reseaux = analyse.contenuComplet?.reseaux ?? null;
  const carte = {
    propositionId: proposition.id,
    analyseId: analyse.id,
    titre: titreCarte(proposition),
    candidatNom,
    score: analyse.scoreFaisabilite,
    reseaux,
    brouillon,
  };
  const tweets = tweetsReseaux(
    reseaux,
    valeursReseaux({ candidatNom, score: analyse.scoreFaisabilite, propositionId: proposition.id, slug: proposition.slug }),
  );

  // Points à relire (jamais bloquants) : tweet trop long (avertissement fort,
  // en premier), candidat non nommé, titre écrit par le modèle, point retiré
  // du tweet, version courte sans sujet, nombres côte à côte…
  const avertissements = avertissementsReseaux(reseaux, {
    valeurs: valeursReseaux({ candidatNom, score: analyse.scoreFaisabilite, propositionId: proposition.id, slug: proposition.slug }),
  });

  return (
    <div className="flex flex-col gap-8">
      <EncadreARelire avertissements={avertissements} />

      {reseaux ? null : (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Pas encore de textes pour cette fiche (étape 3 ter absente ou refusée). Seule la carte du score
          est disponible. Pour les générer :{" "}
          <code>
            node scripts/reseaux.js {proposition.id}
            {brouillon ? " --brouillon" : ""} --dry-run
          </code>
          .
        </p>
      )}

      {FORMATS.filter(({ format }) => format === "score" || reseaux).map(({ format, titre, moment, prefixe }, index) => {
        const image = cheminCarte({ ...carte, format });
        const duFormat = tweets.filter((tweet) => tweet.cle.startsWith(prefixe));
        return (
          <section key={format} className="grid gap-6 md:grid-cols-[minmax(0,360px)_1fr]">
            <div className="flex flex-col gap-3">
              <h3 className="text-base font-semibold text-zinc-900">
                {index + 1}. {titre} <span className="font-normal text-zinc-500">({moment})</span>
              </h3>
              <a href={image} target="_blank" rel="noopener noreferrer">
                <img
                  src={image}
                  alt={`Carte « ${titre} » de la fiche ${proposition.id}`}
                  width={360}
                  height={360}
                  loading="lazy"
                  className="w-full max-w-[360px] rounded-xl border border-zinc-200 bg-white"
                />
              </a>
              {partage ? (
                <a
                  href={image}
                  download={`perlimpinpin-${slugCandidat(proposition.candidat)}-${proposition.id}-${format}.png`}
                  className="self-start rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-zinc-800"
                >
                  Télécharger l&rsquo;image
                </a>
              ) : null}
            </div>
            {duFormat.length > 0 ? (
              <ol className="flex flex-col gap-3">
                {format === "tient" ? (
                  <li>
                    <PointsTient tient={reseaux.tient} />
                  </li>
                ) : null}
                {duFormat.map((tweet, i) => (
                  <Tweet
                    key={tweet.cle}
                    tweet={tweet}
                    numero={format === "score" ? `Tweet ${i + 1}/${duFormat.length}` : "Tweet"}
                    partage={partage}
                  />
                ))}
              </ol>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
