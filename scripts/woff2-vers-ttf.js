// Décompresse une police WOFF2 en TTF/OTF lisible par next/og (Satori ne lit
// pas le woff2). Sert à sortir les polices embarquées dans les gabarits HTML
// des kits (kit carrousel : DM Serif Display, charte RS v1, novembre 2026).
// Sans dépendance : brotli de node:zlib et reconstruction de la table glyf
// transformée (spécification W3C WOFF2, section 5.1).
//
//   node scripts/woff2-vers-ttf.js <entrée.woff2> <sortie.ttf>
//   node scripts/woff2-vers-ttf.js --gabarit <gabarit.html> <dossier>   (toutes les @font-face)

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { brotliDecompressSync } from "node:zlib";
import { pathToFileURL } from "node:url";

const TAGS = ["cmap", "head", "hhea", "hmtx", "maxp", "name", "OS/2", "post", "cvt ", "fpgm", "glyf", "loca", "prep", "CFF ", "VORG", "EBDT", "EBLC", "gasp", "hdmx", "kern", "LTSH", "PCLT", "VDMX", "vhea", "vmtx", "BASE", "GDEF", "GPOS", "GSUB", "EBSC", "JSTF", "MATH", "CBDT", "CBLC", "COLR", "CPAL", "SVG ", "sbix", "acnt", "avar", "bdat", "bloc", "bsln", "cvar", "fdsc", "feat", "fmtx", "fvar", "gvar", "hsty", "just", "lcar", "mort", "morx", "opbd", "prop", "trak", "Zapf", "Silf", "Glat", "Gloc", "Feat", "Sill"];

class Lecteur {
  constructor(buf, pos = 0) {
    this.buf = buf;
    this.pos = pos;
  }
  u8() {
    return this.buf[this.pos++];
  }
  u16() {
    const v = this.buf.readUInt16BE(this.pos);
    this.pos += 2;
    return v;
  }
  i16() {
    const v = this.buf.readInt16BE(this.pos);
    this.pos += 2;
    return v;
  }
  u32() {
    const v = this.buf.readUInt32BE(this.pos);
    this.pos += 4;
    return v;
  }
  base128() {
    let v = 0;
    for (let i = 0; i < 5; i++) {
      const c = this.u8();
      v = v * 128 + (c & 0x7f);
      if (!(c & 0x80)) return v;
    }
    throw new Error("UIntBase128 invalide");
  }
  u255() {
    const code = this.u8();
    if (code === 253) return this.u16();
    if (code === 255) return this.u8() + 253;
    if (code === 254) return this.u8() + 506;
    return code;
  }
  octets(n) {
    const b = this.buf.subarray(this.pos, this.pos + n);
    this.pos += n;
    return b;
  }
}

const avecSigne = (drapeau, base) => (drapeau & 1 ? base : -base);

