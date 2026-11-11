import { depuis, empreinte, estBloque } from "./limite-connexion-core.js";

// Compteur des essais ratés de connexion au Club (voir limite-connexion-core.js).
//
// Stockage : table TentativeConnexion (une ligne par essai raté, écriture par
// AJOUT seulement, empreintes uniquement). Tant que cette table n'existe pas
// sur la base (migration 20261111100000_add_tentative_connexion pas encore
// appliquée), ou si la base ne répond pas, on se replie sur un compteur en
// mémoire du serveur : moins fiable (une instance Vercel ne voit pas les
// autres) mais jamais bloquant pour une connexion légitime.
// La base est passée en paramètre (tests : scripts/limite-connexion.test.js).

const memoire = []; // { cleEmail, cleIp, t }
let replieSignale = false;

function signalerRepli(error) {
  if (replieSignale) return;
  replieSignale = true;
  console.warn("[club] limite de connexion : repli en mémoire (table TentativeConnexion indisponible) :", error?.code ?? error?.message);
}

function nettoyerMemoire(limite) {
  while (memoire.length && memoire[0].t < limite) memoire.shift();
}

function cles(email, ip, sel = process.env.AUTH_SECRET) {
  return { cleEmail: empreinte("email", email, sel), cleIp: empreinte("ip", ip, sel) };
}

// Vrai si la connexion doit être refusée (trop d'essais ratés récents).
export async function connexionBloquee({ email, ip, prisma, maintenant = Date.now() }) {
  const { cleEmail, cleIp } = cles(email, ip);
  const limite = depuis(maintenant);
  try {
    const [echecsEmail, echecsIp] = await Promise.all([
      cleEmail ? prisma.tentativeConnexion.count({ where: { cleEmail, createdAt: { gte: limite } } }) : 0,
      cleIp ? prisma.tentativeConnexion.count({ where: { cleIp, createdAt: { gte: limite } } }) : 0,
    ]);
    return estBloque({ echecsEmail, echecsIp });
  } catch (error) {
    signalerRepli(error);
    nettoyerMemoire(limite.getTime());
    return estBloque({
      echecsEmail: cleEmail ? memoire.filter((e) => e.cleEmail === cleEmail).length : 0,
      echecsIp: cleIp ? memoire.filter((e) => e.cleIp === cleIp).length : 0,
    });
  }
}

// Note un essai raté (création seulement ; jamais d'erreur remontée).
export async function noterEchec({ email, ip, prisma, maintenant = Date.now() }) {
  const { cleEmail, cleIp } = cles(email, ip);
  if (!cleEmail && !cleIp) return;
  try {
    await prisma.tentativeConnexion.create({ data: { espace: "relectures", cleEmail, cleIp } });
  } catch (error) {
    signalerRepli(error);
    memoire.push({ cleEmail, cleIp, t: maintenant });
  }
}
