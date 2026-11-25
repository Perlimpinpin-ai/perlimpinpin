// Test réel, très bon marché, du mode lot (scripts/lib/claude-lot.js) : une
// seule requête minuscule envoyée en lot à l'API Message Batches. Moins d'un
// dixième de centime. Aucune écriture en base, aucun import de Prisma.
//
//   node scripts/tester-lot.js
//
// Attente maximale : CLAUDE_LOT_ATTENTE_MAX_MIN (40 min par défaut), puis le
// lot est annulé.
import "dotenv/config";
import { envoyerEnLot } from "./lib/claude-lot.js";

// Même tarif que PRICING.claudeSonnet dans scripts/analyze.js (claude-sonnet-5,
// USD / million de tokens), moitié prix en lot.
const PRIX = { input: 2, output: 10 };

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("✗ ANTHROPIC_API_KEY absent.");
  process.exit(1);
}

const debut = Date.now();
const message = await envoyerEnLot(
  {
    model: "claude-sonnet-5",
    max_tokens: 20,
    messages: [{ role: "user", content: "Réponds uniquement : OK" }],
  },
  {
    label: "test lot",
    baseUrl: "https://api.anthropic.com/v1",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
  },
);

const duree = ((Date.now() - debut) / 1000).toFixed(0);
if (!message) {
  console.log(`✗ Pas de résultat après ${duree} s (lot annulé ou expiré).`);
  process.exit(1);
}

const texte = message.content
  .filter((b) => b.type === "text")
  .map((b) => b.text)
  .join("");
const { input_tokens = 0, output_tokens = 0 } = message.usage;
const cout = (0.5 * (input_tokens * PRIX.input + output_tokens * PRIX.output)) / 1_000_000;

console.log(`Attente : ${duree} s`);
console.log(`Réponse : ${texte}`);
console.log("Usage :", JSON.stringify(message.usage));
console.log(`Coût estimé : ~$${cout.toFixed(6)}`);
