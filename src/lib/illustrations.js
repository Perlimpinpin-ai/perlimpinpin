import { empreinte } from "./carte.js";
import { resolveTheme } from "./themes.js";
import { choisirEnRotation } from "./rotation-images.js";

// Bibliothèque des images de thème des carrousels Instagram (couverture).
//
// Principe : une bibliothèque validée une fois à la main, puis un choix
// automatique. Jamais d'image générée par IA, jamais de recherche d'image au
// moment de la génération d'un carrousel.
//
//  1. npm run banque-images:themes (ou node scripts/chercher-illustrations.js <thème>)
//       → interroge l'API Wikimedia Commons avec les REQUETES_COMMONS du
//         thème et garde 8 propositions sous licence libre, ≥ 1600 px, dans
//         data/illustrations/candidates/<thème>.json (--pexels : API Pexels ;
//         --simulation : propositions factices, sans appel) ;
//  2. /test/illustrations (serveur local) : on coche 3 ou 4 images, on corrige
//     leur mot-clé, puis « Garder » → public/illustrations/<thème>/<mot-clé>.jpg
//     (+ version traitée) et la liste ILLUSTRATIONS ci-dessous est réécrite
//     (entre les deux repères) ; même effet en ligne de commande :
//     node scripts/chercher-illustrations.js <thème> --telecharger.
// Rien n'entre dans la bibliothèque sans cette validation. Le dossier
// « general » sert de secours aux thèmes sans image. Choix sur la couverture :
// hors des images des 2 derniers carrousels du thème (src/lib/banque-images.js).
//
// Fonctions PURES (choix, crédit), testées par scripts/recit.test.js et
// scripts/banque-images.test.js.
// Le traitement graphique (bichromie et trame) est dans
// src/lib/traitement-illustration.js.

// Règles de sélection, rappelées sur /test/illustrations et dans le script.
export const REGLES_SELECTION = [
  "Pas de visage reconnaissable au premier plan : silhouettes, mains, personnes de dos, objets, lieux.",
  "Aucune personnalité politique.",
  "Aucun logo de marque ou de parti, aucun symbole partisan.",
  "Pas d'image choquante ni misérabiliste.",
  "Une photo qui pourrait passer pour celle d'un événement réel précis est écartée : on cherche des images génériques.",
];

// Thèmes de la bibliothèque : les 12 thèmes des fiches (src/lib/themes.js),
// plus « fiscalite », rangé à part pour des images d'impôts, mais puisé aussi
// pour les fiches du thème « economie » (le site range la fiscalité dans ce
// thème). Requêtes Pexels en anglais (meilleurs résultats), avec le mot-clé
// proposé pour les images trouvées par chaque requête.
export const THEMES_ILLUSTRATIONS = {
  logement: {
    libelle: "Logement",
    requetes: [
      ["apartment building facade", "immeuble"],
      ["house keys hand", "cles"],
      ["construction site crane", "chantier"],
      ["for rent sign window", "location"],
      ["roof renovation workers back", "renovation"],
    ],
  },
  economie: {
    libelle: "Économie et pouvoir d'achat",
    requetes: [
      ["supermarket checkout", "caisse"],
      ["euro banknotes", "billets"],
      ["shopping cart groceries", "courses"],
      ["euro coins wallet", "porte-monnaie"],
      ["receipt calculator", "ticket"],
    ],
  },
  fiscalite: {
    libelle: "Fiscalité",
    requetes: [
      ["tax form paperwork", "formulaire"],
      ["calculator documents desk", "calculatrice"],
      ["euro coins stack", "pieces"],
      ["inheritance documents signing hands", "succession"],
      ["piggy bank coins", "epargne"],
    ],
  },
  "ia-numerique": {
    libelle: "IA et numérique",
    requetes: [
      ["server room data center", "serveurs"],
      ["laptop code screen", "code"],
      ["circuit board macro", "circuit"],
      ["smartphone hands", "smartphone"],
      ["fiber optic cables", "fibre"],
    ],
  },
  education: {
    libelle: "Éducation",
    requetes: [
      ["empty classroom desks", "classe"],
      ["school notebooks pencils", "cahiers"],
      ["chalkboard", "tableau"],
      ["school backpack back", "cartable"],
      ["library books shelves", "bibliotheque"],
    ],
  },
  "securite-justice": {
    libelle: "Sécurité et justice",
    requetes: [
      ["courthouse columns", "tribunal"],
      ["gavel", "marteau"],
      ["police car lights night", "gyrophare"],
      ["prison corridor", "prison"],
      ["scales of justice statue", "balance"],
    ],
  },
  sante: {
    libelle: "Santé",
    requetes: [
      ["hospital corridor", "hopital"],
      ["stethoscope", "stethoscope"],
      ["pills medicine", "medicaments"],
      ["hospital bed empty", "lit"],
      ["doctor hands", "soignant"],
    ],
  },
  retraites: {
    libelle: "Retraites",
    requetes: [
      ["elderly couple walking back", "promenade"],
      ["pension coins", "pieces"],
      ["retirement savings jar", "epargne"],
      ["senior hands", "mains"],
      ["park bench autumn", "banc"],
    ],
  },
  emploi: {
    libelle: "Emploi",
    requetes: [
      ["office desks empty", "bureau"],
      ["factory workers back", "usine"],
      ["job interview hands", "entretien"],
      ["construction helmet", "casque"],
      ["resume paper", "cv"],
    ],
  },
  "energie-climat": {
    libelle: "Énergie et climat",
    requetes: [
      ["wind turbines", "eoliennes"],
      ["solar panels", "solaire"],
      ["nuclear power plant cooling tower", "nucleaire"],
      ["power lines pylon", "pylone"],
      ["electric meter", "compteur"],
    ],
  },
  "alimentation-agriculture": {
    libelle: "Agriculture",
    requetes: [
      ["wheat field", "ble"],
      ["tractor field", "tracteur"],
      ["cows pasture", "vaches"],
      ["market vegetables stall", "marche"],
      ["farmer hands soil", "terre"],
    ],
  },
  immigration: {
    libelle: "Immigration",
    requetes: [
      ["passport stamps", "passeport"],
      ["airport departures board", "aeroport"],
      ["border fence landscape", "frontiere"],
      ["suitcase travel", "valise"],
      ["administrative documents stamp", "tampon"],
    ],
  },
  tabac: {
    libelle: "Tabac (sujet)",
    sujet: true,
    requetes: [
      ["plain cigarette packaging", "paquet"],
      ["ashtray close up", "cendrier"],
      ["tobacco shop sign", "buraliste"],
    ],
  },
  general: {
    libelle: "Général (secours)",
    requetes: [
      ["magnifying glass documents", "loupe"],
      ["newspaper reading table", "journal"],
    ],
  },
  "democratie-et-institutions": {
    libelle: "Institutions",
    requetes: [
      ["ballot box", "urne"],
      ["parliament hemicycle empty", "hemicycle"],
      ["voting booth", "isoloir"],
      ["french flag building", "drapeau"],
      ["constitution book", "constitution"],
    ],
  },
};