// Reconstruction des tables glyf et loca (loca toujours au format long).
function reconstruireGlyf(donnees) {
  const r = new Lecteur(donnees);
  r.u16(); // réservé
  const options = r.u16();
  const nbGlyphes = r.u16();
  r.u16(); // indexFormat d'origine (on écrit toujours le format long)
  const tailles = Array.from({ length: 7 }, () => r.u32());
  let p = r.pos;
  const flux = tailles.map((t) => {
    const l = new Lecteur(donnees, p);
    p += t;
    return l;
  });
  const [contours, points, drapeaux, glyphes, composites, boites, instructions] = flux;
  const recouvrement = options & 1 ? donnees.subarray(p, p + ((nbGlyphes + 7) >> 3)) : null;
  const tailleBitmap = 4 * Math.floor((nbGlyphes + 31) / 32);
  const bitmapBoites = boites.octets(tailleBitmap);

  const morceaux = [];
  const offsets = [0];
  let total = 0;
  for (let g = 0; g < nbGlyphes; g++) {
    const nContours = contours.i16();
    const boiteExplicite = (bitmapBoites[g >> 3] >> (7 - (g & 7))) & 1;
    let sortie = Buffer.alloc(0);
    if (nContours === 0) {
      // glyphe vide
    } else if (nContours === -1) {
      if (!boiteExplicite) throw new Error(`glyphe composite ${g} sans boîte`);
      const boite = boites.octets(8);
      const debut = composites.pos;
      let avecInstructions = false;
      for (;;) {
        const f = composites.u16();
        composites.u16();
        composites.pos += f & 0x0001 ? 4 : 2;
        if (f & 0x0008) composites.pos += 2;
        else if (f & 0x0040) composites.pos += 4;
        else if (f & 0x0080) composites.pos += 8;
        if (f & 0x0100) avecInstructions = true;
        if (!(f & 0x0020)) break;
      }
      const corps = composites.buf.subarray(debut, composites.pos);
      const parties = [Buffer.from([0xff, 0xff]), boite, corps];
      if (avecInstructions) {
        const n = glyphes.u255();
        const lg = Buffer.alloc(2);
        lg.writeUInt16BE(n);
        parties.push(lg, instructions.octets(n));
      }
      sortie = Buffer.concat(parties);
    } else {
      const finsContours = [];
      let n = 0;
      for (let c = 0; c < nContours; c++) {
        n += points.u255();
        finsContours.push(n - 1);
      }
      const pts = [];
      let x = 0;
      let y = 0;
      for (let i = 0; i < n; i++) {
        let f = drapeaux.u8();
        const surCourbe = !(f >> 7);
        f &= 0x7f;
        let dx;
        let dy;
        if (f < 10) {
          dx = 0;
          dy = avecSigne(f, ((f & 14) << 7) + glyphes.u8());
        } else if (f < 20) {
          dx = avecSigne(f, (((f - 10) & 14) << 7) + glyphes.u8());
          dy = 0;
        } else if (f < 84) {
          const b0 = f - 20;
          const b1 = glyphes.u8();
          dx = avecSigne(f, 1 + (b0 & 0x30) + (b1 >> 4));
          dy = avecSigne(f >> 1, 1 + ((b0 & 0x0c) << 2) + (b1 & 0x0f));
        } else if (f < 120) {
          const b0 = f - 84;
          const a = glyphes.u8();
          const b = glyphes.u8();
          dx = avecSigne(f, 1 + (Math.floor(b0 / 12) << 8) + a);
          dy = avecSigne(f >> 1, 1 + (((b0 % 12) >> 2) << 8) + b);
        } else if (f < 124) {
          const a = glyphes.u8();
          const b2 = glyphes.u8();
          const c = glyphes.u8();
          dx = avecSigne(f, (a << 4) + (b2 >> 4));
          dy = avecSigne(f >> 1, ((b2 & 0x0f) << 8) + c);
        } else {
          const a = glyphes.u16();
          const b = glyphes.u16();
          dx = avecSigne(f, a);
          dy = avecSigne(f >> 1, b);
        }
        x += dx;
        y += dy;
        pts.push({ x, y, surCourbe, dx, dy });
      }
      const nInstr = glyphes.u255();
      const instr = instructions.octets(nInstr);
      let boite;
      if (boiteExplicite) boite = boites.octets(8);
      else {
        boite = Buffer.alloc(8);
        const xs = pts.map((q) => q.x);
        const ys = pts.map((q) => q.y);
        boite.writeInt16BE(n ? Math.min(...xs) : 0, 0);
        boite.writeInt16BE(n ? Math.min(...ys) : 0, 2);
        boite.writeInt16BE(n ? Math.max(...xs) : 0, 4);
        boite.writeInt16BE(n ? Math.max(...ys) : 0, 6);
      }
      const chevauche = recouvrement && (recouvrement[g >> 3] >> (7 - (g & 7))) & 1;
      // Encodage simple : drapeau par point, coordonnées relatives sur 2 octets.
      const tete = Buffer.alloc(2 + 8 + 2 * nContours + 2);
      tete.writeInt16BE(nContours, 0);
      boite.copy(tete, 2);
      finsContours.forEach((fin, i) => tete.writeUInt16BE(fin, 10 + 2 * i));
      tete.writeUInt16BE(nInstr, 10 + 2 * nContours);
      const flags = Buffer.from(pts.map((q, i) => (q.surCourbe ? 1 : 0) | (i === 0 && chevauche ? 0x40 : 0)));
      const xs = Buffer.alloc(2 * n);
      const ys = Buffer.alloc(2 * n);
      pts.forEach((q, i) => {
        xs.writeInt16BE(q.dx, 2 * i);
        ys.writeInt16BE(q.dy, 2 * i);
      });
      sortie = Buffer.concat([tete, instr, flags, xs, ys]);
    }
    const bourrage = (4 - (sortie.length % 4)) % 4;
    if (sortie.length) {
      morceaux.push(sortie, Buffer.alloc(bourrage));
      total += sortie.length + bourrage;
    }
    offsets.push(total);
  }
  const loca = Buffer.alloc(4 * offsets.length);
  offsets.forEach((o, i) => loca.writeUInt32BE(o, 4 * i));
  return { glyf: Buffer.concat(morceaux), loca };
}

function sommeControle(buf) {
  const b = Buffer.concat([buf, Buffer.alloc((4 - (buf.length % 4)) % 4)]);
  let s = 0;
  for (let i = 0; i < b.length; i += 4) s = (s + b.readUInt32BE(i)) >>> 0;
  return s;
}

