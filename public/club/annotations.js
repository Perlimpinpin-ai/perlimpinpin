/* Outil d'annotation du Club Perlimpinpin (surligneur + note jaune), partagé par :
 *   - l'espace /relectures (scripts/templates/relectures.html) ;
 *   - la vue experte des fiches publiées (src/components/AnnotationsFiche.js).
 * Extrait tel quel de /relectures (novembre 2026, « Club ouvert ») : même
 * ancrage, même surlignage, même formulaire. Chaque page fournit sa
 * configuration (adresse de l'API, droit d'annoter, marge ou non…).
 *
 * Ancrage : une annotation porte sur un passage de la zone de texte d'une
 * section commentable ([data-comment-target] > racine). startOffset/endOffset
 * sont des positions en caractères dans le textContent de cette zone : les
 * <mark> du surlignage n'ajoutent pas de texte, les positions restent justes.
 * Si le texte a changé (nouvelle version), on cherche le passage cité au plus
 * près de son ancienne position ; introuvable : note « orpheline ».
 *
 * Identifiant de section : attribut data-anno-cle s'il existe (fiches
 * publiées : clé du contenu, ex. « contexte_national »), sinon l'id HTML
 * (/relectures).
 *
 * Mode lectureSeule : seuls les passages surlignés sont affichés, sans note ni
 * bouton « Annoter ». afficherNotes: false (visiteur d'une fiche publiée) :
 * on peut annoter, mais les notes des autres ne sont pas affichées (le serveur
 * n'envoie que des zones sans texte). surClicZone : appelé au clic sur un
 * passage surligné ou une bulle (sinon, les notes repliées s'ouvrent).
 * avantEnvoi(donnees, form, brouillon) : renvoie false pour NE PAS envoyer
 * (visiteur : la note est gardée dans le navigateur, voir AnnotationsFiche).
 * reprendreBrouillon({ sectionId, quotedText, startOffset, body, creditAccord }) :
 * rouvre une note gardée, au même passage, prête à envoyer.
 *
 * Aucune dépendance, aucune donnée : ce fichier est public (public/club/).
 */
