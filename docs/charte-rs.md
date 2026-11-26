# Charte graphique réseaux sociaux — règles en texte

> Source : `docs/charte-rs.pdf` (version 1, novembre 2026). **Elle fait foi** sur tous les prompts précédents (carrousel v6, complément, corrections).
> Jetons dans le code : `src/lib/charte-rs.js` (source unique, partagée avec les Reels). Règles d'écriture : `src/lib/ecriture-charte.js`. Check-list : `src/lib/verifications-charte.js`. Tests : `scripts/charte-rs.test.js`.

## 1. Principes (page 3)

1. On analyse **une proposition** (« son plan », « sa réforme »), pas le thème en général.
2. **On n'invente rien** : chaque chiffre vient de l'analyse ou d'une source citée. Pas d'analyse, pas de note.
3. **Équité stricte** : même structure, même longueur, même ton, même traitement visuel pour tous les candidats.
4. **Clair au premier coup d'œil** : ton naturel ; une phrase à relire est à réécrire.
5. **Transparents sur l'IA** : chaque publication finit par « analyse réalisée par l'IA Perlimpinpin » et invite à la corriger sur le site.

## 2. Écriture (page 4)

- Chaque titre apporte **un fait, un chiffre ou une conséquence**.
- Couverture : **seulement le nom de famille** (« Riner veut-il… »). Prénom présent → refus.
- Le **constat avant la proposition**.
- Un avis : « Notre avis : … », clair, argumenté, jamais caricatural ni ironique.
- Phrases de moins de 25 mots, mots de tous les jours, pas de jargon, pas de tournures « IA » (« en somme », « crucial », « il est important de noter »…).
- **Pas d'intertitre de rubrique** (« La mesure », « Impact », « Le constat », « Conclusion ») comme titre → refus. Les petites étiquettes en chasse fixe restent permises.
- **Nombres insécables** : 50 000, 20 %, 6,8 milliards, 30 à 40 ans ne se coupent jamais (le code pose les espaces insécables avant le rendu).
- **Aucun reste de maquette** : badge « exemple », « Candidat A », « [crédits à compléter] », « ?/100 » hors couverture programme → refus.

| À éviter | À préférer |
| --- | --- |
| Nos retraites sont dans le rouge. | Retraites : un trou de 6,8 milliards en 2030. |
| À long terme, ça peut payer. | Son pari peut payer… mais dans 30 à 40 ans. |
| Riner a le bon cap, mais pas le mode d'emploi. | Bonne idée, mais rien n'est chiffré. |
| Teddy Riner veut revoir les retraites. | Riner veut-il placer vos retraites en Bourse ? |
| La capitalisation ne résout pas le déficit. | D'ici 2 ans, le trou de 6,8 milliards reste entier. |

**Formules fixes**, écrites par le code :
- couverture : « Sa proposition : bonne idée… ou poudre de perlimpinpin ? »
- bilan : « Ce qui tient… et ce qui coince. »
- fin : « Une analyse réalisée par l'IA Perlimpinpin. »

## 3. Couleurs (pages 5 à 8)

**Marque (carrousels)** : jaune surlignage `#FFD23F` (mots clés, boutons, liseré photo) · papier crème `#F1ECE2` (fond des slides de contenu) · carte `#FBF8F2` · encre `#141413` · texte courant `#2A2926` · gris `#6E6A62` (sources, étiquettes). Interdits : violet néon, rose fluo, dégradés vifs ; le jaune est le seul « flash ».

**Reels** : charbon `#17130F`, crème `#F2E8D5`, moutarde `#E3A72F`, canard `#2F8C8A`, rouille `#CF5435`, olive clair `#8FA644`, gris chaud `#9C9384`.

**Verdicts** : Solide `#4F7A3A` (70 et plus) · Plausible sous condition `#C08A1E` (50 à 69) · Fragile `#C9622B` (35 à 49) · Peu réaliste `#B5432E` (moins de 35).
> ⚠ **Écart signalé, rien changé** : le verdict reste calculé par le code (`src/lib/score.js`), avec **6 paliers et des seuils 80 / 65 / 50 / 35 / 20**, pas 70 / 50 / 35. Chaque palier du code prend la couleur du verdict de charte correspondant : Exemplaire et Solide et chiffré → Solide ; Plausible sous condition → Plausible ; Partiellement fondé → Fragile ; Fragile et Irréaliste → Peu réaliste. Les libellés affichés restent ceux du code.

**Registre des candidats** (source unique, `REGISTRE_CANDIDATS`) :

