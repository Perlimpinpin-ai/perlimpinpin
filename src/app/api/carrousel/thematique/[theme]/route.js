import { rendreFormat } from "../../rendu-format";

// Slides du carrousel « thématique » (charte RS) : voir ../../rendu-format.js.
export async function GET(request, { params }) {
  const { theme } = await params;
  return rendreFormat("thematique", theme, request);
}
