// Haut des pages de Reel : la check-list « Vérifications avant publication »
// (charte RS p. 20, cochée par le code quand c'est vérifiable), les points à
// valider et les couleurs utilisées par chaque scène (contrôle de la palette).

const ETATS = {
  ok: { signe: "✓", classe: "bg-emerald-100 text-emerald-800" },
  ko: { signe: "✗", classe: "bg-red-100 text-red-800" },
  manuel: { signe: "?", classe: "bg-amber-100 text-amber-900" },
  "sans-objet": { signe: "–", classe: "bg-zinc-100 text-zinc-500" },
};

export default function VerificationsReel({ checkList, avertissements = [], zones = [], couleurs = null }) {
  const points = [...avertissements, ...zones];
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 text-sm">
        <p className="font-semibold">Vérifications avant publication (charte, p. 20)</p>
        <ul className="flex flex-col gap-2">
          {checkList.map((item) => (
            <li key={item.texte} className="flex gap-2">
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs font-bold ${ETATS[item.etat].classe}`}>{ETATS[item.etat].signe}</span>
              <span>
                {item.texte} <span className="text-zinc-500">{item.detail}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-zinc-400">✓ vérifié par le code · ✗ à corriger · ? à vérifier à l’œil · – sans objet</p>
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Points à valider ({points.length})</p>
          {points.length === 0 ? (
            <p>Aucun : contrôles passés, rien ne déborde des zones sûres.</p>
          ) : (
            <ul className="list-disc pl-5">
              {points.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
        </div>
        {couleurs ? (
          <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 text-sm">
            <p className="font-semibold">Couleurs par scène {couleurs.horsPalette?.length ? <span className="text-red-700">· {couleurs.horsPalette.length} hors palette (refus)</span> : <span className="text-zinc-500">· toutes dans la palette</span>}</p>
            <ul className="flex flex-col gap-1">
              {couleurs.parScene.map((p) => (
                <li key={p.scene} className="flex flex-wrap items-center gap-1">
                  <span className="w-36 shrink-0 text-xs text-zinc-500">
                    {p.scene}. {p.type}
                  </span>
                  {p.couleurs.map((c) => (
                    <span key={c} title={c} className={`h-4 w-4 rounded-sm border ${couleurs.horsPalette?.includes(c) ? "border-red-600" : "border-zinc-300"}`} style={{ backgroundColor: c }} />
                  ))}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