(function () {
  "use strict";

  var RACINE_DEFAUT = ":scope > .body, :scope > .qs, :scope > h1";
  var PARAS = "p, li, blockquote, dd";

  function escDefaut(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function cssEchappe(s) {
    return window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/["\\]/g, "\\$&");
  }

  function creer(cfg) {
    var esc = cfg.esc || escDefaut;
    var fmtDate = cfg.fmtDate || function (iso) { return iso ? new Date(iso).toLocaleDateString("fr-FR") : ""; };
    var ANNOT_ROOT = cfg.racine || RACINE_DEFAUT;
    var lectureSeule = Boolean(cfg.lectureSeule);
    var marginMq = window.matchMedia(cfg.margeMedia || "(min-width:760px)");
    var hoverMq = window.matchMedia("(hover:hover) and (pointer:fine) and (min-width:760px)");
    var coarseMq = window.matchMedia("(pointer:coarse)");
    var avecMarge = function () { return cfg.marge !== false && marginMq.matches; };
    var avecPastille = function () { return cfg.pastille !== false && hoverMq.matches && avecMarge(); };
    var annotsBySlug = {}; // ficheSlug -> [annotation]
    var draft = null; // { slug, sectionId, target, el }

    function openView() {
      return cfg.vueOuverte ? cfg.vueOuverte() : null;
    }

    function slugOf(view) {
      return view ? view.getAttribute("data-view") : null;
    }

    function canAnnotate(view) {
      if (lectureSeule || !view || view.hidden) return false;
      return cfg.peutAnnoter ? cfg.peutAnnoter(view) : true;
    }

    function sectionIdOf(section) {
      return section.getAttribute("data-anno-cle") || section.id;
    }

    function sectionOf(sectionId) {
      return document.querySelector('[data-anno-cle="' + cssEchappe(sectionId) + '"]') || document.getElementById(sectionId);
    }

    function sectionLabelOf(section) {
      return section.getAttribute("data-anno-label") || (section.querySelector("h1,h2,h3") || {}).textContent || "";
    }

    function rootOf(node) {
      var el = node && (node.nodeType === 1 ? node : node.parentElement);
      if (!el || el.closest("button, input, textarea, .anote, .anno-inline, .anno-layer, .anno-bulle")) return null;
      var section = el.closest("[data-comment-target]");
      var root = section && section.querySelector(ANNOT_ROOT);
      return root && root.contains(el) ? root : null;
    }

    function textOffset(root, node, offset) {
      var r = document.createRange();
      r.setStart(root, 0);
      r.setEnd(node, offset);
      return r.toString().length;
    }

    // Cible d'annotation : positions débarrassées des blancs de bord.
    function makeTarget(root, start, end) {
      var full = root.textContent;
      while (start < end && /\s/.test(full.charAt(start))) start++;
      while (end > start && /\s/.test(full.charAt(end - 1))) end--;
      if (end <= start) return null;
      var section = root.closest("[data-comment-target]");
      var view = section.closest("[data-view]");
      if (!canAnnotate(view)) return null;
      return { view: view, section: section, root: root, start: start, end: end, text: full.slice(start, end) };
    }

    // Sélection → cible. Un bout qui déborde de la zone de texte (titre de la
    // section, marge, bouton) est rogné ; deux zones différentes sont refusées.
    function selectionTarget() {
      var sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
      var range = sel.getRangeAt(0);
      var r1 = rootOf(range.startContainer);
      var r2 = rootOf(range.endContainer);
      if (r1 && r2 && r1 !== r2) return null;
      var root = r1 || r2;
      if (!root) return null;
      var start = r1 ? textOffset(root, range.startContainer, range.startOffset) : 0;
      var end = r2 ? textOffset(root, range.endContainer, range.endOffset) : root.textContent.length;
      return makeTarget(root, start, end);
    }

    function paragraphTarget(para) {
      var root = para.closest("[data-comment-target]").querySelector(ANNOT_ROOT);
      var start = textOffset(root, para, 0);
      return makeTarget(root, start, start + para.textContent.length);
    }

    function sectionTarget(section) {
      var root = section && section.querySelector(ANNOT_ROOT);
      return root ? makeTarget(root, 0, root.textContent.length) : null;
    }

    // Paragraphes survolables : pas les intertitres (.mini) ni les lignes qui
    // ne contiennent qu'un bouton (« Voir le raisonnement complet → »).
    function paragraphsOf(root) {
      if (root.matches("h1")) return [root];
      return Array.prototype.filter.call(root.querySelectorAll(PARAS), function (p) {
        if (p.matches(".mini")) return false;
        var text = p.textContent.trim();
        if (!text) return false;
        var btnText = Array.prototype.map.call(p.querySelectorAll("button"), function (b) { return b.textContent; }).join("").trim();
        return text !== btnText;
      });
    }

    // Surligne [start, end[ de root en entourant chaque bout de texte d'un <mark>.
    function wrapRange(root, start, end, id, cls) {
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var pos = 0, node, parts = [];
      while ((node = walker.nextNode()) && pos < end) {
        var len = node.data.length;
        var s = Math.max(start - pos, 0), e = Math.min(end - pos, len);
        // Les blancs entre deux blocs restent hors <mark> (sinon, dans une grille, ils deviendraient un élément).
        if (s < e && /\S/.test(node.data.slice(s, e))) parts.push([node, s, e]);
        pos += len;
      }
      return parts.map(function (p) {
        var n = p[0];
        if (p[2] < n.data.length) n.splitText(p[2]);
        if (p[1] > 0) n = n.splitText(p[1]);
        var mark = document.createElement("mark");
        mark.className = cls;
        mark.setAttribute("data-anno", id);
        n.parentNode.insertBefore(mark, n);
        mark.appendChild(n);
        return mark;
      });
    }

    function unwrapMarks(scope, id) {
      Array.prototype.forEach.call(scope.querySelectorAll('mark.anno-hl[data-anno="' + id + '"]'), function (m) {
        var parent = m.parentNode;
        while (m.firstChild) parent.insertBefore(m.firstChild, m);
        parent.removeChild(m);
        parent.normalize();
      });
    }

    function excerpt(text) {
      var t = text.replace(/\s+/g, " ");
      return "« " + (t.length > 90 ? t.slice(0, 90) + "…" : t) + " »";
    }

    // --- brouillon de note (formulaire) ---

    function startDraft(target) {
      if (!target) return;
      if (draft) {
        if (draft.el.body.value.trim() && !window.confirm("Abandonner la note en cours ?")) return;
        cancelDraft();
      }
      hideAnnot();
      hidePastille();
      var sel = window.getSelection();
      if (sel) sel.removeAllRanges();
      wrapRange(target.root, target.start, target.end, "draft", "anno-hl pending");
      var form = document.createElement("form");
      form.className = "anote anote-draft";
      form.innerHTML =
        '<p class="anote-q">' + esc(excerpt(target.text)) + "</p>" +
        '<textarea name="body" placeholder="' + esc(cfg.placeholder || "Ta note…") + '" maxlength="4000" required></textarea>' +
        (cfg.brouillonExtraHtml || "") +
        '<div class="anote-actions"><button type="submit">Valider</button><button type="button" data-anno-cancel>Annuler</button></div>';
      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        submitDraft();
      });
      form.addEventListener("click", function (ev) {
        if (ev.target.closest("[data-anno-cancel]")) cancelDraft();
      });
      form.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape") cancelDraft();
      });
      draft = { slug: slugOf(target.view), sectionId: sectionIdOf(target.section), target: target, el: form };
      renderNotes(draft.slug);
      form.body.focus({ preventScroll: true });
    }

    function cancelDraft() {
      if (!draft) return;
      var d = draft;
      draft = null;
      if (cfg.apresAnnulation) cfg.apresAnnulation(d);
      unwrapMarks(d.target.root, "draft");
      d.el.remove();
      renderNotes(d.slug);
    }

    function submitDraft() {
      var d = draft;
      var form = d.el;
      var body = form.body.value.trim();
      if (!body) return;
      var t = d.target;
      var btn = form.querySelector('[type="submit"]');
      var err = form.querySelector(".cerr");
      if (err) err.remove();
      btn.disabled = true;
      btn.textContent = "Envoi…";
      var donnees = {
        ficheSlug: d.slug,
        sectionId: d.sectionId,
        sectionLabel: sectionLabelOf(t.section),
        body: body,
        quotedText: t.text,
        startOffset: t.start,
        endOffset: t.end,
      };
      if (cfg.champsEnvoi) {
        var extra = cfg.champsEnvoi(form) || {};
        Object.keys(extra).forEach(function (k) { donnees[k] = extra[k]; });
      }
      if (cfg.avantEnvoi && cfg.avantEnvoi(donnees, form, d) === false) {
        btn.disabled = false;
        btn.textContent = "Valider";
        return;
      }
      fetch(cfg.api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(donnees),
      })
        .then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (res) {
            if (r.status === 401 && cfg.erreurSession) throw cfg.erreurSession();
            if (!r.ok) throw new Error(res.error || "Envoi impossible, réessaie.");
            return res;
          });
        })
        .then(function (annot) {
          (annotsBySlug[annot.ficheSlug] = annotsBySlug[annot.ficheSlug] || []).push(annot);
          if (cfg.apresEnvoi) cfg.apresEnvoi(annot);
          // Brouillon abandonné pendant l'envoi : la note est enregistrée, elle s'affichera au prochain chargement.
          if (draft !== d) return;
          Array.prototype.forEach.call(t.root.querySelectorAll('mark.anno-hl[data-anno="draft"]'), function (m) {
            m.classList.remove("pending");
            m.setAttribute("data-anno", annot.id);
          });
          form.remove();
          draft = null;
          if (cfg.notesRepliees) t.section.classList.add("anno-notes-ouvertes");
          renderNotes(annot.ficheSlug);
        })
        .catch(function (e) {
          btn.disabled = false;
          btn.textContent = "Valider";
          var p = document.createElement("p");
          p.className = "cerr";
          if (cfg.remplirErreur) cfg.remplirErreur(p, e, "Envoi impossible, réessaie.");
          else p.textContent = (e && e.message) || "Envoi impossible, réessaie.";
          form.appendChild(p);
          var view = document.querySelector('[data-view="' + d.slug + '"]');
          if (view) layoutNotes(view);
        });
    }

    function anchorAnnotation(a) {
      var section = sectionOf(a.sectionId);
      var root = section && section.querySelector(ANNOT_ROOT);
      if (!root || !a.quotedText) return false;
      var full = root.textContent;
      var start = a.startOffset;
      if (full.slice(start, a.endOffset) !== a.quotedText) {
        start = -1;
        for (var i = full.indexOf(a.quotedText); i >= 0; i = full.indexOf(a.quotedText, i + 1)) {
          if (start < 0 || Math.abs(i - a.startOffset) < Math.abs(start - a.startOffset)) start = i;
        }
        if (start < 0) return false;
      }
      return wrapRange(root, start, start + a.quotedText.length, a.id, "anno-hl").length > 0;
    }

    // Charge les annotations d'une fiche (rechargement : on repart d'un texte
    // sans surlignage, sauf le brouillon en cours). Chaque annotation doit
    // avoir un id ; en lecture seule, ce sont de simples zones sans texte.
    function loadAnnotations(slug, list) {
      var view = document.querySelector('[data-view="' + slug + '"]');
      if (!view) return;
      Array.prototype.forEach.call(view.querySelectorAll('mark.anno-hl:not([data-anno="draft"])'), function (m) {
        if (m.isConnected) unwrapMarks(view, m.getAttribute("data-anno"));
      });
      list.forEach(function (a) {
        a.orphan = !anchorAnnotation(a);
      });
      annotsBySlug[slug] = list;
      if (cfg.ouvrirAnnotees) cfg.ouvrirAnnotees(view);
      renderNotes(slug);
    }

    // --- rendu des notes ---

    function noteEl(a) {
      var el = document.createElement("aside");
      el.className = "anote";
      el.setAttribute("data-anno", a.id);
      el.innerHTML =
        '<div class="anote-h"><b>' + esc(a.authorName || "Anonyme") + "</b><span>" + esc(fmtDate(a.createdAt)) + "</span></div>" +
        '<p class="anote-q">' + esc(excerpt(a.quotedText)) + "</p>" +
        (a.orphan ? '<p class="anote-orphan">Passage introuvable dans cette version de la fiche.</p>' : "") +
        '<p class="anote-b">' + esc(a.body) + "</p>" + (cfg.replyHtml ? cfg.replyHtml(a.ficheSlug, a.id) : "");
      return el;
    }

    // Bulle de marge, SANS chiffre ni compteur : une par section annotée.
    function bulleEl(sectionId) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "anno-bulle";
      b.setAttribute("data-anno-bulle", sectionId);
      b.setAttribute("aria-label", lectureSeule ? "Des adhérents ont réagi à ce passage" : "Voir les annotations de ce passage");
      b.innerHTML =
        '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8">' +
        '<path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3h5.25M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"/></svg>';
      return b;
    }

    function layerOf(view) {
      var layer = view.querySelector(":scope > .anno-layer");
      if (!layer) {
        layer = document.createElement("div");
        layer.className = "anno-layer";
        view.appendChild(layer);
        if (window.ResizeObserver) new ResizeObserver(function () { layoutNotes(view); }).observe(view);
      }
      return layer;
    }

    function inlineOf(section) {
      var box = section.querySelector(":scope > .anno-inline");
      if (!box) {
        box = document.createElement("div");
        box.className = "anno-inline";
        section.querySelector(ANNOT_ROOT).insertAdjacentElement("afterend", box);
      }
      return box;
    }

    function renderNotes(slug) {
      var view = document.querySelector('[data-view="' + slug + '"]');
      if (!view) return;
      var layer = layerOf(view);
      Array.prototype.forEach.call(view.querySelectorAll(".anote:not(.anote-draft), .anno-inline > .anno-add, .anno-bulle"), function (el) { el.remove(); });
      var inMargin = avecMarge();
      var list = annotsBySlug[slug] || [];
      if (cfg.bulles) {
        // Une bulle par section qui porte au moins un passage surligné (jamais de nombre).
        var vues = {};
        list.forEach(function (a) {
          if (vues[a.sectionId]) return;
          var section = sectionOf(a.sectionId);
          if (!section || !view.contains(section)) return;
          vues[a.sectionId] = true;
          section.classList.add("anno-porteuse");
          section.appendChild(bulleEl(a.sectionId));
        });
      }
      if (!lectureSeule && cfg.afficherNotes !== false) {
        list.forEach(function (a) {
          var section = sectionOf(a.sectionId);
          if (!section) return;
          var note = noteEl(a);
          // Notes repliées (fiche publiée) : visibles après un clic sur la bulle ou le passage.
          if (cfg.notesRepliees && !section.classList.contains("anno-notes-ouvertes")) note.hidden = true;
          (inMargin ? layer : inlineOf(section)).appendChild(note);
        });
      }
      if (draft && draft.slug === slug) {
        (inMargin ? layer : inlineOf(draft.target.section)).appendChild(draft.el);
      }
      // Sans survol possible (petit écran, tactile) : pastille « + Note » permanente en fin de section.
      if (!hoverMq.matches && canAnnotate(view)) {
        Array.prototype.forEach.call(view.querySelectorAll("[data-comment-target]"), function (section) {
          if (!section.querySelector(ANNOT_ROOT)) return;
          var add = document.createElement("button");
          add.type = "button";
          add.className = "anno-add";
          add.setAttribute("data-anno-section", sectionIdOf(section));
          add.textContent = "+ Note";
          inlineOf(section).appendChild(add);
        });
      }
      layoutNotes(view);
    }

    // Aligne chaque note de la marge sur son passage, en poussant vers le bas
    // celles qui se chevaucheraient.
    function layoutNotes(view) {
      if (!avecMarge() || view.hidden) return;
      var layer = view.querySelector(":scope > .anno-layer");
      if (!layer) return;
      var top0 = view.getBoundingClientRect().top;
      var items = Array.prototype.map.call(layer.querySelectorAll(":scope > .anote"), function (el) {
        var id = el.classList.contains("anote-draft") ? "draft" : el.getAttribute("data-anno");
        var anchor = view.querySelector('mark.anno-hl[data-anno="' + id + '"]');
        if (!anchor && id !== "draft") {
          var a = (annotsBySlug[slugOf(view)] || []).filter(function (x) { return x.id === id; })[0];
          anchor = a && sectionOf(a.sectionId);
        }
        return { el: el, want: anchor ? anchor.getBoundingClientRect().top - top0 : 0 };
      });
      items.sort(function (a, b) { return a.want - b.want; });
      var bottom = -Infinity;
      items.forEach(function (it) {
        var y = Math.max(it.want, bottom + 8);
        it.el.style.top = y + "px";
        bottom = y + it.el.offsetHeight;
      });
    }

    // --- bouton flottant « ✎ Annoter » sur une sélection ---
    // Il n'apparaît qu'une fois la sélection terminée (bouton de la souris relâché).
    var annotBtn = document.createElement("button");
    annotBtn.type = "button";
    annotBtn.className = "annot-btn";
    annotBtn.textContent = "✎ Annoter";
    annotBtn.hidden = true;
    document.body.appendChild(annotBtn);
    var annotSel = null; // cible calculée au moment de la sélection
    var mouseDown = false;
    var annotPressing = false;

    function hideAnnot() {
      annotBtn.hidden = true;
      annotSel = null;
    }

    function updateAnnot() {
      if (annotPressing || mouseDown) return;
      var target = selectionTarget();
      if (!target) return hideAnnot();
      // Les rectangles vides (bord de ligne ou d'élément) plaçaient le bouton loin du texte : on les ignore.
      var rects = Array.prototype.filter.call(window.getSelection().getRangeAt(0).getClientRects(), function (r) {
        return r.width > 1 && r.height > 1;
      });
      if (!rects.length) return hideAnnot();
      var first = rects[0], last = rects[rects.length - 1];
      var below = first.top < 80 || coarseMq.matches;
      var ref = below ? last : first;
      var x = Math.max(60, Math.min(document.documentElement.clientWidth - 60, ref.left + ref.width / 2));
      annotSel = target;
      annotBtn.classList.toggle("below", below);
      annotBtn.style.left = x + window.scrollX + "px";
      annotBtn.style.top = (below ? ref.bottom + 8 : ref.top - 8) + window.scrollY + "px";
      annotBtn.hidden = false;
    }

    var annotTimer = null;
    function scheduleAnnot(delay) {
      clearTimeout(annotTimer);
      annotTimer = setTimeout(updateAnnot, delay);
    }

    if (!lectureSeule) {
      document.addEventListener("mousedown", function (ev) {
        if (ev.button !== 0 || annotBtn.contains(ev.target) || (ev.target.closest && ev.target.closest(".anno-add"))) return;
        mouseDown = true;
        hideAnnot();
      });
      document.addEventListener("mouseup", function () {
        if (!mouseDown) return;
        mouseDown = false;
        scheduleAnnot(10);
      });
      // Clavier (Maj+flèches), poignées tactiles, double-clic : tout passe par selectionchange.
      document.addEventListener("selectionchange", function () {
        if (!mouseDown) scheduleAnnot(150);
      });
      // Au doigt, toucher le bouton peut vider la sélection avant le clic : on garde la cible.
      annotBtn.addEventListener("pointerdown", function () {
        annotPressing = true;
        setTimeout(function () { annotPressing = false; }, 800);
      });
      annotBtn.addEventListener("mousedown", function (ev) { ev.preventDefault(); });
      annotBtn.addEventListener("click", function () {
        var target = annotSel;
        annotPressing = false;
        if (target) startDraft(target);
      });
    }

    // --- pastille « + Note » au survol d'un paragraphe (écran large, souris, avec marge) ---
    var pastille = document.createElement("button");
    pastille.type = "button";
    pastille.className = "anno-add";
    pastille.textContent = "+ Note";
    pastille.hidden = true;
    var pastillePara = null;
    var lastMove = null;
    var moveQueued = false;

    function hidePastille() {
      pastille.hidden = true;
      pastillePara = null;
    }

    function showPastille(view, para) {
      var layer = layerOf(view);
      if (pastille.parentNode !== layer) layer.appendChild(pastille);
      pastillePara = para;
      pastille.style.top = para.getBoundingClientRect().top - view.getBoundingClientRect().top + "px";
      pastille.hidden = false;
    }

    function paragraphAt(section, y) {
      var root = section.querySelector(ANNOT_ROOT);
      if (!root) return null;
      var best = null, bestH = Infinity;
      paragraphsOf(root).forEach(function (p) {
        var r = p.getBoundingClientRect();
        if (y >= r.top && y <= r.bottom && r.height < bestH) {
          best = p;
          bestH = r.height;
        }
      });
      return best;
    }

    function onHover() {
      moveQueued = false;
      var ev = lastMove;
      if (!avecPastille() || mouseDown || draft) return hidePastille();
      if (pastille.contains(ev.target)) return;
      var view = openView();
      if (!canAnnotate(view)) return hidePastille();
      var t = ev.target;
      var section = t.closest && t.closest("[data-comment-target]");
      if (section && view.contains(section) && !t.closest(".anote, .cthread")) {
        var para = paragraphAt(section, ev.clientY);
        return para ? showPastille(view, para) : hidePastille();
      }
      // Vers la marge : la pastille reste tant qu'on est à hauteur du paragraphe.
      if (pastillePara && ev.clientX > pastillePara.getBoundingClientRect().left) {
        var r = pastillePara.getBoundingClientRect();
        if (ev.clientY >= r.top - 4 && ev.clientY <= r.bottom + 4) return;
      }
      hidePastille();
    }

    if (!lectureSeule) {
      document.addEventListener("mousemove", function (ev) {
        lastMove = ev;
        if (!moveQueued) {
          moveQueued = true;
          requestAnimationFrame(onHover);
        }
      });
      pastille.addEventListener("click", function () {
        if (pastillePara) startDraft(paragraphTarget(pastillePara));
      });
    }

    document.addEventListener("click", function (ev) {
      if (!ev.target.closest) return;
      // Pastilles permanentes (petit écran) : note sur toute la zone de texte de la section.
      var add = ev.target.closest("[data-anno-section]");
      if (add) return startDraft(sectionTarget(sectionOf(add.getAttribute("data-anno-section"))));
      // Clic sur un passage surligné ou sur une bulle de marge.
      var bulle = ev.target.closest("[data-anno-bulle]");
      var mark = !bulle && ev.target.closest("mark.anno-hl:not(.pending)");
      if (!bulle && !mark) return;
      var section = (bulle || mark).closest("[data-comment-target]");
      if (cfg.surClicZone) {
        // Un clic qui termine une sélection de texte n'est pas un clic sur le passage.
        var sel = window.getSelection();
        if (mark && sel && !sel.isCollapsed) return;
        cfg.surClicZone(section, bulle || mark);
        return;
      }
      if (cfg.notesRepliees && section) {
        var ouvert = section.classList.toggle("anno-notes-ouvertes");
        Array.prototype.forEach.call(section.querySelectorAll(".anno-inline > .anote:not(.anote-draft)"), function (n) { n.hidden = !ouvert; });
      }
    });

    // Passage marge ↔ fin de section (ou survol ↔ pastilles permanentes) : on
    // reconstruit les notes ; sinon un simple réalignement suffit.
    function annotMode() {
      return (avecMarge() ? "m" : "i") + (hoverMq.matches ? "h" : "t");
    }
    var lastAnnotMode = annotMode();
    function onViewportChange() {
      hideAnnot();
      var view = openView();
      if (!view) return;
      var mode = annotMode();
      if (mode !== lastAnnotMode) {
        lastAnnotMode = mode;
        hidePastille();
        renderNotes(slugOf(view));
      } else {
        layoutNotes(view);
      }
    }
    window.addEventListener("resize", onViewportChange);
    marginMq.addEventListener("change", onViewportChange);
    hoverMq.addEventListener("change", onViewportChange);
    window.addEventListener("hashchange", function () {
      hideAnnot();
      hidePastille();
      cancelDraft();
    });

    return {
      charger: loadAnnotations,
      afficher: renderNotes,
      masquerBouton: hideAnnot,
      masquerPastille: hidePastille,
      // Note gardée dans le navigateur (visiteur devenu adhérent) : rouverte au
      // même passage s'il existe encore, sinon sur tout le bloc. Vrai si rouverte.
      reprendreBrouillon: function (b) {
        if (!b || typeof b.body !== "string") return false;
        var section = sectionOf(b.sectionId);
        var root = section && section.querySelector(ANNOT_ROOT);
        if (!root) return false;
        var target = null;
        if (b.quotedText) {
          var full = root.textContent;
          var start = full.slice(b.startOffset, b.startOffset + b.quotedText.length) === b.quotedText ? b.startOffset : -1;
          if (start < 0) {
            for (var i = full.indexOf(b.quotedText); i >= 0; i = full.indexOf(b.quotedText, i + 1)) {
              if (start < 0 || Math.abs(i - b.startOffset) < Math.abs(start - b.startOffset)) start = i;
            }
          }
          if (start >= 0) target = makeTarget(root, start, start + b.quotedText.length);
        }
        target = target || sectionTarget(section);
        if (!target) return false;
        startDraft(target);
        if (!draft) return false;
        draft.el.body.value = b.body;
        if (draft.el.credit) draft.el.credit.checked = b.creditAccord === true;
        section.scrollIntoView({ block: "center" });
        return true;
      },
      annulerBrouillon: function (slug) {
        if (draft && (slug == null || draft.slug === slug)) cancelDraft();
      },
    };
  }

  window.ClubAnnotations = { creer: creer };
})();
