// Espace adhérent du Club (page /relectures) : onglets « Mes commentaires »
// et « Proposer une mesure ». Données lues sur :
//   - GET  /api/relectures/mes-commentaires (commentaires de l'adhérent connecté) ;
//   - GET  /api/relectures/propositions     (candidats + ses propositions) ;
//   - POST /api/relectures/propositions     (nouvelle proposition).
// Aucune donnée dans ce fichier : il est public, comme /club/annotations.js.
(function () {
  "use strict";

  var LOGIN_URL = "/relectures/connexion";

  var STATUTS = {
    retenu: "Retenu dans une nouvelle version",
    repondu: "Réponse de l’équipe",
    reporte: "Reporté sur la nouvelle version",
    clos: "Relecture close",
    en_attente: "En attente de la revue du dimanche",
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function paras(texte) {
    return String(texte || "")
      .split(/\n\s*\n/)
      .filter(function (p) { return p.trim(); })
      .map(function (p) { return "<p>" + esc(p.trim()) + "</p>"; })
      .join("");
  }

  function jour(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return "";
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" }).replace(/^1 /, "1er ");
  }

  function messageSession(el) {
    el.innerHTML = '<p class="cempty">Ta session a expiré. <a href="' + LOGIN_URL + '">Se reconnecter</a></p>';
  }

  function lire(url) {
    return fetch(url, { cache: "no-store", credentials: "same-origin" }).then(function (r) {
      if (r.status === 401) { var e = new Error("session"); e.expired = true; throw e; }
      if (!r.ok) throw new Error("http " + r.status);
      return r.json();
    });
  }

  // ---------------------------------------------------------------------
  // Mes commentaires
  // ---------------------------------------------------------------------
  var listeEl = document.querySelector("[data-mc-list]");
  var countEl = document.querySelector("[data-mc-count]");
  var filtresEl = document.querySelector("[data-mc-filtres]");
  var commentaires = null;
  var filtre = "tous";

  function correspond(c, f) {
    if (f === "tous") return true;
    if (f === "repondu") return c.statut === "repondu" || c.statut === "retenu";
    return c.statut === f;
  }

  function carteCommentaire(c) {
    var f = c.fiche || {};
    var titre = f.lien
      ? '<a href="' + esc(f.lien) + '">' + esc(f.titre) + "</a>"
      : esc(f.titre);
    var meta = [];
    if (f.candidat) meta.push("<span>" + esc(f.candidat) + "</span>");
    if (c.section) meta.push("<span>" + esc(c.section) + "</span>");
    meta.push("<span>" + esc(jour(c.date)) + "</span>");
    return (
      '<article class="mc-item">' +
      '<div class="mc-top"><span class="mc-statut s-' + esc(c.statut) + '">' + esc(STATUTS[c.statut] || c.statut) + "</span>" + meta.join("") + "</div>" +
      '<h2 class="mc-fiche">' + titre + "</h2>" +
      (c.passage ? '<p class="mc-passage">« ' + esc(c.passage.length > 400 ? c.passage.slice(0, 400) + "…" : c.passage) + " »</p>" : "") +
      '<div class="mc-texte">' + paras(c.texte) + "</div>" +
      (c.reponse ? '<div class="creply"><b>Réponse de Perlimpinpin</b>' + paras(c.reponse) + "</div>" : "") +
      "</article>"
    );
  }

  function afficherCommentaires() {
    if (!listeEl || !commentaires) return;
    Array.prototype.forEach.call(filtresEl.querySelectorAll("[data-mc]"), function (b) {
      var k = b.getAttribute("data-mc");
      b.setAttribute("aria-pressed", String(k === filtre));
      b.querySelector("i").textContent = commentaires.filter(function (c) { return correspond(c, k); }).length;
    });
    var visibles = commentaires.filter(function (c) { return correspond(c, filtre); });
    if (countEl) countEl.textContent = visibles.length + (visibles.length > 1 ? " commentaires" : " commentaire");
    if (!commentaires.length) {
      listeEl.innerHTML =
        '<p class="cempty">Tu n’as encore déposé aucun commentaire. Ouvre une <a href="/declarations">analyse publiée</a>, passe en vue experte et surligne un passage pour donner ton avis.</p>';
      return;
    }
    listeEl.innerHTML = visibles.length
      ? visibles.map(carteCommentaire).join("")
      : '<p class="cempty">Aucun commentaire dans cette catégorie.</p>';
  }

  function chargerCommentaires() {
    if (!listeEl) return;
    lire("/api/relectures/mes-commentaires")
      .then(function (liste) {
        commentaires = Array.isArray(liste) ? liste : [];
        afficherCommentaires();
      })
      .catch(function (e) {
        if (e.expired) return messageSession(listeEl);
        listeEl.innerHTML = '<p class="cempty">Impossible de charger tes commentaires pour l’instant. Recharge la page dans un moment.</p>';
      });
  }

  if (filtresEl) {
    filtresEl.addEventListener("click", function (ev) {
      var b = ev.target.closest && ev.target.closest("[data-mc]");
      if (!b) return;
      filtre = b.getAttribute("data-mc");
      afficherCommentaires();
    });
  }

  // ---------------------------------------------------------------------
  // Proposer une mesure
  // ---------------------------------------------------------------------
  var form = document.querySelector("[data-prop-form]");
  var msg = document.querySelector("[data-prop-msg]");
  var okBtn = document.querySelector("[data-prop-ok]");
  var propListe = document.querySelector("[data-prop-list]");
  var datalist = document.getElementById("prop-candidats");
  var propositions = [];
  var propChargees = false;

  function message(texte, type) {
    if (!msg) return;
    msg.textContent = texte || "";
    msg.className = "prop-msg" + (type ? " " + type : "");
  }

  function carteProposition(p) {
    var statut = p.statut === "non_retenue" ? "clos" : p.statut === "recue" ? "en_attente" : p.statut === "analysee" ? "retenu" : "repondu";
    return (
      '<article class="mc-item">' +
      '<div class="mc-top"><span class="mc-statut s-' + statut + '">' + esc(p.statutLibelle) + "</span><span>" + esc(p.candidat) + "</span><span>" + esc(jour(p.date)) + "</span></div>" +
      '<div class="mc-texte">' + paras(p.mesure) + "</div>" +
      (p.source ? '<p class="mc-top"><a href="' + esc(p.source) + '" target="_blank" rel="noopener noreferrer">Source</a></p>' : "") +
      (p.reponse ? '<div class="creply"><b>Réponse de Perlimpinpin</b>' + paras(p.reponse) + "</div>" : "") +
      (p.lien ? '<p class="mc-top"><a href="' + esc(p.lien) + '">Voir l’analyse publiée →</a></p>' : "") +
      "</article>"
    );
  }

  function afficherPropositions() {
    if (!propListe) return;
    propListe.innerHTML = propositions.length
      ? propositions.map(carteProposition).join("")
      : '<p class="cempty">Tu n’as pas encore proposé de mesure.</p>';
  }

  function chargerPropositions() {
    if (propChargees || !propListe) return;
    propChargees = true;
    lire("/api/relectures/propositions")
      .then(function (res) {
        if (datalist) {
          datalist.innerHTML = (res.candidats || []).map(function (n) { return '<option value="' + esc(n) + '">'; }).join("");
        }
        if (res.disponible === false) {
          okBtn.disabled = true;
          message("Cette fonction arrive très bientôt. Merci de ta patience !");
        }
        propositions = res.propositions || [];
        afficherPropositions();
      })
      .catch(function (e) {
        propChargees = false;
        if (e.expired) return messageSession(propListe);
        propListe.innerHTML = '<p class="cempty">Impossible de charger tes propositions pour l’instant.</p>';
      });
  }

  if (form) {
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (okBtn.disabled) return;
      var donnees = {
        candidat: form.candidat.value.trim(),
        mesure: form.mesure.value.trim(),
        source: form.source.value.trim(),
        pourquoi: form.pourquoi.value.trim(),
      };
      if (!donnees.candidat) { message("Indique le candidat ou la candidate.", "err"); form.candidat.focus(); return; }
      if (donnees.mesure.length < 15) { message("Décris la mesure en une ou deux phrases.", "err"); form.mesure.focus(); return; }

      okBtn.disabled = true;
      message("Envoi…");
      fetch("/api/relectures/propositions", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(donnees),
      })
        .then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (res) {
            if (r.status === 401) { var e = new Error("Ta session a expiré. Reconnecte-toi, ton texte est conservé ici."); throw e; }
            if (!r.ok) throw new Error(res.error || "Envoi impossible. Réessaie.");
            return res;
          });
        })
        .then(function (cree) {
          propositions.unshift(cree);
          afficherPropositions();
          form.reset();
          okBtn.disabled = false;
          message("Merci ! Ta proposition a bien été envoyée à l’équipe.", "ok");
        })
        .catch(function (e) {
          okBtn.disabled = false;
          message(e.message, "err");
        });
    });
  }

  // ---------------------------------------------------------------------
  // Chargement selon l'onglet affiché (le routage est dans la page)
  // ---------------------------------------------------------------------
  function selonOnglet() {
    var h = (location.hash || "").replace(/^#\/?/, "");
    if (h === "proposer") chargerPropositions();
  }
  window.addEventListener("hashchange", selonOnglet);
  chargerCommentaires();
  selonOnglet();
})();
