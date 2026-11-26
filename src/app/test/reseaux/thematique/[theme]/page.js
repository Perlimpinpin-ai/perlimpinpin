import FormatReel from "../../FormatReel";

// Reel « thématique » : /test/reseaux/thematique/<slug du thème>.
export const dynamic = "force-dynamic";
export const metadata = { title: "Reel thématique — Perlimpinpin", robots: { index: false, follow: false } };

export default async function ThematiquePage({ params, searchParams }) {
  const { theme } = await params;
  return <FormatReel format="thematique" cible={theme} searchParams={searchParams} />;
}
