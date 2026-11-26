import { rendreFormat } from "../../rendu-format";

// Slides du carrousel « analyse de programme » (charte RS) : voir ../../rendu-format.js.
export async function GET(request, { params }) {
  const { slug } = await params;
  return rendreFormat("programme", slug, request);
}