| Candidat | Couleur | Fond | Bloc d'accent | Texte |
| --- | --- | --- | --- | --- |
| Bruno Retailleau | Marine | #22355C | #B04E28 | blanc |
| David Lisnard | Bleu poudre | #A7B8BD | #22355C | encre #1E1915 |
| Dominique de Villepin | Sable | #D9CDB3 | #24566E | encre #1E1915 |
| Édouard Philippe | Ardoise | #4C6178 | #8A4B2A | blanc |
| Éric Zemmour | Charbon | #2B2622 | #B04E28 | blanc |
| Fabien Roussel | Brique | #B5432E | #22355C | blanc |
| Gabriel Attal | Beurre | #EFD9A0 | #2D5A8C | encre #1E1915 (surlignage blanc) |
| Jean-Luc Mélenchon | Violet prune | #674A86 | #1F6A6A | blanc |
| Marine Le Pen | Pêche | #EFCDB6 | #22355C | encre #1E1915 |
| Marine Tondelier | Sapin | #2F6A4C | #B04E28 | blanc |
| Raphaël Glucksmann | Ocre | #9A632E | #24566E | blanc |
| Teddy Riner | Bleu Eames | #2C6A9E | #E89A5B | blanc |

Sur le papier crème, l'accent des fonds clairs (trop pâles pour se lire) devient leur bloc d'accent.

**Nouveau candidat** : le code refuse de générer s'il n'est pas au registre et propose 3 couleurs du nuancier (contraste du texte ≥ 4,5:1, pas déjà prises). Jamais de lien avec la couleur de son parti (vérification à la main). Rien n'est écrit sans validation.

**Nuancier mid-century** (20 couleurs, fond / accent) : 01 Teck #8A4B2A / #22355C · 02 Terracotta #B04E28 / #22355C · 03 Rouille #A2401F / #24566E · 04 Orange brûlé #B5551A / #22355C · 05 Moutarde #8F6F10 / #4E2E4F · 06 Or récolte #977000 / #22355C · 07 Olive #666620 / #7E2A35 · 08 Avocat #5A6B27 / #4E2E4F · 09 Sauge #4D6853 / #A2401F · 10 Sapin #2F5D46 / #B04E28 · 11 Canard #1F6A6A / #A2401F · 12 Turquoise atomique #1A7178 / #5A3A2A · 13 Pétrole #24566E / #B5551A · 14 Bleu Eames #2D5A8C / #8A4B2A · 15 Marine #22355C / #B04E28 · 16 Prune #6A3352 / #22355C · 17 Bordeaux #7E2A35 / #24566E · 18 Rose fumé #9A4A58 / #22355C · 19 Aubergine #4E2E4F / #977000 · 20 Chocolat #5A3A2A / #1A7178. Chaudes : 01 à 08 et 16 à 20 ; froides : 09 à 15. 05 et 06 : proches du jaune (avertissement).

**Fil Instagram** : avertissement fort si même couleur qu'un des 2 derniers posts ; avertissement simple si deux posts chauds (ou froids) de suite.

**Thèmes** (carrousel thématique, `COULEURS_THEMES` et `PICTOS_THEMES`), validés par Arno le 26/11/2026 :

| Thème | Couleur du nuancier | Contraste du blanc | Picto |
| --- | --- | --- | --- |
| Logement | 01 Teck #8A4B2A | 6,7:1 | house |
| Économie | 20 Chocolat #5A3A2A | 10,1:1 | wallet |
| Numérique | 12 Turquoise atomique #1A7178 | 5,7:1 | chart |
| École | 13 Pétrole #24566E | 8,0:1 | book |
| Sécurité | 19 Aubergine #4E2E4F | 11,5:1 | bank |
| Santé | 18 Rose fumé #9A4A58 | 6,0:1 | heart |
| Retraites | 11 Canard #1F6A6A | 6,3:1 | coin |
| Emploi | 04 Orange brûlé #B5551A | 4,9:1 | factory |
| Climat | 08 Avocat #5A6B27 | 5,9:1 | leaf |
| Agriculture | 07 Olive #666620 | 6,0:1 | leaf (partagé avec Climat) |
| Immigration | 16 Prune #6A3352 | 9,5:1 | globe |
| Institutions | 17 Bordeaux #7E2A35 | 9,3:1 | check |

Un nouveau thème sans couleur dans la table : pas de carrousel thématique.

## 4. Typographie (page 9)

Polices embarquées (`public/fonts/reel/`, `public/fonts/carrousel/`), aucun chargement externe :