// Thème de secours : ses images servent quand le thème de la fiche n'en a
// aucune (ou que la fiche n'a pas de thème reconnu).
export const THEME_SECOURS = "general";

// Requêtes Wikimedia Commons (source par défaut de
// scripts/chercher-illustrations.js) : 2 ou 3 par thème, en français et en
// anglais, avec le mot-clé proposé pour les images trouvées. Des lieux et des
// objets plutôt que des personnes.
export const REQUETES_COMMONS = {
  logement: [
    ["immeuble façade logements", "immeuble"],
    ["apartment building facade", "immeuble"],
    ["construction site crane housing", "chantier"],
  ],
  economie: [
    ["caisse supermarché", "caisse"],
    ["euro banknotes", "billets"],
    ["shopping cart supermarket", "courses"],
  ],
  fiscalite: [
    ["centre des finances publiques", "impots"],
    ["tax return form", "declaration"],
    ["calculator receipts", "calcul"],
  ],
  "ia-numerique": [
    ["salle serveurs informatique", "serveurs"],
    ["data center servers", "serveurs"],
    ["computer keyboard close-up", "clavier"],
  ],
  education: [
    ["salle de classe vide", "classe"],
    ["empty classroom desks", "classe"],
    ["school blackboard chalk", "tableau"],
  ],
  "securite-justice": [
    ["palais de justice France", "tribunal"],
    ["courtroom empty", "tribunal"],
    ["police car France", "police"],
  ],
  sante: [
    ["hôpital couloir", "hopital"],
    ["hospital corridor", "hopital"],
    ["stethoscope", "stethoscope"],
  ],
  retraites: [
    ["banc parc personnes âgées", "banc"],
    ["park bench autumn", "banc"],
    ["retirement elderly hands", "mains"],
  ],
  emploi: [
    ["agence France Travail", "agence"],
    ["factory workers assembly line", "usine"],
    ["office desks open space", "bureau"],
  ],
  "energie-climat": [
    ["éoliennes champ", "eoliennes"],
    ["wind turbines field", "eoliennes"],
    ["solar panels roof", "solaire"],
  ],
  "alimentation-agriculture": [
    ["tracteur champ blé", "champ"],
    ["wheat field harvest", "moisson"],
    ["vegetable market stall France", "marche"],
  ],
  immigration: [
    ["passeport tampon", "passeport"],
    ["airport departures board", "aeroport"],
    ["border crossing checkpoint", "frontiere"],
  ],
  "democratie-et-institutions": [
    ["urne électorale", "urne"],
    ["hémicycle Assemblée nationale", "hemicycle"],
    ["voting booth", "isoloir"],
  ],
  tabac: [
    ["paquet de cigarettes neutre", "paquet"],
    ["plain cigarette packaging", "paquet"],
    ["cendrier", "cendrier"],
    ["ashtray cigarette butts", "cendrier"],
    ["carotte bureau de tabac", "buraliste"],
    ["bureau de tabac façade", "buraliste"],
  ],
  general: [
    ["journaux kiosque", "journal"],
    ["newspapers stack", "journal"],
    ["magnifying glass documents", "loupe"],
  ],
};

// Thèmes de la bibliothèque où puiser pour un thème de fiche (slug ou libellé).
export function themesBibliotheque(themeFiche) {
  const slug = resolveTheme(themeFiche) ?? (THEMES_ILLUSTRATIONS[themeFiche] ? themeFiche : null);
  if (!slug) return [];
  return slug === "economie" ? ["economie", "fiscalite"] : [slug];
}

