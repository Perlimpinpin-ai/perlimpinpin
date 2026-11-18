// Encadré « À relire avant de publier » des pages de partage (publications X,
// carrousel Instagram). `avertissements` : [{ cle, message, fort? }], les
// forts en premier. Jamais bloquant.
export default function EncadreARelire({ avertissements }) {
  if (!avertissements?.length) return null;
  const tries = [...avertissements].sort((a, b) => Number(Boolean(b.fort)) - Number(Boolean(a.fort)));
  return (
    <div role="note" className="rounded-xl border border-orange-300 bg-orange-50 p-4 text-sm text-orange-900">
      <p className="font-semibold">À relire avant de publier</p>
      <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
        {tries.map(({ cle, message, fort }, i) => (
          <li key={i} className={fort ? "font-semibold text-red-700" : undefined}>
            <span className={`font-mono text-xs ${fort ? "text-red-700" : "text-orange-700"}`}>{cle}</span> : {message}
          </li>
        ))}
      </ul>
    </div>
  );
}
