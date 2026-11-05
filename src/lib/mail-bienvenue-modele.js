// Modèle HTML du mail de bienvenue du Club Perlimpinpin (adhésion HelloAsso).
// Mis en page sur le modèle de « La lettre de Perlimpinpin ». Généré à partir de
// la maquette validée le 23 octobre 2026 : modifier le texte ici directement.
// __SALUTATION__ est remplacé par « Bonjour Prénom, » et __LIEN_ACTIVATION__ par le
// lien personnel « Choisir mon mot de passe » (voir src/lib/mail-bienvenue.js).
// Novembre 2026 (Club ouvert) : texte revu pour l'annotation des analyses publiées,
// et accent jaune (#FFE45C, texte sombre posé dessus) à la place de l'orange.
// Images servies par le site : /logo/perlimpinpin-logo.png, /bannière/Rejoindre.jpeg,
// /club/mascotte-bienvenue.jpg (public/club/).

export const MODELE_HTML_BIENVENUE = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bienvenue au Club Perlimpinpin</title>
<link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  @media only screen and (max-width: 620px) {
    .container { width: 100% !important; }
    .px { padding-left: 20px !important; padding-right: 20px !important; }
    .col { display: block !important; width: 100% !important; box-sizing: border-box; }
    .hero-img { padding: 8px 0 0 0 !important; text-align: center !important; }
    .h1 { font-size: 38px !important; line-height: 40px !important; }
    .pts { display: block !important; width: 100% !important; box-sizing: border-box; padding: 0 0 10px 0 !important; }
    .hide-m { display: none !important; }
    .banner-txt { width: 100% !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#FAF8F5;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FAF8F5" style="background-color:#FAF8F5;">
<tr><td align="center" style="padding:24px 12px;">

<table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px; background-color:#FFFFFF; border:1px solid #EEECE8; border-radius:16px; font-family:'Inter Tight', 'Helvetica Neue', Helvetica, Arial, sans-serif; color:#111114;">

  <!-- BARRE DU HAUT -->
  <tr>
    <td class="px" style="padding:26px 36px 0 36px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td valign="middle"><a href="https://perlimpinpin.ai" style="text-decoration:none;"><img src="https://perlimpinpin.ai/logo/perlimpinpin-logo.png" alt="Perlimpinpin" width="150" style="display:block; width:150px; height:auto; border:0;"></a></td>
          <td valign="middle" align="right" style="font-size:12px; color:#8A8B99;">Club Perlimpinpin<span class="hide-m"> &nbsp;·&nbsp; <a href="https://perlimpinpin.ai/relectures" style="color:#8A8B99;">Espace membres</a></span></td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- HERO -->
  <tr>
    <td class="px" style="padding:30px 20px 10px 36px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td class="col" width="58%" valign="middle">
            <h1 class="h1" style="margin:0; font-size:44px; line-height:46px; font-weight:800; letter-spacing:-1.5px; color:#111114;">Bienvenue<br><span style="color:#7F8092;">au Club !</span></h1>
            <p style="margin:16px 0 0 0; font-size:16px; line-height:23px; color:#6E7080;">Ça y est, tu fais partie de l'aventure. Une politique fondée sur les faits, pas sur les discours.</p>
          </td>
          <td class="col hero-img" width="42%" valign="middle" align="right" style="padding:0;">
            <img src="https://perlimpinpin.ai/club/mascotte-bienvenue.jpg" alt="" width="230" style="display:inline-block; width:230px; max-width:100%; height:auto; border:0;">
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- INTRO -->
  <tr>
    <td class="px" style="padding:22px 36px 6px 36px; font-size:16px; line-height:25px; color:#2A2B33;">
      <p style="margin:0 0 14px 0; font-weight:600; color:#111114;">__SALUTATION__</p>
      <p style="margin:0 0 14px 0;">Pendant cette campagne, des centaines de promesses vont circuler. Des chiffres lancés en plateau, des mesures « financées » sans qu'on sache comment, des slogans qui sonnent bien mais ne tiennent pas. Très peu seront examinées sérieusement.</p>
      <p style="margin:0;">Perlimpinpin existe pour changer ça. Chaque proposition est passée au crible, sources à l'appui, pour que chacun puisse savoir ce qui tient la route… et ce qui relève de la poudre de Perlimpinpin. Sans parti pris, quel que soit le candidat.</p>
    </td>
  </tr>

  <!-- OBJECTIF (carte à la une) -->
  <tr>
    <td class="px" style="padding:22px 36px 0 36px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #EEECE8; border-radius:14px;">
        <tr>
          <td style="padding:22px 24px;">
            <p style="margin:0 0 10px 0; font-family:'Courier New', Courier, monospace; font-size:12px; letter-spacing:1.5px; color:#8A8B99;">// NOTRE_OBJECTIF</p>
            <p style="margin:0; font-size:24px; line-height:30px; font-weight:700; letter-spacing:-0.5px; color:#111114;">Une politique fondée sur les faits, <span style="background-color:#FFE45C; padding:0 4px;">pas sur les discours.</span></p>
            <p style="margin:14px 0 0 0; font-size:15px; line-height:22px; color:#6E7080;">En nous rejoignant, tu deviens l'un des gardiens de cette exigence.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- CE QU'ON FAIT ENSEMBLE -->
  <tr>
    <td class="px" style="padding:36px 36px 0 36px;">
      <h2 style="margin:0 0 6px 0; font-size:24px; line-height:30px; font-weight:700; letter-spacing:-0.5px; color:#111114;">Ce qu'on fait ensemble</h2>
      <p style="margin:0 0 16px 0; font-size:15px; line-height:22px; color:#6E7080;">Les analyses publiées sur <a href="https://perlimpinpin.ai" style="color:#111114;">perlimpinpin.ai</a> restent ouvertes : en tant que membre du Club, tu peux les annoter et les challenger à tout moment.</p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #EEECE8; border-radius:12px; margin-bottom:10px;">
        <tr>
          <td width="62" valign="middle" style="padding:16px 0 16px 20px; font-size:28px; line-height:30px; font-weight:800; color:#111114;"><span style="background-color:#FFE45C; padding:0 5px; border-radius:6px;">01</span></td>
          <td valign="middle" style="padding:16px 20px 16px 6px; font-size:15px; line-height:22px; color:#2A2B33;">Sur n'importe quelle analyse, tu surlignes un passage et tu laisses une annotation : une source à ajouter, un chiffre discutable, un argument oublié, une question…</td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #EEECE8; border-radius:12px; margin-bottom:10px;">
        <tr>
          <td width="62" valign="middle" style="padding:16px 0 16px 20px; font-size:28px; line-height:30px; font-weight:800; color:#111114;"><span style="background-color:#FFE45C; padding:0 5px; border-radius:6px;">02</span></td>
          <td valign="middle" style="padding:16px 20px 16px 6px; font-size:15px; line-height:22px; color:#2A2B33;">Chaque semaine, l'équipe passe en revue toutes les annotations. Celles qui apportent un argument ou une source sont étudiées de près.</td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #EEECE8; border-radius:12px; margin-bottom:10px;">
        <tr>
          <td width="62" valign="middle" style="padding:16px 0 16px 20px; font-size:28px; line-height:30px; font-weight:800; color:#111114;"><span style="background-color:#FFE45C; padding:0 5px; border-radius:6px;">03</span></td>
          <td valign="middle" style="padding:16px 20px 16px 6px; font-size:15px; line-height:22px; color:#2A2B33;">Si elles changent l'analyse, la fiche est révisée : une nouvelle version (V2, V3…) est publiée, avec son historique.</td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #EEECE8; border-radius:12px;">
        <tr>
          <td width="62" valign="middle" style="padding:16px 0 16px 20px; font-size:28px; line-height:30px; font-weight:800; color:#111114;"><span style="background-color:#FFE45C; padding:0 5px; border-radius:6px;">04</span></td>
          <td valign="middle" style="padding:16px 20px 16px 6px; font-size:15px; line-height:22px; color:#2A2B33;">L'équipe te répond sous 7 jours.</td>
        </tr>
      </table>
      <p style="margin:14px 0 0 0; font-size:14px; line-height:21px; color:#8A8B99;">Pas besoin d'être expert : un « je n'ai pas compris ce passage » compte autant qu'une référence de la Cour des comptes.</p>
    </td>
  </tr>

  <!-- ACTIVER SON COMPTE -->
  <tr>
    <td class="px" style="padding:36px 36px 0 36px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F7F6F3" style="background-color:#F7F6F3; border-radius:14px;">
        <tr>
          <td style="padding:24px;">
            <p style="margin:0 0 6px 0; font-family:'Courier New', Courier, monospace; font-size:12px; letter-spacing:1.5px; color:#8A8B99;">// 1_MINUTE</p>
            <h2 style="margin:0 0 14px 0; font-size:22px; line-height:28px; font-weight:700; letter-spacing:-0.5px; color:#111114;">Choisis ton mot de passe</h2>
            <p style="margin:0 0 20px 0; font-size:15px; line-height:22px; color:#2A2B33;">Un clic sur ce bouton, un mot de passe, et tu peux annoter ta première analyse.</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td bgcolor="#FFE45C" style="background-color:#FFE45C; border-radius:999px;">
                  <a href="__LIEN_ACTIVATION__" style="display:inline-block; padding:13px 26px; font-size:15px; font-weight:600; color:#111114; text-decoration:none; border-radius:999px;">Choisir mon mot de passe →</a>
                </td>
              </tr>
            </table>
            <p style="margin:16px 0 0 0; font-size:13px; line-height:20px; color:#8A8B99;">Ce lien est personnel, valable 7 jours, et ne sert qu'une fois. Passé ce délai : <a href="https://perlimpinpin.ai/relectures/inscription" style="color:#6E7080;">perlimpinpin.ai/relectures/inscription</a>, avec l'adresse e-mail de ton adhésion. Ensuite, il suffira de te connecter sur <a href="https://perlimpinpin.ai/relectures/connexion" style="color:#6E7080;">perlimpinpin.ai/relectures/connexion</a>.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- PERLIMPINPOINTS -->
  <tr>
    <td class="px" style="padding:36px 36px 0 36px;">
      <h2 style="margin:0 0 6px 0; font-size:24px; line-height:30px; font-weight:700; letter-spacing:-0.5px; color:#111114;">Les PerlimpinPOINTS</h2>
      <p style="margin:0 0 16px 0; font-size:15px; line-height:22px; color:#6E7080;">Chaque annotation fait avancer la mission, et ça mérite d'être reconnu :</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td class="pts" width="33%" valign="top" style="padding:0 5px 0 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #EEECE8; border-radius:12px;"><tr>
              <td style="padding:16px;">
                <p style="margin:0; font-size:32px; line-height:34px; font-weight:800; color:#111114;"><span style="background-color:#FFE45C; padding:0 5px; border-radius:6px;">+10</span><span style="font-size:15px; font-weight:500; color:#8A8B99;"> pts</span></p>
                <p style="margin:8px 0 10px 0; font-size:14px; line-height:20px; color:#2A2B33;">pour chaque annotation</p>
                <span style="display:inline-block; padding:4px 10px; border-radius:999px; background-color:#FFF3B0; color:#5C4A00; font-size:12px; font-weight:600; white-space:nowrap;">jusqu'à 5 par fiche</span>
              </td>
            </tr></table>
          </td>
          <td class="pts" width="33%" valign="top" style="padding:0 5px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #EEECE8; border-radius:12px;"><tr>
              <td style="padding:16px;">
                <p style="margin:0; font-size:32px; line-height:34px; font-weight:800; color:#111114;"><span style="background-color:#FFE45C; padding:0 5px; border-radius:6px;">+20</span><span style="font-size:15px; font-weight:500; color:#8A8B99;"> pts</span></p>
                <p style="margin:8px 0 10px 0; font-size:14px; line-height:20px; color:#2A2B33;">en bonus</p>
                <span style="display:inline-block; padding:4px 10px; border-radius:999px; background-color:#FFF3B0; color:#5C4A00; font-size:12px; font-weight:600; white-space:nowrap;">annotation retenue</span>
              </td>
            </tr></table>
          </td>
          <td class="pts" width="33%" valign="top" style="padding:0 0 0 5px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #EEECE8; border-radius:12px;"><tr>
              <td style="padding:16px;">
                <p style="margin:0; font-size:32px; line-height:34px; font-weight:800; color:#111114;">150<span style="font-size:15px; font-weight:500; color:#8A8B99;"> pts</span></p>
                <p style="margin:8px 0 10px 0; font-size:14px; line-height:20px; color:#2A2B33;">pour gagner un rang</p>
                <span style="display:inline-block; padding:4px 10px; border-radius:999px; background-color:#F1F1F4; color:#4A4B57; font-size:12px; font-weight:600; white-space:nowrap;">nouveau rang</span>
              </td>
            </tr></table>
          </td>
        </tr>
      </table>
      <p style="margin:18px 0 6px 0; font-size:14px; line-height:22px;">
        <span style="display:inline-block; padding:5px 13px; margin:2px 2px 2px 0; border-radius:999px; background-color:#F6E2D2; color:#8A4B1E; font-weight:600; font-size:13px;">Bronze</span>
        <span style="display:inline-block; padding:5px 13px; margin:2px; border-radius:999px; background-color:#ECEDF1; color:#4A4B57; font-weight:600; font-size:13px;">Silver</span>
        <span style="display:inline-block; padding:5px 13px; margin:2px; border-radius:999px; background-color:#FBEFC4; color:#7A5A00; font-weight:600; font-size:13px;">Gold</span>
        <span style="display:inline-block; padding:5px 13px; margin:2px; border-radius:999px; background-color:#111114; color:#FFFFFF; font-weight:600; font-size:13px;">???</span>
      </p>
      <p style="margin:0; font-size:14px; line-height:21px; color:#8A8B99;">… et la suite reste une surprise. Les membres les plus actifs seront mis à l'honneur dans le Club.</p>
    </td>
  </tr>

  <!-- ET CE N'EST QU'UN DÉBUT -->
  <tr>
    <td class="px" style="padding:36px 36px 0 36px;">
      <h2 style="margin:0 0 6px 0; font-size:24px; line-height:30px; font-weight:700; letter-spacing:-0.5px; color:#111114;">Et ce n'est qu'un début</h2>
      <p style="margin:0 0 16px 0; font-size:15px; line-height:22px; color:#6E7080;">Le Club, ce n'est pas seulement des analyses à challenger :</p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #EEECE8; border-radius:12px; margin-bottom:10px;">
        <tr>
          <td width="64" valign="top" style="padding:16px 0 16px 18px;"><div style="width:42px; height:42px; line-height:42px; border-radius:21px; background-color:#F4F3F0; text-align:center; font-size:19px;">🤝</div></td>
          <td valign="top" style="padding:16px 20px 16px 4px;">
            <p style="margin:0 0 3px 0; font-size:15px; line-height:21px; font-weight:700; color:#111114;">Des rendez-vous réguliers</p>
            <p style="margin:0; font-size:14px; line-height:20px; color:#6E7080;">En visio ou en vrai, pour se retrouver, parler des analyses en cours et choisir ensemble les prochaines propositions à passer au crible.</p>
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #EEECE8; border-radius:12px; margin-bottom:10px;">
        <tr>
          <td width="64" valign="top" style="padding:16px 0 16px 18px;"><div style="width:42px; height:42px; line-height:42px; border-radius:21px; background-color:#F4F3F0; text-align:center; font-size:19px;">🎤</div></td>
          <td valign="top" style="padding:16px 20px 16px 4px;">
            <p style="margin:0 0 3px 0; font-size:15px; line-height:21px; font-weight:700; color:#111114;">Des événements</p>
            <p style="margin:0; font-size:14px; line-height:20px; color:#6E7080;">Tout au long de la campagne (débats, soirées, rencontres), où chaque membre est invité, et qu'on pourra aussi organiser ensemble.</p>
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #EEECE8; border-radius:12px;">
        <tr>
          <td width="64" valign="top" style="padding:16px 0 16px 18px;"><div style="width:42px; height:42px; line-height:42px; border-radius:21px; background-color:#F4F3F0; text-align:center; font-size:19px;">💬</div></td>
          <td valign="top" style="padding:16px 20px 16px 4px;">
            <p style="margin:0 0 3px 0; font-size:15px; line-height:21px; font-weight:700; color:#111114;">Une communauté engagée</p>
            <p style="margin:0; font-size:14px; line-height:20px; color:#6E7080;">Des échanges entre membres et des coups de main sur les fiches, selon les envies et les compétences de chacun.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- FAISONS CONNAISSANCE -->
  <tr>
    <td class="px" style="padding:36px 36px 0 36px;">
      <h2 style="margin:0 0 10px 0; font-size:24px; line-height:30px; font-weight:700; letter-spacing:-0.5px; color:#111114;">Faisons connaissance</h2>
      <p style="margin:0 0 12px 0; font-size:15px; line-height:23px; color:#2A2B33;">Si tu le souhaites, n'hésite pas à répondre à ce message pour te présenter en quelques mots : ce qui t'a amené ici, les sujets qui te tiennent à cœur, la proposition de candidat que tu aimerais voir analysée. On lit tout, et tes idées orientent les prochaines fiches.</p>
      <p style="margin:0; font-size:14px; line-height:21px; color:#8A8B99;">Un souci à l'inscription ? Réponds simplement à ce message, on s'en occupe.</p>
    </td>
  </tr>

  <!-- FAIS GRANDIR LE CLUB (bannière) -->
  <tr>
    <td class="px" style="padding:36px 26px 0 26px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:16px;">
        <tr>
          <td background="https://perlimpinpin.ai/banni%C3%A8re/Rejoindre.jpeg" bgcolor="#EFE6EE" style="background-color:#EFE6EE; background-image:url('https://perlimpinpin.ai/banni%C3%A8re/Rejoindre.jpeg'); background-size:cover; background-position:center right; border-radius:16px; padding:30px 28px;">
            <table role="presentation" class="banner-txt" width="64%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <h2 style="margin:0 0 10px 0; font-size:24px; line-height:29px; font-weight:800; letter-spacing:-0.5px; color:#111114;">Fais grandir le Club.</h2>
                  <p style="margin:0 0 12px 0; font-size:14px; line-height:21px; color:#3A3B45;">Une politique sur les faits, ça ne se construit pas à quelques-uns. Plus on est nombreux à challenger les analyses, plus elles sont solides, et plus elles pèsent dans le débat.</p>
                  <p style="margin:0 0 18px 0; font-size:15px; line-height:22px; font-weight:700; color:#111114;">Tu connais quelqu'un qui en a assez des promesses en l'air ? Envoie-lui ce lien (pas ce mail : ton lien pour choisir ton mot de passe est personnel) :</p>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td bgcolor="#111114" style="background-color:#111114; border-radius:999px;">
                        <a href="https://perlimpinpin.ai/nous-rejoindre" style="display:inline-block; padding:13px 24px; font-size:15px; font-weight:600; color:#FFFFFF; text-decoration:none; border-radius:999px;">perlimpinpin.ai/nous-rejoindre →</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- SIGNATURE -->
  <tr>
    <td class="px" style="padding:32px 36px 30px 36px; font-size:15px; line-height:23px; color:#2A2B33;">
      <p style="margin:0 0 12px 0;">Très heureux de t'avoir avec nous. À très vite sur les fiches !</p>
      <p style="margin:0;"><strong style="color:#111114;">Arno</strong>, au nom du Club Perlimpinpin</p>
    </td>
  </tr>

  <!-- PIED DE PAGE -->
  <tr>
    <td class="px" style="padding:0 36px 28px 36px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #EEECE8;">
        <tr>
          <td class="col" valign="middle" style="padding-top:20px;"><img src="https://perlimpinpin.ai/logo/perlimpinpin-logo.png" alt="Perlimpinpin" width="130" style="display:block; width:130px; height:auto; border:0;"></td>
          <td class="col" valign="middle" align="right" style="padding-top:20px; font-size:12px; line-height:20px;">
            <a href="https://perlimpinpin.ai/declarations" style="color:#8A8B99;">Déclarations</a>&nbsp;&nbsp;
            <a href="https://perlimpinpin.ai/candidats" style="color:#8A8B99;">Candidats</a>&nbsp;&nbsp;
            <a href="https://perlimpinpin.ai/themes" style="color:#8A8B99;">Thèmes</a>&nbsp;&nbsp;
            <a href="https://perlimpinpin.ai/methode" style="color:#8A8B99;">Méthode</a>&nbsp;&nbsp;
            <a href="https://perlimpinpin.ai/a-propos" style="color:#8A8B99;">À propos</a>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="padding-top:14px; font-size:12px; line-height:18px; color:#A3A4B0;">
            <a href="https://x.com/PerlimpinpinAI" style="color:#A3A4B0;">X</a> · <a href="https://www.instagram.com/perlimpinpin.ai" style="color:#A3A4B0;">Instagram</a> · <a href="https://www.linkedin.com/company/perlimpinpin-ai" style="color:#A3A4B0;">LinkedIn</a><br>
            Association Perlimpinpin · Analyses gratuites, sans publicité et sans influence politique.
          </td>
        </tr>
      </table>
    </td>
  </tr>

</table>

</td></tr>
</table>
</body>
</html>
`;
