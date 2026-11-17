import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crc32, creerZip } from "../src/lib/zip-simple.js";

// Petit lecteur indépendant : relit le répertoire central puis chaque
// en-tête local, et vérifie le CRC de chaque fichier.
function lireZip(archive) {
  const v = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  const fin = archive.length - 22;
  assert.equal(v.getUint32(fin, true), 0x06054b50, "fin du répertoire central");
  const nombre = v.getUint16(fin + 10, true);
  let p = v.getUint32(fin + 16, true);
  const decodeur = new TextDecoder();
  const fichiers = [];
  for (let i = 0; i < nombre; i++) {
    assert.equal(v.getUint32(p, true), 0x02014b50, "entrée du répertoire central");
    const crc = v.getUint32(p + 16, true);
    const taille = v.getUint32(p + 24, true);
    const longueurNom = v.getUint16(p + 28, true);
    const local = v.getUint32(p + 42, true);
    const nom = decodeur.decode(archive.subarray(p + 46, p + 46 + longueurNom));
    assert.equal(v.getUint32(local, true), 0x04034b50, `en-tête local de ${nom}`);
    const debut = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    const donnees = archive.subarray(debut, debut + taille);
    assert.equal(crc32(donnees), crc, `CRC de ${nom}`);
    fichiers.push({ nom, donnees });
    p += 46 + longueurNom + v.getUint16(p + 30, true) + v.getUint16(p + 32, true);
  }
  return fichiers;
}

const FICHIERS = [
  { nom: "01-accroche.png", donnees: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3, 255]) },
  { nom: "script-elevenlabs.txt", donnees: "Bonne idée… ou poudre de Perlimpinpin ?\n" },
  { nom: "plan-de-montage.md", donnees: "# Plan\n\nScène 1 · Accroche\n" },
  { nom: "vide.txt", donnees: "" },
];

test("crc32 : valeurs de référence", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
  assert.equal(crc32(new Uint8Array()), 0);
});

test("creerZip : relu fichier par fichier, contenus et noms UTF-8 intacts", () => {
  const archive = creerZip(FICHIERS, { date: new Date(2026, 10, 17, 10, 4, 22) });
  const relus = lireZip(archive);
  assert.deepEqual(relus.map((f) => f.nom), FICHIERS.map((f) => f.nom));
  assert.deepEqual([...relus[0].donnees], [...FICHIERS[0].donnees]);
  assert.equal(new TextDecoder().decode(relus[1].donnees), FICHIERS[1].donnees);
  assert.equal(relus[3].donnees.length, 0);
});

test("creerZip : l'archive s'ouvre avec unzip (si disponible)", (t) => {
  const present = spawnSync("unzip", ["-v"], { encoding: "utf8" });
  if (present.error || present.status !== 0) return t.skip("unzip absent de cette machine");
  const dossier = mkdtempSync(join(tmpdir(), "zip-simple-"));
  try {
    const chemin = join(dossier, "test.zip");
    writeFileSync(chemin, creerZip(FICHIERS));
    const controle = spawnSync("unzip", ["-t", chemin], { encoding: "utf8" });
    assert.equal(controle.status, 0, controle.stdout + controle.stderr);
    assert.match(controle.stdout, /No errors detected/);
    const texte = spawnSync("unzip", ["-p", chemin, "script-elevenlabs.txt"], { encoding: "utf8" });
    assert.equal(texte.stdout, FICHIERS[1].donnees);
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
});

test("creerZip : contenu de type inattendu refusé", () => {
  assert.throws(() => creerZip([{ nom: "x", donnees: 42 }]), TypeError);
});