// Mot-clé normalisé : minuscules, sans accents, tirets.
export function motCleNormalise(mot) {
  return String(mot ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Licences qui demandent un crédit visible (couverture et slide de fin) :
// CC BY et CC BY-SA, toutes versions. CC0, domaine public et licence Pexels
// n'en demandent pas (le crédit reste ici et dans la légende).
export function creditObligatoire(licence) {
  return /^CC BY(-SA)?\b/i.test(String(licence ?? "").trim());
}

// --- Liste de la bibliothèque --------------------------------------------------------
// Écrite par scripts/chercher-illustrations.js --telecharger : ne pas modifier à la
// main entre les deux repères (sauf pour retirer une image).
// Chaque entrée : { fichier (relatif à public/), theme, motsCles, source, auteur, licence, lien }.
// DEBUT LISTE ILLUSTRATIONS
export const ILLUSTRATIONS = [
  {"fichier":"illustrations/sante/hopital.jpg","theme":"sante","motsCles":["hopital"],"source":"Wikimedia Commons","auteur":"Olybrius","licence":"CC BY-SA 3.0","lien":"https://commons.wikimedia.org/wiki/File:Toulouse_-_H%C3%B4pital_Saint-Joseph_de_la_Grave_-_20100914_-_(1).jpg","description":"Un couloir de l' hôpital Saint-Joseph de la Grave à Toulouse ."},
  {"fichier":"illustrations/sante/hopital-2.jpg","theme":"sante","motsCles":["hopital"],"source":"Wikimedia Commons","auteur":"Terry Robinson","licence":"CC BY-SA 2.0","lien":"https://commons.wikimedia.org/wiki/File:Vickers_Corridor,_Northern_General_Hospital,_Sheffield_-_geograph.org.uk_-_1724026.jpg","description":"Vickers Corridor, Northern General Hospital, Sheffield. The Vickers Corridor - named after Edward Vickers - has, since the building of the Hospital, been an important central corridor giving access to"},
  {"fichier":"illustrations/sante/stethoscope.jpg","theme":"sante","motsCles":["stethoscope"],"source":"Wikimedia Commons","auteur":"Stethoscopes","licence":"CC BY-SA 3.0","lien":"https://commons.wikimedia.org/wiki/File:Doctors_stethoscope_1.jpg","description":"GUIDE: Littmann Stethoscopes Review —What’s your perfect one?Is there any doctor who cannot recognize the Littmann brand? On the one hand, you may already know that they get their name because of the "},
  {"fichier":"illustrations/sante/hopital-3.jpg","theme":"sante","motsCles":["hopital"],"source":"Wikimedia Commons","auteur":"Arthur Causse","licence":"CC BY-SA 3.0","lien":"https://commons.wikimedia.org/wiki/File:Anamorphose_peinte_dans_le_couloir_des_chambres_de_l%27h%C3%B4pital_Salvator_%C3%A0_Marseille.JPG","description":"anamorphose peinte dans le couloir des chambres de l'hôpital Salvator à Marseille. La couleur retenue est le violet. c'est la couleur de la méditation et de l’introspection. Le violet calme l’esprit e"},
  {"fichier":"illustrations/sante/hopital-4.jpg","theme":"sante","motsCles":["hopital"],"source":"Wikimedia Commons","auteur":"Rehtse","licence":"CC BY-SA 4.0","lien":"https://commons.wikimedia.org/wiki/File:H%C3%B4pital_Saint-Jacques_de_Nantes_-_couloir.jpg","description":"Couloir du pavillon d'entrée de l'hôpital Saint-Jacques de Nantes (France)"},
  {"fichier":"illustrations/sante/hopital-5.jpg","theme":"sante","motsCles":["hopital"],"source":"Wikimedia Commons","auteur":"Pub. by The Lovell General Hospital, Post Exchange, Fort Devens, Mass. Tichnor Bros. Inc., Boston, Mass.","licence":"Domaine public","lien":"https://commons.wikimedia.org/wiki/File:Main_Corridor,_Lovell_General_Hospital,_Fort_Devens,_Mass_(71546).jpg","description":"Title: Main Corridor, Lovell General Hospital, Fort Devens, Mass. Subjects: Interiors; Passageways; Military hospitals Places: Massachusetts &gt; Worcester (county) &gt; Fort Devens Notes: Title from "},
  {"fichier":"illustrations/sante/stethoscope-2.jpg","theme":"sante","motsCles":["stethoscope"],"source":"Wikimedia Commons","auteur":"Stethoscopes","licence":"CC BY-SA 3.0","lien":"https://commons.wikimedia.org/wiki/File:Doctors_stethoscope_2.jpg","description":"A specialist cardiology stethoscope."},
  {"fichier":"illustrations/sante/hopital-6.jpg","theme":"sante","motsCles":["hopital"],"source":"Wikimedia Commons","auteur":"Globetrotter19","licence":"CC BY-SA 3.0","lien":"https://commons.wikimedia.org/wiki/File:Hospital_of_the_Sisters_of_Charity._Corridor._-_V%C3%A1c.JPG","description":"This chapel was a part of a fomer monastery and the other part was a hospital, now retire home. The historic building of the Hospital and the Chapel of the Sisters of Charity was created through uniti"},
  {"fichier":"illustrations/logement/immeuble.jpg","theme":"logement","motsCles":["immeuble"],"source":"Wikimedia Commons","auteur":"Saintonge","licence":"CC BY-SA 3.0","lien":"https://commons.wikimedia.org/wiki/File:R%C3%A9sidence_Basilique,immeuble_%C3%A0_appartements_sis_avenue_Charles_Quint_122-124_%C3%A0_1083_Ganshoren;_architecte_Jean_DELHAYE_(un_des_derniers_collaborateurs_de_Victor_HORTA).JPG","description":"This is a photo of a monument in Brussels, number:"},
  {"fichier":"illustrations/logement/immeuble-2.jpg","theme":"logement","motsCles":["immeuble"],"source":"Wikimedia Commons","auteur":"Andriy Makukha","licence":"CC BY-SA 3.0","lien":"https://commons.wikimedia.org/wiki/File:Apartment_building_in_Kiev_02.jpg","description":"An apartment building near Palace of Ukraine, Kiev. (It is seen from behind the palace on Image:Palace_of_Ukraine.jpg )"},
  {"fichier":"illustrations/logement/chantier.jpg","theme":"logement","motsCles":["chantier"],"source":"Wikimedia Commons","auteur":"Lionel Allorge","licence":"CC BY-SA 3.0","lien":"https://commons.wikimedia.org/wiki/File:Chantier_des_logements_sociaux_Les_Delach%C3%A9s_%C3%A0_Gometz-le-Ch%C3%A2tel_-_01.jpg","description":"Site for social housing Les Delachés in Gometz-le-Châtel , France ."},
  {"fichier":"illustrations/logement/immeuble-3.jpg","theme":"logement","motsCles":["immeuble"],"source":"Wikimedia Commons","auteur":"Claude villetaneuse","licence":"CC BY-SA 4.0","lien":"https://commons.wikimedia.org/wiki/File:P1050686_T8_Avant_gare_de_Villetaneuse.JPG","description":"Rue de l'Université à Villetaneuse : A gauche, la façade du gymnase universitaire Jesse Richardson, puis le trottoir / circulations douces, la plateforme de la ligne T8 au niveau des aiguillages de jo"},
  {"fichier":"illustrations/economie/caisse.jpg","theme":"economie","motsCles":["caisse"],"source":"Wikimedia Commons","auteur":"Wolfmann","licence":"CC BY-SA 4.0","lien":"https://commons.wikimedia.org/wiki/File:REMA_1000_Supermarket_interior_grocery_store_T%C3%B8nsberg,_Norway_2017-11-03_cashier_checkout_e.jpg","description":"Interior of REMA 1000 supermarket/grocery store in Tønsberg, Norway. Products displayed for sale at cashier/checkout: chewig gum, chocolate, dates, cold drinks, etc."},
  {"fichier":"illustrations/economie/billets.jpg","theme":"economie","motsCles":["billets"],"source":"Wikimedia Commons","auteur":"Avij","licence":"Domaine public","lien":"https://commons.wikimedia.org/wiki/File:Euro_coins_and_banknotes.jpg","description":"A picture of some Euro banknotes and various Euro coins ."},
  {"fichier":"illustrations/economie/courses.jpg","theme":"economie","motsCles":["courses"],"source":"Wikimedia Commons","auteur":"Stilfehler","licence":"CC BY-SA 3.0","lien":"https://commons.wikimedia.org/wiki/File:Shopping_Cart_Return.jpg","description":"Shopping cart return on the parking lot of a Wegman's store in NY"},
  {"fichier":"illustrations/economie/caisse-2.jpg","theme":"economie","motsCles":["caisse"],"source":"Wikimedia Commons","auteur":"Wolfmann","licence":"CC BY-SA 4.0","lien":"https://commons.wikimedia.org/wiki/File:REMA_1000_Supermarket_interior_grocery_store_T%C3%B8nsberg,_Norway_2017-11-03_cashier_checkout_Red_Bull_Simply_Cola_d.jpg","description":"Interior of REMA 1000 supermarket/grocery store in Tønsberg, Norway. Red Bull Simply Cola displayed for sale at cashier/checkout."},
  {"fichier":"illustrations/fiscalite/impots.jpg","theme":"fiscalite","motsCles":["impots"],"source":"Wikimedia Commons","auteur":"Benjamin Smith","licence":"CC BY-SA 3.0","lien":"https://commons.wikimedia.org/wiki/File:Nogent-le-Rotrou_-_Centre_des_Finances_Publiques_-_1.jpg","description":"The tax office of Nogent-le-Rotrou , Eure-et-Loir , France ."},
  {"fichier":"illustrations/fiscalite/impots-2.jpg","theme":"fiscalite","motsCles":["impots"],"source":"Wikimedia Commons","auteur":"Benjamin Smith","licence":"CC BY-SA 3.0","lien":"https://commons.wikimedia.org/wiki/File:Nogent-le-Rotrou_-_Centre_des_Finances_Publiques_-_2.jpg","description":"The tax office of Nogent-le-Rotrou , Eure-et-Loir , France ."},
  {"fichier":"illustrations/fiscalite/impots-3.jpg","theme":"fiscalite","motsCles":["impots"],"source":"Wikimedia Commons","auteur":"P.poschadel","licence":"CC BY-SA 2.0","lien":"https://commons.wikimedia.org/wiki/File:Pont-Sainte-Maxence_(60),_centre_des_Finances_Publiques_et_anciennePoste,_rue_Charles-Lescot.jpg","description":"Le centre des Finances Publiques, dans la vieille ville, rue Charles-Lescot. Il s'agit de l'ancienne poste construite en 1928 et transféré dans de nouveaux locaux plus grands en 1992."},
  {"fichier":"illustrations/fiscalite/impots-4.jpg","theme":"fiscalite","motsCles":["impots"],"source":"Wikimedia Commons","auteur":"Marianne Casamance","licence":"CC BY-SA 4.0","lien":"https://commons.wikimedia.org/wiki/File:Plaisance_(Gers)_Centre_des_finances_publiques.JPG","description":"Centre des finances publiques"},
  {"fichier":"illustrations/ia-numerique/serveurs.jpg","theme":"ia-numerique","motsCles":["serveurs"],"source":"Wikimedia Commons","auteur":"Florian Hirzinger - www.fh-ap.com","licence":"CC BY-SA 3.0","lien":"https://commons.wikimedia.org/wiki/File:CERN_Server_02.jpg","description":"Server room in CERN (France / Switzerland)"},
  {"fichier":"illustrations/ia-numerique/serveurs-2.jpg","theme":"ia-numerique","motsCles":["serveurs"],"source":"Wikimedia Commons","auteur":"Victorgrigas","licence":"CC BY-SA 3.0","lien":"https://commons.wikimedia.org/wiki/File:Wikimedia_Foundation_Servers-8055_02.jpg","description":"Wikimedia Foundation Servers"},
  {"fichier":"illustrations/ia-numerique/clavier.jpg","theme":"ia-numerique","motsCles":["clavier"],"source":"Wikimedia Commons","auteur":"Henrique Pinto","licence":"CC BY 2.0","lien":"https://commons.wikimedia.org/wiki/File:Microdigital_TK85_Keyboard_close_up.jpg","description":"Microdigital TK 85, a Brazilian Sinclair ZX81 clone with a ZX Spectrum-like case (chiclet keyboard detail)."},
  {"fichier":"illustrations/ia-numerique/serveurs-3.jpg","theme":"ia-numerique","motsCles":["serveurs"],"source":"Wikimedia Commons","auteur":"Florian Hirzinger - www.fh-ap.com","licence":"CC BY-SA 3.0","lien":"https://commons.wikimedia.org/wiki/File:CERN_Server_03.jpg","description":"Server room in CERN (Switzerland)"},
  {"fichier":"illustrations/education/classe.jpg","theme":"education","motsCles":["classe"],"source":"Wikimedia Commons","auteur":"Maryane13","licence":"CC BY-SA 4.0","lien":"https://commons.wikimedia.org/wiki/File:L%27ARSENAL.JPG","description":"construit en 1580 sur l'ancienne \"maison des rois de Navarre\" bâtiment de trois corps en U de 819.94 mètres carrés On pouvait entreposer dans la cour 30 000 boulets ou grenades et sous les élégantes a"},
  {"fichier":"illustrations/education/classe-2.jpg","theme":"education","motsCles":["classe"],"source":"Wikimedia Commons","auteur":"Albert Brichaut","licence":"CC0","lien":"https://commons.wikimedia.org/wiki/File:Ecole_des_filles_mineures,_prison_de_Saint-Lazare,_107_rue_du_Faubourg_Saint-Denis,_10%C3%A8me_arrondissement,_Paris,_PH15195(1).jpg","description":"Auteur(s): Brichaut, Albert (vers 1901), photographe Autre titre: Prisons de St Lazare. L'Ecole des filles mineures. (Titre inscrit (lettre)) Date de production: Entre 1898 et 1912 Type(s) d'objet(s):"},
  {"fichier":"illustrations/education/classe-3.jpg","theme":"education","motsCles":["classe"],"source":"Wikimedia Commons","auteur":"Anthony J. Bentley","licence":"Domaine public","lien":"https://commons.wikimedia.org/wiki/File:Blackboards_%E2%80%93_UNM_Astrophysics.JPG","description":"A classroom in the University of New Mexico’s Department of Physics and Astronomy."},
  {"fichier":"illustrations/education/classe-4.jpg","theme":"education","motsCles":["classe"],"source":"Wikimedia Commons","auteur":"Abaddon1337","licence":"CC BY-SA 4.0","lien":"https://commons.wikimedia.org/wiki/File:Orbe_-_Chantemerle_-_salle_de_classe_2.jpg","description":"Classroom of 6-7 years old students, Chantemerle school, Orbe. Teacher's desk."},
  {"fichier":"illustrations/securite-justice/tribunal.jpg","theme":"securite-justice","motsCles":["tribunal"],"source":"Wikimedia Commons","auteur":"Bjengles3","licence":"CC BY-SA 4.0","lien":"https://commons.wikimedia.org/wiki/File:Rochester_City_Court_part_1_courtroom.jpg","description":"This is the Part 1 courtroom, in the County Public Safety Building. This courtroom is adjacent to the jail, and is generally used for arraignments."},
  {"fichier":"illustrations/securite-justice/police.jpg","theme":"securite-justice","motsCles":["police"],"source":"Wikimedia Commons","auteur":"mpd01605 from Paris, France","licence":"CC BY-SA 2.0","lien":"https://commons.wikimedia.org/wiki/File:Police_Car_at_Night.jpg","description":"Citroën Xsara police car in France at night, with \"POLICE\" in mirror writing (\"ECILOP\")."},
  {"fichier":"illustrations/securite-justice/tribunal-2.jpg","theme":"securite-justice","motsCles":["tribunal"],"source":"Wikimedia Commons","auteur":"Eusebius Retouched by Maedin","licence":"CC BY 3.0","lien":"https://commons.wikimedia.org/wiki/File:Tours_-_palais_de_justice-edit_1.jpg","description":"The courthouse of Tours ."},
  {"fichier":"illustrations/securite-justice/police-2.jpg","theme":"securite-justice","motsCles":["police"],"source":"Wikimedia Commons","auteur":"Jebulon","licence":"CC0","lien":"https://commons.wikimedia.org/wiki/File:Car_Police_Renault.jpg","description":"A Renault Trafic van of the French National Police. No geocode for security reasons."},
  {"fichier":"illustrations/retraites/banc.jpg","theme":"retraites","motsCles":["banc"],"source":"Wikimedia Commons","auteur":"Onderwijsgek","licence":"CC BY-SA 2.5","lien":"https://commons.wikimedia.org/wiki/File:Bench_autumn.JPG","description":"Bankje in de herfst bij de begraafplaats in Oudewater."},
  {"fichier":"illustrations/retraites/banc-2.jpg","theme":"retraites","motsCles":["banc"],"source":"Wikimedia Commons","auteur":"Onderwijsgek","licence":"CC BY-SA 2.5","lien":"https://commons.wikimedia.org/wiki/File:Bench_autumn_02.JPG","description":"Bankje in de herfst bij de begraafplaats in Oudewater."},
  {"fichier":"illustrations/retraites/banc-3.jpg","theme":"retraites","motsCles":["banc"],"source":"Wikimedia Commons","auteur":"Onderwijsgek","licence":"CC BY-SA 2.5","lien":"https://commons.wikimedia.org/wiki/File:Bench_autumn_03.JPG","description":"Bankje in de herfst bij de begraafplaats in Oudewater."},
  {"fichier":"illustrations/retraites/banc-4.jpg","theme":"retraites","motsCles":["banc"],"source":"Wikimedia Commons","auteur":"Zorro2212","licence":"CC BY-SA 3.0","lien":"https://commons.wikimedia.org/wiki/File:Park_Sienkiewicza_in_Autumn_2.jpg","description":"Park Sienkiewicza in Autumn"},
  {"fichier":"illustrations/emploi/bureau.jpg","theme":"emploi","motsCles":["bureau"],"source":"Wikimedia Commons","auteur":"Navy Medicine from Washington, DC, USA","licence":"CC BY 2.0","lien":"https://commons.wikimedia.org/wiki/File:12-0186-017_and_018_(8024320813).jpg","description":"CBC Renovates Dental Facility. In 1942, when WWII was barely six months old, a medical dental dispensary was built to support personnel at the Port Hueneme Naval Construction Battalion Center. Today, "},
  {"fichier":"illustrations/emploi/usine.jpg","theme":"emploi","motsCles":["usine"],"source":"Wikimedia Commons","auteur":"ENERGY.GOV","licence":"Domaine public","lien":"https://commons.wikimedia.org/wiki/File:AEMC_Summit_(11343379864).jpg","description":"Pictured here is a tablet that could be used in conjunction with Google Glass to increase worker safety on the manufacturing line. Instead of having to check off a piece of paper or swipe on a tablet,"},
  {"fichier":"illustrations/emploi/bureau-2.jpg","theme":"emploi","motsCles":["bureau"],"source":"Wikimedia Commons","auteur":"Navy Medicine from Washington, DC, USA","licence":"CC BY 2.0","lien":"https://commons.wikimedia.org/wiki/File:12-0186-017_and_018_(8024320517).jpg","description":"CBC Renovates Dental Facility. In 1942, when WWII was barely six months old, a medical dental dispensary was built to support personnel at the Port Hueneme Naval Construction Battalion Center. Today, "},
  {"fichier":"illustrations/energie-climat/eoliennes.jpg","theme":"energie-climat","motsCles":["eoliennes"],"source":"Wikimedia Commons","auteur":"Kim Hansen, retouches Richard Bartz et Kim Hansen","licence":"CC BY-SA 3.0","lien":"https://commons.wikimedia.org/wiki/File:Middelgrunden_wind_farm_2009-07-01_edit_filtered.jpg","description":"Middelgrunden offshore wind farm (40 MW) observed in Øresund"},
  {"fichier":"illustrations/energie-climat/eoliennes-2.jpg","theme":"energie-climat","motsCles":["eoliennes"],"source":"Wikimedia Commons","auteur":"Steve Barnes","licence":"CC BY-SA 2.0","lien":"https://commons.wikimedia.org/wiki/File:Tythegston_Wind_Turbines_(geograph_6183484).jpg","description":"Tythegston Wind Turbines Not far from the Household Waste Recycling Centre can be found these wind turbines. These are the two turbines of Newton Down Wind Farm."},
  {"fichier":"illustrations/energie-climat/solaire.jpg","theme":"energie-climat","motsCles":["solaire"],"source":"Wikimedia Commons","auteur":"Pujanak","licence":"Domaine public","lien":"https://commons.wikimedia.org/wiki/File:Solar_panels_on_a_roof.jpg","description":"Solar panels on a roof"},
  {"fichier":"illustrations/energie-climat/eoliennes-3.jpg","theme":"energie-climat","motsCles":["eoliennes"],"source":"Wikimedia Commons","auteur":"Jmh2o","licence":"CC BY-SA 3.0","lien":"https://commons.wikimedia.org/wiki/File:%C3%89oliennes_-_Belgique_-_Buset_-_01.JPG","description":"Champ éolien de Buzet - Belgique"},
  {"fichier":"illustrations/alimentation-agriculture/champ.jpg","theme":"alimentation-agriculture","motsCles":["champ"],"source":"Wikimedia Commons","auteur":"Moktarama","licence":"CC BY-SA 3.0","lien":"https://commons.wikimedia.org/wiki/File:Botteleuse_-_Emballoteuse.jpg","description":"Agricultural machinery - Wheat field (Mayenne - France)"},
  {"fichier":"illustrations/alimentation-agriculture/moisson.jpg","theme":"alimentation-agriculture","motsCles":["moisson"],"source":"Wikimedia Commons","auteur":"Adrian Cable","licence":"CC BY-SA 2.0","lien":"https://commons.wikimedia.org/wiki/File:Wheat_field_after_the_harvest_-_geograph.org.uk_-_233376.jpg","description":"Wheat field after the harvest."},
  {"fichier":"illustrations/alimentation-agriculture/marche.jpg","theme":"alimentation-agriculture","motsCles":["marche"],"source":"Wikimedia Commons","auteur":"BorisAhonon","licence":"CC BY-SA 4.0","lien":"https://commons.wikimedia.org/wiki/File:Etale_de_piments_%C3%A0_Yamoussoukro.jpg","description":"This is an image with the theme \" Farm to Plate \" from:"},
  {"fichier":"illustrations/alimentation-agriculture/moisson-2.jpg","theme":"alimentation-agriculture","motsCles":["moisson"],"source":"Wikimedia Commons","auteur":"U.S. Department of Agriculture","licence":"Domaine public","lien":"https://commons.wikimedia.org/wiki/File:Wheat_harvest_on_field.jpg","description":"Image title: Wheat harvest on field Image from Public domain images website, http://www.public-domain-image.com/full-image/nature-landscapes-public-domain-images-pictures/field-public-domain-images-pi"},
  {"fichier":"illustrations/immigration/passeport.jpg","theme":"immigration","motsCles":["passeport"],"source":"Wikimedia Commons","auteur":"Jsx","licence":"CC0","lien":"https://commons.wikimedia.org/wiki/File:TJ-Dushanbe-IN.jpg","description":"Dushanbe airport entry stamp"},
  {"fichier":"illustrations/immigration/aeroport.jpg","theme":"immigration","motsCles":["aeroport"],"source":"Wikimedia Commons","auteur":"Dragfyre","licence":"CC BY-SA 3.0","lien":"https://commons.wikimedia.org/wiki/File:Departures_board_Danang_Airport.JPG","description":"An electronic flight departures board at Danang Int'l Airport."},
  {"fichier":"illustrations/immigration/frontiere.jpg","theme":"immigration","motsCles":["frontiere"],"source":"Wikimedia Commons","auteur":"Brunswyk","licence":"CC BY-SA 3.0","lien":"https://commons.wikimedia.org/wiki/File:Helmstedt-Marienborn_ehemaliger_Grenzuebergang_Luftbild_(2007).JPG","description":"Aerial photograph of Helmstedt-Marienborn border crossing , Germany as seen from the north."},
  {"fichier":"illustrations/immigration/passeport-2.jpg","theme":"immigration","motsCles":["passeport"],"source":"Wikimedia Commons","auteur":"Slleong","licence":"CC0","lien":"https://commons.wikimedia.org/wiki/File:Sadao_Thailand_old_style_passport_stamp_exit_2.jpg","description":"Old Style Thailand passport exit stamp from Sadao Checkpoint"},
  {"fichier":"illustrations/democratie-et-institutions/urne.jpg","theme":"democratie-et-institutions","motsCles":["urne"],"source":"Wikimedia Commons","auteur":"Jiří Sedláček - Frettie","licence":"CC BY-SA 3.0","lien":"https://commons.wikimedia.org/wiki/File:Ballot_box_of_czech_legislative_election_2010_in_T%C5%99eb%C3%AD%C4%8D,_T%C5%99eb%C3%AD%C4%8D_District.jpg","description":"Ballot box of czech legislative election 2010."},
  {"fichier":"illustrations/democratie-et-institutions/hemicycle.jpg","theme":"democratie-et-institutions","motsCles":["hemicycle"],"source":"Wikimedia Commons","auteur":"Coucouoeuf","licence":"CC BY-SA 3.0","lien":"https://commons.wikimedia.org/wiki/File:Hemicycle_assemblee_nationale.JPG","description":"This building is indexed in the base Mérimée , a database of architectural heritage maintained by the French Ministry of Culture , under the reference PA00088698 . brezhoneg ∙ català ∙ Deutsch ∙ Engli"},
  {"fichier":"illustrations/democratie-et-institutions/isoloir.jpg","theme":"democratie-et-institutions","motsCles":["isoloir"],"source":"Wikimedia Commons","auteur":"secretlondon123","licence":"CC BY-SA 2.0","lien":"https://commons.wikimedia.org/wiki/File:Polling_station_6_may_2010.jpg","description":"Polling station sign, London. UK general election (and local council elections), 6 May 2010."},
  {"fichier":"illustrations/democratie-et-institutions/urne-2.jpg","theme":"democratie-et-institutions","motsCles":["urne"],"source":"Wikimedia Commons","auteur":"Jebulon","licence":"CC0","lien":"https://commons.wikimedia.org/wiki/File:Urne_Ballot_box_r%C3%A9publique.jpg","description":"\"Universal suffrage\", bronze ballot boxe on the pedestal of the Monument to the Republic, Place de la République, Paris."},
  {"fichier":"illustrations/general/journal.jpg","theme":"general","motsCles":["journal"],"source":"Wikimedia Commons","auteur":"Lhsunshine","licence":"CC BY-SA 3.0","lien":"https://commons.wikimedia.org/wiki/File:Microfilm_of_Toowoomba_Chronicle.JPG","description":"Microfilm of Toowoomba Chronicle"},
  {"fichier":"illustrations/general/loupe.jpg","theme":"general","motsCles":["loupe"],"source":"Wikimedia Commons","auteur":"Penarc","licence":"CC BY 3.0","lien":"https://commons.wikimedia.org/wiki/File:Chilean_stamp_album_and_catalogue,_and_a_magnifying_glass.jpg","description":"Chilean stamp album and catalogue, and a magnifying glass"},
  {"fichier":"illustrations/general/journal-2.jpg","theme":"general","motsCles":["journal"],"source":"Wikimedia Commons","auteur":"Andi oisn","licence":"CC BY-SA 3.0","lien":"https://commons.wikimedia.org/wiki/File:Graz_Am_Eisernen_Tor_Tabakkiosk.jpg","description":"Tabakkiosk am Eisernen Tor, Graz"},
];
// FIN LISTE ILLUSTRATIONS

// Images disponibles pour un thème de fiche.
export function illustrationsDuTheme(themeFiche, liste = ILLUSTRATIONS) {
  const themes = themesBibliotheque(themeFiche);
  return liste.filter((ill) => themes.includes(ill.theme));
}

// Images où puiser pour une fiche : celles de son thème, sinon celles du
// thème de secours.
export function illustrationsPourFiche(themeFiche, liste = ILLUSTRATIONS) {
  const duTheme = illustrationsDuTheme(themeFiche, liste);
  return duTheme.length ? duTheme : liste.filter((ill) => ill.theme === THEME_SECOURS);
}

// Liste fermée des mots-clés disponibles pour un thème de fiche (envoyée au
// modèle du carrousel détaillé).
// Les mots-clés de TOUTE la bibliothèque : le modèle choisit selon la mesure
// (tabac, carburant, loyers…), pas seulement selon le thème. `themeFiche` est
// gardé pour la compatibilité des appels.
export function motsClesDisponibles(themeFiche, liste = ILLUSTRATIONS) {
  return [...new Set(liste.flatMap((ill) => ill.motsCles ?? []))].sort();
}

// Images qui portent au moins un des mots-clés (toute la bibliothèque).
export function illustrationsDesMotsCles(motsCles, liste = ILLUSTRATIONS) {
  const voulus = (motsCles ?? []).map(motCleNormalise).filter(Boolean);
  return voulus.length ? liste.filter((ill) => (ill.motsCles ?? []).some((m) => voulus.includes(m))) : [];
}

// Images proposées par le bouton « Changer d'image » : celles des mots-clés
// de la mesure, sinon celles du thème (ou du dossier de secours).
export function illustrationsProposees({ theme, motsCles = [] }, liste = ILLUSTRATIONS) {
  const parMot = illustrationsDesMotsCles(motsCles, liste);
  return parMot.length ? parMot : illustrationsPourFiche(theme, liste);
}

// Contrôle des mots-clés choisis par le modèle : 0 à 2, dans la liste fermée.
// Renvoie { motsCles, avertissements } (un mot hors liste est écarté avec un
// avertissement : le choix retombe sur le tirage).
export function controlerMotsCles(proposes, disponibles) {
  const avertissements = [];
  const liste = (Array.isArray(proposes) ? proposes : []).map(motCleNormalise).filter(Boolean);
  if (liste.length > 2) avertissements.push(`illustration : ${liste.length} mots-clés proposés, seuls les 2 premiers sont gardés.`);
  const motsCles = [];
  for (const mot of liste.slice(0, 2)) {
    if (disponibles.includes(mot)) motsCles.push(mot);
    else avertissements.push(`illustration : mot-clé « ${mot} » hors de la liste du thème, écarté.`);
  }
  return { motsCles, avertissements };
}

// Choix de l'image de couverture :
//  - `demandee` (fichier, bouton « Changer d'image ») : prise telle quelle si
//    elle est dans la bibliothèque ;
//  - mots-clés de la mesure (choisis par le modèle dans la liste fermée de
//    toute la bibliothèque) : parmi les images qui en portent au moins un ;
//  - sujet de la mesure sans mot-clé, ou mot-clé sans image : AUCUNE image
//    (papier jaune tramé seul) et l'avertissement « Pas d'image pour … »,
//    plutôt qu'une image hors sujet ;
//  - ni sujet ni mot-clé (anciennes versions, carrousel 6 slides) : parmi les
//    images du thème de la fiche, sinon celles du thème de secours « general » ;
//  - en écartant les images des 2 derniers carrousels (`recentes` : fichiers,
//    le plus récent d'abord ; `derniere` : ancien paramètre, une seule image),
//    sinon la moins récemment utilisée (src/lib/rotation-images.js) ;
//  - `alea` (0 ≤ x < 1), fourni par l'appelant (stable pour une version :
//    voir aleaFiche), départage les images libres.
// Renvoie { illustration, avertissement } ; illustration null si ni le thème
// ni le secours n'ont d'image (couverture sans illustration, et un avertissement).
export function choisirIllustration({ theme, motsCles = [], sujet = "", recentes = [], derniere = null, demandee = null, alea = 0, liste = ILLUSTRATIONS }) {
  const historique = recentes?.length ? recentes : derniere ? [derniere] : [];
  const demandeeTrouvee = demandee ? liste.find((ill) => ill.fichier === demandee) : null;
  if (demandeeTrouvee) return { illustration: demandeeTrouvee, avertissement: null };
  const voulus = (motsCles ?? []).map(motCleNormalise).filter(Boolean);
  const sujetNet = motCleNormalise(sujet);
  if (voulus.length || sujetNet) {
    const parMot = illustrationsDesMotsCles(voulus, liste);
    if (parMot.length === 0) {
      const quoi = voulus.length ? voulus.join(", ") : sujetNet;
      return { illustration: null, avertissement: `Pas d'image pour « ${quoi} » : papier jaune tramé seul sur la couverture. Ajouter des images : npm run banque-images:themes, puis /test/illustrations.` };
    }
    return { illustration: choisirEnRotation(parMot, { cle: (ill) => ill.fichier, recentes: historique, alea }), avertissement: null };
  }
  const duTheme = illustrationsDuTheme(theme, liste);
  const pourFiche = illustrationsPourFiche(theme, liste);
  if (pourFiche.length === 0) {
    const nom = resolveTheme(theme) ?? theme ?? "(aucun)";
    return {
      illustration: null,
      avertissement: `Pas d'image de thème pour « ${nom} » ni dans le dossier de secours « ${THEME_SECOURS} » (couverture sans illustration). La remplir : npm run banque-images:themes, puis /test/illustrations.`,
    };
  }
  const avertissement = duTheme.length === 0 ? `Pas encore d'image pour le thème « ${resolveTheme(theme) ?? theme ?? "(aucun)"} » : image du dossier de secours « ${THEME_SECOURS} ».` : null;
  const illustration = choisirEnRotation(pourFiche, { cle: (ill) => ill.fichier, recentes: historique, alea });
  return { illustration, avertissement };
}

// Tirage stable pour une fiche (même image à chaque affichage), de 0 à 1.
export function aleaFiche(graine) {
  return parseInt(empreinte(String(graine)).slice(0, 8), 16) / 0x100000000;
}

// Ligne « Photo : auteur, licence, source » d'une image de thème.
function lignePhoto(illustration) {
  return `Photo : ${illustration.auteur}, ${illustration.licence}, ${illustration.source}`;
}

// Ligne de crédit visible (couverture, en tout petit, et slide de fin), ou
// null si la licence ne la demande pas (CC0, domaine public, Pexels).
export function creditVisible(illustration) {
  if (!illustration || !creditObligatoire(illustration.licence)) return null;
  return lignePhoto(illustration);
}

// Ligne de crédit pour la légende (toujours, quand une image est utilisée).
// Sources autorisées pour les illustrations (charte RS, page 11). Interdit :
// photos d'agences ou de médias, captures TV, images générées représentant
// des personnes réelles. Jamais de personne identifiable.
export const SOURCES_AUTORISEES = ["Wikimedia Commons", "Pexels", "Pixabay", "Unsplash"];

export function sourceAutorisee(source) {
  return SOURCES_AUTORISEES.some((s) => s.toLowerCase() === String(source ?? "").trim().toLowerCase());
}

export function creditLegende(illustration) {
  if (!illustration) return null;
  return `${lignePhoto(illustration)} ${illustration.lien ?? ""}`.trim();
}