| Rôle | Police | Charte | Code |
| --- | --- | --- | --- |
| Titre de couverture | Inter Display Black | 96 à 112 px, approche −3,5 % | 104 px, −3,64 px |
| Titres des slides | Inter Display Medium | 64 à 78 px, lignes équilibrées, jamais un mot seul | 64 px (fin : 70 px) |
| Sous-titre de couverture, accents | DM Serif Display | 44 à 46 px | 44 px |
| Étiquettes, boutons, sources, pied | JetBrains Mono | 22 à 32 px **et** jamais moins de 24 px → **24 à 32 px** | 24 à 32 px |
| Texte courant | Inter Display Medium | 36 à 42 px | 38 px |
| Reels seulement | Silkscreen | interdite dans les carrousels | — |

Si un texte déborde, **on raccourcit le texte** (relance du modèle sur ce champ), jamais la police. Zones réservées : pied de page, bande, collage de la couverture, 40 px des bords gauche et droit.

## 5. Textures (page 10)

- **Grain obligatoire** sur tous les fonds : plus marqué sur la couleur (couverture, fin), léger sur le papier crème et les cartes.
- **Bande « billet de banque »** en bas de chaque slide : bandes obliques de hachures fines, traits cassés ; hachures blanches sur la couleur (encre sur les fonds clairs), couleurs du candidat ailleurs ; motif tiré du numéro de slide, jamais le même.
- **Pixels légers** (couverture programme) : petits carrés très transparents, tailles et couleurs variées, plus denses près de la photo.

## 6. Photos (page 11)

- Candidat toujours en noir et blanc, avec grain. **On ne retouche jamais le visage** ; jamais de photo générée par IA. Portrait récent, de face ou trois quarts, expression neutre, sans logo de parti.
- « Une mesure » : détouré, liseré blanc, devant le bloc d'accent ; collage papier jaune tramé déchiré + illustration N&B teintée de jaune.
- Programme et thématique : photo au centre avec liseré jaune `#FFD23F`, sans arche ni bloc ; thématique : médaillons ronds dans la couleur de chaque candidat.
- Illustrations : jamais de personne identifiable (case obligatoire sur `/test/illustrations`). Sources autorisées : Wikimedia Commons, Pexels, Pixabay, Unsplash. Interdit : agences, médias, captures TV, images générées de personnes réelles.
- Crédits sur la couverture et dans `credits.txt` / la légende : contrôle bloquant.
> ⚠ **Écart signalé** : la charte dit « photo fournie par l'équipe, jamais cherchée par l'IA ». On garde la recherche Commons (le script ne fait que **proposer**) : seules les photos cochées à la main sur `/test/photos-candidats` entrent dans la bibliothèque.

## 7. Pictos et cartes (page 12)

Liste fermée : `coin, ball, heart, house, book, leaf, globe, bubble, hourglass, calendar, wallet, factory, bank, check, cross, chart, down`, en encre, blanc, jaune ou couleur du candidat, seulement là où il reste de la place, jamais collés à un titre.

## 8. Formats (pages 13 à 16)

- **Une mesure** (8 slides) : couverture, constat puis proposition, la note, court terme, long terme, ailleurs ou avant, notre avis, fin.
- **Analyse de programme** (10 slides) : couverture fixe « On a noté 6 mesures de [Nom]. », vue d'ensemble (moyenne calculée par le code), une slide par mesure, notre avis, fin. 6 fiches publiées sur 6 thèmes, dans l'ordre où le candidat les met en avant (rang saisi à la main).
- **Thématique** : « [Thème] : ce que proposent les candidats », 4 à 8 candidats, ordre alphabétique (jamais par note), candidat sans fiche : « Pas de proposition publiée sur ce thème à ce jour », sans note ; classement seulement sur le comparatif. Slide candidat : « Sa proposition », « Notre regard », « Faisable ? » (note, verdict, coût seulement s'il est dans la fiche).
> Écart signalé : le prompt v7 écrivait « La proposition » sur la slide candidat thématique ; la charte dit « Sa proposition » : c'est la charte qui est appliquée.

## 9. Vérifications avant publication (page 20)

Cochées par le code : chiffres présents dans la fiche, somme des sous-notes = note, note absente de la couverture, constat avant proposition, nom de famille seul en couverture, aucun débordement, nombres insécables, couleur du registre, grain présent, crédits présents, notes réelles / moyenne exacte / ordre alphabétique (programme, thématique), aucun reste de maquette, fin conforme.
À cocher à la main : « le texte se comprend en une lecture », « même traitement que les autres candidats », « photo conforme ».
