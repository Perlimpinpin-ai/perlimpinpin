import FormatReel from "../../FormatReel";

// Reel « programme » d'un candidat : /test/reseaux/programme/<slug du candidat>.
export const dynamic = "force-dynamic";
export const metadata = { title: "Reel programme — Perlimpinpin", robots: { index: false, follow: false } };

export default async function ProgrammePage({ params, searchParams }) {
  const { slug } = await params;
  return <FormatReel format="programme" cible={slug} searchParams={searchParams} />;
}