// Police WOFF2 (Buffer) → police sfnt (Buffer, TTF ou OTF selon la saveur).
export function woff2VersSfnt(woff) {
  const r = new Lecteur(woff);
  if (r.u32() !== 0x774f4632) throw new Error("pas une police WOFF2");
  const saveur = r.u32();
  r.u32();
  const nbTables = r.u16();
  r.u16();
  r.u32();
  const tailleCompressee = r.u32();
  r.pos = 48;
  const entrees = [];
  for (let i = 0; i < nbTables; i++) {
    const f = r.u8();
    const tag = (f & 63) === 63 ? r.octets(4).toString("latin1") : TAGS[f & 63];
    const version = (f >> 6) & 3;
    const longueur = r.base128();
    const transformee = tag === "glyf" || tag === "loca" ? version === 0 : version !== 0;
    const longueurTransformee = transformee ? r.base128() : longueur;
    entrees.push({ tag, longueur, transformee, longueurTransformee });
  }
  if (saveur === 0x74746366) throw new Error("collections WOFF2 non gérées");
  const flux = brotliDecompressSync(woff.subarray(r.pos, r.pos + tailleCompressee));
  let p = 0;
  const tables = {};
  for (const e of entrees) {
    tables[e.tag] = { ...e, donnees: flux.subarray(p, p + e.longueurTransformee) };
    p += e.longueurTransformee;
  }
  if (tables.hmtx?.transformee) throw new Error("table hmtx transformée non gérée");
  if (tables.glyf?.transformee) {
    const { glyf, loca } = reconstruireGlyf(tables.glyf.donnees);
    tables.glyf.donnees = glyf;
    tables.loca.donnees = loca;
    const head = Buffer.from(tables.head.donnees);
    head.writeInt16BE(1, 50); // indexToLocFormat : long
    tables.head.donnees = head;
  }
  if (tables.head) {
    const head = Buffer.from(tables.head.donnees);
    head.writeUInt32BE(0, 8);
    tables.head.donnees = head;
  }

  const tags = Object.keys(tables).sort();
  const n = tags.length;
  const puissance = 2 ** Math.floor(Math.log2(n));
  const entete = Buffer.alloc(12 + 16 * n);
  entete.writeUInt32BE(saveur, 0);
  entete.writeUInt16BE(n, 4);
  entete.writeUInt16BE(puissance * 16, 6);
  entete.writeUInt16BE(Math.log2(puissance), 8);
  entete.writeUInt16BE(n * 16 - puissance * 16, 10);
  const corps = [];
  let offset = entete.length;
  tags.forEach((tag, i) => {
    const d = tables[tag].donnees;
    entete.write(tag, 12 + 16 * i, 4, "latin1");
    entete.writeUInt32BE(sommeControle(d), 12 + 16 * i + 4);
    entete.writeUInt32BE(offset, 12 + 16 * i + 8);
    entete.writeUInt32BE(d.length, 12 + 16 * i + 12);
    const bourrage = (4 - (d.length % 4)) % 4;
    corps.push(d, Buffer.alloc(bourrage));
    offset += d.length + bourrage;
  });
  const police = Buffer.concat([entete, ...corps]);
  if (tables.head) {
    const iHead = tags.indexOf("head");
    const offHead = entete.readUInt32BE(12 + 16 * iHead + 8);
    police.writeUInt32BE((0xb1b0afba - sommeControle(police)) >>> 0, offHead + 8);
  }
  return police;
}

// Polices WOFF2 embarquées dans un gabarit HTML (@font-face en data URI).
export function policesDuGabarit(html) {
  const motif = /@font-face\{font-family:"([^"]+)";font-weight:(\d+);(?:font-style:(\w+);)?src:url\(data:font\/woff2;base64,([A-Za-z0-9+/=]+)\)/g;
  return [...html.matchAll(motif)].map(([, famille, graisse, style, base64]) => ({ famille, graisse: Number(graisse), italique: style === "italic", woff2: Buffer.from(base64, "base64") }));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [option, entree, sortie] = process.argv.slice(2);
  if (option === "--gabarit") {
    for (const p of policesDuGabarit(readFileSync(entree, "utf8"))) {
      const sfnt = woff2VersSfnt(p.woff2);
      const ext = sfnt.readUInt32BE(0) === 0x4f54544f ? "otf" : "ttf";
      const nom = `${p.famille.replace(/\s+/g, "")}-${p.graisse}${p.italique ? "i" : ""}.${ext}`;
      writeFileSync(join(sortie, nom), sfnt);
      console.log(nom, sfnt.length);
    }
  } else {
    // node scripts/woff2-vers-ttf.js <entrée.woff2> <sortie.ttf>
    writeFileSync(entree, woff2VersSfnt(readFileSync(option)));
  }
}
