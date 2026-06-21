// ============================================================
//  App logic — UI, lock, upload, render, chat. Usa window.Data.
// ============================================================
(function () {
  const C = window.CONFIG || {};
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const esc = (s) => (s + "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const hexA = (h, a) => {
    const n = parseInt(h.slice(1), 16);
    return "rgba(" + (n >> 16 & 255) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + a + ")";
  };
  const euro = (n) => "€ " + (n || 0).toLocaleString("it-IT");

  // ---------- sheets ----------
  const show = (id) => $("#" + id).classList.add("on");
  function closeAll() {
    $$(".sheet").forEach((s) => s.classList.remove("on"));
    pin = ""; paintDots(); setTab("home");
  }
  $$("[data-close]").forEach((el) => el.addEventListener("click", closeAll));

  // ---------- nav ----------
  function setTab(t) {
    $$(".island button").forEach((b) => b.classList.toggle("active", b.dataset.t === t));
  }
  $$(".island button").forEach((b) => b.addEventListener("click", () => {
    const t = b.dataset.t;
    if (t === "docs") { document.querySelectorAll(".sec")[0].scrollIntoView({ behavior: "smooth" }); setTab("docs"); }
    else if (t === "value") { $(".vcard").scrollIntoView({ behavior: "smooth" }); setTab("value"); }
    else if (t === "chat") { openChat(); }
    else { $("#scroll").scrollTo({ top: 0, behavior: "smooth" }); setTab("home"); }
  }));

  // ---------- password lock ----------
  const PW = C.PASSWORD || "XY*362941";
  const SESSION_KEY = "casa_unlocked_" + (C.PROPERTY_ID || "default");
  function isUnlocked() { try { return sessionStorage.getItem(SESSION_KEY) === "1"; } catch (x) { return false; } }
  function hideLock(instant) {
    const ls = $("#lockScreen");
    ls.classList.add("hidden");
    if (instant) ls.style.display = "none";
    else setTimeout(() => { ls.style.display = "none"; }, 340);
  }
  function unlock() {
    const v = $("#pwInput").value;
    const e = $("#pwErr");
    if (v === PW) {
      e.textContent = "";
      try { sessionStorage.setItem(SESSION_KEY, "1"); } catch (x) {}
      hideLock(false);
      window.Data.logAccess("unlock").catch(() => {});
    } else {
      e.textContent = "Password errata. Riprova.";
      const b = $("#pwBox"); b.classList.remove("shake"); void b.offsetWidth; b.classList.add("shake");
    }
  }
  $("#unlockBtn").addEventListener("click", unlock);
  $("#pwInput").addEventListener("keydown", (ev) => { if (ev.key === "Enter") unlock(); });
  $("#pwToggle").addEventListener("click", () => {
    const i = $("#pwInput"); i.type = i.type === "password" ? "text" : "password";
  });

  // ---------- agency documents (static, PIN-gated) ----------
  const PIN_CODE = C.PIN || "0000";
  let pin = "", pinTarget = null;
  function paintDots() {
    const d = $("#dots"); if (!d) return;
    Array.from(d.children).forEach((e, i) => e.classList.toggle("f", i < pin.length));
  }
  $("#keys").addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-k]"); if (!btn) return;
    const k = btn.dataset.k;
    if (k === "del") { pin = pin.slice(0, -1); paintDots(); return; }
    if (pin.length >= 4) return;
    pin += k; paintDots();
    if (pin.length === 4) setTimeout(() => {
      if (pin === PIN_CODE) {
        const t = pinTarget; closeAll();
        if (t) openAgencyDoc(t);
      } else {
        pin = ""; paintDots();
        const d = $("#dots"); d.classList.remove("shake"); void d.offsetWidth; d.classList.add("shake");
      }
    }, 200);
  });

  // icone documenti (per categoria)
  const LOCK_SVG = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" style="vertical-align:-1px"><rect x="5" y="10" width="14" height="10" rx="2" stroke="#b3730a" stroke-width="2"/><path d="M8 10V7a4 4 0 018 0v3" stroke="#b3730a" stroke-width="2"/></svg>';
  const DOC_ICONS = {
    doc:    { c: "#0A84FF", p: '<path d="M7 3h7l5 5v12a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M14 3v5h5"/>' },
    energy: { c: "#FF9F0A", p: '<path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"/>' },
    plan:   { c: "#5E5CE6", p: '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 12h9m0-8v16"/>' },
    wrench: { c: "#34C759", p: '<path d="M14.7 6.3a4 4 0 00-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 005.4-5.4l-2.3 2.3-2-2 2.3-2.3z"/>' }
  };
  const FALLBACK_DOCS = [
    { id: "f1", title: "Atto di compravendita", subtitle: "Rogito notarile, PDF", icon: "doc", locked: false, file_path: null },
    { id: "f2", title: "APE, Classe D", subtitle: "Valido fino al 17/06/2035", icon: "energy", locked: true, file_path: null },
    { id: "f3", title: "Planimetria catastale", subtitle: "Protetto", icon: "plan", locked: true, file_path: null },
    { id: "f4", title: "Libretto impianti", subtitle: "Caldaia, climatizzazione", icon: "wrench", locked: true, file_path: null }
  ];
  let DOCS = [];

  function renderDocuments(docs) {
    $("#docList").innerHTML = docs.map((d) => {
      const ic = DOC_ICONS[d.icon] || DOC_ICONS.doc;
      const right = d.locked
        ? '<span class="lock">' + LOCK_SVG + ' PIN</span>'
        : '<span class="open">Aperto</span>';
      return '<div class="doc" data-docid="' + d.id + '">' +
        '<div class="di" style="background:' + hexA(ic.c, .12) + '">' + iconSvg(ic.c, ic.p, 22) + '</div>' +
        '<div class="dt"><b>' + esc(d.title) + '</b><span>' + esc(d.subtitle || "") + '</span></div>' +
        right + '<span class="chevR">›</span></div>';
    }).join("");
  }
  function openAgencyDoc(d) {
    if (d.file_path) openDocViewer(d.title, d.subtitle || "", { title: d.title, file_path: d.file_path, mime: d.mime });
    else openDocViewer(d.title, d.subtitle || "", null);
  }
  $("#docList").addEventListener("click", (ev) => {
    const row = ev.target.closest(".doc[data-docid]"); if (!row) return;
    const d = DOCS.find((x) => String(x.id) === row.dataset.docid); if (!d) return;
    if (d.locked) { pinTarget = d; pin = ""; paintDots(); $("#pinName").textContent = d.title; show("pinSheet"); }
    else openAgencyDoc(d);
  });
  $("#allDocs").addEventListener("click", (e) => { e.preventDefault(); document.querySelectorAll(".sec")[0].scrollIntoView({ behavior: "smooth" }); });

  // ---------- document viewer ----------
  function openDocViewer(title, meta, item) {
    $("#docTitle").textContent = title;
    $("#docMeta").textContent = meta || "";
    const body = $("#docBody");
    show("docSheet");

    if (item && item.file_path) {
      body.innerHTML = '<span class="stamp"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="vertical-align:-2px"><path d="M5 13l4 4L19 7" stroke="#1c7a3e" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg> Accesso autenticato via NFC</span>';
      const p = document.createElement("p");
      p.style.color = "var(--muted)"; p.textContent = "Caricamento del file in corso…";
      body.appendChild(p);
      window.Data.signedUrl(item.file_path, 300).then((url) => {
        p.remove();
        if (item.mime && item.mime.indexOf("image/") === 0) {
          const img = document.createElement("img");
          img.className = "docimg"; img.src = url; img.alt = item.title;
          body.appendChild(img);
        } else {
          const note = document.createElement("p");
          note.textContent = "Anteprima non disponibile per questo tipo di file.";
          note.style.color = "var(--muted)"; body.appendChild(note);
        }
        const a = document.createElement("a");
        a.className = "dl-btn"; a.href = url; a.target = "_blank"; a.rel = "noopener";
        a.textContent = "Apri / scarica";
        body.appendChild(a);
      }).catch(() => { p.textContent = "Impossibile aprire il file."; });
    } else {
      // nessun file caricato: stato vuoto chiaro
      body.innerHTML =
        '<div class="docempty">' +
        '<svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="#C4CCD8" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h7l5 5v12a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M14 3v5h5"/><path d="M5 4l14 16"/></svg>' +
        '<b>Documento non disponibile</b>' +
        '</div>';
    }
  }

  // ---------- services / cta ----------
  $$("[data-act]").forEach((el) => el.addEventListener("click", () => {
    const act = el.dataset.act;
    if (act === "chat") openChat();
    else if (act === "revalue") { $(".vcard").scrollIntoView({ behavior: "smooth" }); setTab("value"); alert("La stima si basa sui dati OMI della zona (Tuscolano). Aggiornamento automatico."); }
    else if (act === "utilities") openUtilities();
    else if (act === "maintenance") openMaintenance();
    else if (act === "soon") alert("« " + el.dataset.soon + " » — funzione in arrivo in una fase successiva.");
    else if (act === "contact") {
      window.Data.addLead(el.dataset.contact).catch(() => {});
      openContactCard();
    }
  }));

  // ---------- card contatto agenzia ----------
  const AGENT = C.AGENT_NAME || "Simone Marchegiani";
  const PHONE = C.AGENT_PHONE || "+39 334 370 0189";
  const AGENCY = C.AGENCY || "Professione Casa";
  function openContactCard() {
    $("#ccName").textContent = AGENT;
    $("#ccCall").href = "tel:" + PHONE.replace(/\s/g, "");
    $("#ccWa").href = "https://wa.me/" + PHONE.replace(/[^\d]/g, "");
    show("contactSheet");
  }

  // ---------- share ----------
  $("#shareBtn").addEventListener("click", async () => {
    // condivide la PAGINA PUBBLICA (annuncio), non l'hub NFC privato
    const url = new URL("share.html", location.href).href;
    const d = { title: "Monolocale, Roma Tuscolano", text: "Guarda questo immobile", url };
    if (navigator.share) { try { await navigator.share(d); } catch (e) {} }
    else {
      try { await navigator.clipboard.writeText(url); alert("Link dell'annuncio copiato:\n" + url); }
      catch (e) { alert("Link dell'annuncio:\n" + url); }
    }
  });

  // ---------- gallery (mosaico iPhone + galleria piena) ----------
  const hgrid = $("#hgrid");
  const gallery = $("#gallery");
  // foto dell'immobile (asset locali = contenuto "listing")
  const PROP_PHOTOS = [
    { src: "./assets/home/home-2.jpg", label: "Soggiorno" },
    { src: "./assets/home/home-5.jpg", label: "Camera" },
    { src: "./assets/home/home-4.jpg", label: "Cucina" },
    { src: "./assets/home/home-1.jpg", label: "Esterno" }
  ];
  let userPhotos = [];
  const allPhotos = () => PROP_PHOTOS.concat(userPhotos);

  function renderHeroGrid() {
    const ph = allPhotos();
    const cells = ph.slice(0, 3);
    const extra = ph.length - 3;
    hgrid.innerHTML = cells.map((p, i) => {
      const cls = i === 0 ? "big" : "cell";
      const more = (i === 2 && extra > 0) ? '<div class="more">+' + extra + '</div>' : "";
      return '<div class="' + cls + '"><img src="' + p.src + '" alt="' + esc(p.label) + '" loading="lazy">' + more + '</div>';
    }).join("");
  }
  hgrid.addEventListener("click", () => openGallery(0));

  function rebuildDots() {
    const n = gallery.querySelectorAll(".shot").length;
    $("#dotsG").innerHTML = Array.from({ length: n }, (_, i) => '<i' + (i === 0 ? ' class="on"' : '') + '></i>').join("");
  }
  function openGallery(start) {
    const ph = allPhotos();
    gallery.innerHTML = ph.map((p) =>
      '<div class="shot" style="background:#0c1322">' +
      '<img src="' + p.src + '" alt="' + esc(p.label) + '"><div class="scrim"></div></div>'
    ).join("");
    rebuildDots();
    $("#galCount").textContent = ph.length + " foto";
    show("gallerySheet");
    requestAnimationFrame(() => { gallery.scrollLeft = (start || 0) * gallery.clientWidth; });
  }
  gallery.addEventListener("scroll", () => {
    const i = Math.round(gallery.scrollLeft / gallery.clientWidth);
    $$("#dotsG i").forEach((d, k) => d.classList.toggle("on", k === i));
  });

  // ---------- upload types ----------
  const TYPES = [
    { k: "Documento", c: "#0A84FF", svg: '<path d="M7 3h7l5 5v12a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M14 3v5h5"/>' },
    { k: "Foto", c: "#5E5CE6", svg: '<rect x="3" y="6" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M21 18l-5-5-4 4-2-2-4 4"/>' },
    { k: "Nota", c: "#FF9F0A", svg: '<path d="M5 3h9l5 5v13H5z"/><path d="M9 9h5M9 13h6M9 17h4"/>' },
    { k: "Contatto", c: "#1c9b48", svg: '<circle cx="12" cy="8" r="3.4"/><path d="M5.5 20a6.5 6.5 0 0113 0"/>' },
    { k: "Lettura", c: "#FF375F", svg: '<circle cx="12" cy="13" r="7"/><path d="M12 13l3.5-2M12 6V4m-4 2L7 5"/>' },
    { k: "Manutenzione", c: "#0066CC", svg: '<path d="M14.7 6.3a4 4 0 00-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 005.4-5.4l-2.3 2.3-2-2 2.3-2.3z"/>' }
  ];
  let selType = "Documento";
  const iconSvg = (c, p, s) =>
    '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="' + c +
    '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';
  function buildChips() {
    $("#tchips").innerHTML = TYPES.map((t) =>
      '<button data-k="' + t.k + '">' + iconSvg(t.c, t.svg, 15) + t.k + '</button>').join("");
    selectType("Documento");
  }
  function selectType(k) {
    selType = k;
    $$("#tchips button").forEach((b) => b.classList.toggle("sel", b.dataset.k === k));
  }
  $("#tchips").addEventListener("click", (ev) => {
    const b = ev.target.closest("button[data-k]"); if (b) selectType(b.dataset.k);
  });
  $("#addFile").addEventListener("change", () => {
    const f = $("#addFile").files[0];
    $("#fileName").textContent = f ? f.name : "Scegli un file (foto o PDF)";
  });
  function openAdd(preType) {
    if (!window.Data.isConfigured()) { alert("Configura prima Supabase in config.js per salvare i file."); return; }
    $("#addTitle").value = ""; $("#addFile").value = "";
    $("#fileName").textContent = "Scegli un file (foto o PDF)";
    $("#saveState").textContent = ""; $("#saveState").className = "save-state";
    selectType(typeof preType === "string" ? preType : "Documento"); show("addSheet");
  }
  $("#addLink").addEventListener("click", () => openAdd());

  async function saveItem() {
    const title = $("#addTitle").value.trim() || selType;
    const file = $("#addFile").files[0] || null;
    const st = $("#saveState"), btn = $("#saveItem");
    st.className = "save-state"; st.textContent = "Salvataggio in corso…";
    btn.disabled = true;
    try {
      const row = await window.Data.addItem({ type: selType, title, file });
      st.className = "save-state ok"; st.textContent = "Salvato.";
      setTimeout(() => { closeAll(); }, 450);
      await loadItems();
    } catch (e) {
      st.className = "save-state err";
      st.textContent = "Errore: " + (e.message || "salvataggio non riuscito") + ".";
    } finally { btn.disabled = false; }
  }
  $("#saveItem").addEventListener("click", saveItem);

  // ---------- render user items ----------
  function typeMeta(k) { return TYPES.find((t) => t.k === k) || TYPES[0]; }
  const DEL_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13"/></svg>';
  function itemRowHTML(it) {
    const t = typeMeta(it.type);
    const meta = it.type + (it.file_name ? ", " + esc(it.file_name) : "");
    return '<div class="doc" data-id="' + it.id + '">' +
      '<div class="di" style="background:' + hexA(t.c, .12) + '">' + iconSvg(t.c, t.svg, 22) + '</div>' +
      '<div class="dt"><b>' + esc(it.title) + '</b><span>' + meta + '</span></div>' +
      '<button class="del-btn" data-del="' + it.id + '" aria-label="elimina">' + DEL_SVG + '</button>' +
      '<span class="chevR">›</span></div>';
  }
  function renderUtil(items) {
    const readings = items.filter((x) => x.type === "Lettura");
    $("#utilList").innerHTML = readings.length
      ? readings.map(itemRowHTML).join("")
      : '<div class="empty">Nessuna lettura registrata. Aggiungi la lettura di luce o gas (POD/PDR, consumi).</div>';
  }
  async function renderItems(items) {
    $("#myList").innerHTML = items.length
      ? items.map(itemRowHTML).join("")
      : '<div class="empty">Qui puoi caricare garanzie, fatture lavori, foto, note o letture dei contatori.</div>';
    renderUtil(items);
    renderMaint(items);
    // foto utente -> galleria
    userPhotos = [];
    for (const it of items) {
      if (it.type === "Foto" && it.mime && it.mime.indexOf("image/") === 0 && it.file_path) {
        try { const url = await window.Data.signedUrl(it.file_path, 600); if (url) userPhotos.push({ src: url, label: it.title }); } catch (e) { }
      }
    }
    renderHeroGrid();
  }

  async function handleItemClick(ev) {
    const del = ev.target.closest("[data-del]");
    if (del) {
      ev.stopPropagation();
      const it = ITEMS.find((x) => x.id === del.dataset.del); if (!it) return;
      if (!confirm("Eliminare definitivamente “" + it.title + "”? L'operazione non è reversibile.")) return;
      try { await window.Data.deleteItem(it); await loadItems(); }
      catch (e) { alert("Errore durante l'eliminazione: " + (e.message || e)); }
      return;
    }
    const row = ev.target.closest(".doc[data-id]"); if (!row) return;
    const it = ITEMS.find((x) => x.id === row.dataset.id); if (!it) return;
    if (it.file_path) openDocViewer(it.title, it.type, it);
    else openDocViewer(it.title, it.type + " (nota)", null);
  }
  $("#myList").addEventListener("click", handleItemClick);
  $("#utilList").addEventListener("click", handleItemClick);

  // ---------- Luce & Gas ----------
  function openUtilities() { renderUtil(ITEMS); show("utilSheet"); }
  $("#addReading").addEventListener("click", () => { closeAll(); openAdd("Lettura"); });

  // ---------- info immobile ----------
  $("#infoBtn").addEventListener("click", () => show("infoSheet"));

  // ---------- manutenzioni / caldaia ----------
  function renderMaint(items) {
    const m = items.filter((x) => x.type === "Manutenzione");
    $("#maintList").innerHTML = m.length
      ? m.map(itemRowHTML).join("")
      : '<div class="empty">Nessun intervento registrato. Aggiungi una manutenzione (es. revisione caldaia).</div>';
  }
  function openMaintenance() { renderMaint(ITEMS); show("maintSheet"); }
  function openLibretto() {
    const d = DOCS.find((x) => /libretto/i.test(x.title || ""));
    closeAll();
    if (d) openAgencyDoc(d);
    else openDocViewer("Libretto impianti", "Caldaia, climatizzazione", null);
  }
  $("#maintList").addEventListener("click", handleItemClick);
  $("#viewLibretto").addEventListener("click", openLibretto);
  $("#addMaint").addEventListener("click", () => { closeAll(); openAdd("Manutenzione"); });

  // ---------- saluto smart-home ----------
  function setGreeting() {
    const name = C.OWNER_NAME || "Simone";
    $("#ltTitle").textContent = "Ciao " + name + "!";
    $("#ltEy").style.display = "none";
  }

  // ---------- chat (mock, offline) ----------
  function openChat() { setTab("chat"); show("chatSheet"); }
  // chat sheet is built once on init
  function buildChat() {
    if ($("#chatSheet")) return;
    const html =
      '<div class="sheet" id="chatSheet"><div class="mask" data-close></div>' +
      '<div class="panel full"><div class="phead"><div class="pi"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 5h16a2 2 0 012 2v8a2 2 0 01-2 2H9l-5 4v-4H4a2 2 0 01-2-2V7a2 2 0 012-2z" stroke="#0A84FF" stroke-width="1.6"/></svg></div>' +
      '<div><b>Assistente casa</b><span>Conosce i dati del tuo immobile</span></div><button class="x" data-close>×</button></div>' +
      '<div class="pbody" style="flex:1"><div class="msgs" id="msgs"></div></div>' +
      '<div class="cinput"><input id="cin" placeholder="Scrivi un messaggio…"><button id="csend" aria-label="invia"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 19V5m0 0l-6 6m6-6l6 6" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div></div></div>';
    $("#app").insertAdjacentHTML("beforeend", html);
    $$("#chatSheet [data-close]").forEach((el) => el.addEventListener("click", closeAll));
    $("#msgs").innerHTML =
      '<div class="m bot">Ciao, sono l\'assistente di <b>' + esc($("#propTag").textContent) + '</b>. Posso rispondere su documenti, valore, impianti e scadenze.<small>basato sui dati della tua casa</small></div>' +
      '<div class="chips"><button data-q="Quanto vale oggi la casa?">Quanto vale oggi?</button><button data-q="Quando scade l\'APE?">Scadenza APE</button><button data-q="Dove trovo la planimetria?">Planimetria</button></div>';
    $("#msgs").addEventListener("click", (ev) => { const b = ev.target.closest("button[data-q]"); if (b) ask(b.dataset.q); });
    $("#csend").addEventListener("click", send);
    $("#cin").addEventListener("keydown", (ev) => { if (ev.key === "Enter") send(); });
  }
  const A = {
    v: () => "La stima attuale è <b>" + euro(PROP.estimate) + "</b> (intervallo OMI " + euro(PROP.estimate_min) + "–" + euro(PROP.estimate_max) + "), +2,1% su base annua.",
    a: "Il tuo <b>APE è in classe D</b>, valido fino al <b>17/06/2035</b>. Lo trovi tra i Documenti protetti.",
    p: "La <b>planimetria catastale</b> è tra i documenti protetti: tap + PIN per aprirla."
  };
  function addMsg(t, c) {
    const w = $("#msgs"); const d = document.createElement("div");
    d.className = "m " + c; d.innerHTML = t; w.appendChild(d);
    w.parentElement.scrollTop = w.parentElement.scrollHeight;
  }
  function reply(q) {
    q = q.toLowerCase();
    let a = "In produzione passo la domanda al modello con il contesto della casa. Prova: valore, APE o planimetria.";
    if (q.includes("val")) a = A.v();
    else if (q.includes("ape")) a = A.a;
    else if (q.includes("planim")) a = A.p;
    setTimeout(() => addMsg(a + "<small>fonte: dati immobile</small>", "bot"), 430);
  }
  function ask(q) { addMsg(esc(q), "me"); reply(q); }
  function send() { const i = $("#cin"); if (!i.value.trim()) return; ask(i.value.trim()); i.value = ""; }

  // ---------- data load ----------
  let PROP = null, ITEMS = [];
  async function loadDocuments() {
    let docs = [];
    try { docs = await window.Data.listDocuments(); }
    catch (e) { docs = []; }
    if (!docs.length) docs = FALLBACK_DOCS;
    DOCS = docs; renderDocuments(DOCS);
  }
  async function loadItems() {
    try { ITEMS = await window.Data.listItems(); }
    catch (e) { ITEMS = []; }
    await renderItems(ITEMS);
  }
  async function loadProperty() {
    PROP = await window.Data.getProperty();
    $("#propTag").textContent = PROP.address;
    $("#propTitle").textContent = PROP.title;
    $("#propSub").textContent = PROP.sub;
    $("#valBig").textContent = euro(PROP.estimate);
    $("#valRange").textContent = "Intervallo OMI: " + euro(PROP.estimate_min) + " – " + euro(PROP.estimate_max);
  }

  // ---------- init ----------
  async function init() {
    setGreeting();
    renderHeroGrid();
    buildChips();
    buildChat();
    if (!window.Data.isConfigured()) $("#configWarn").hidden = false;
    $("#pwHint").textContent = "Demo: la password è " + PW;

    // flow produzione: se già sbloccato in questa sessione, non richiedere di nuovo
    const already = isUnlocked();
    if (already) hideLock(true);

    await loadProperty();
    await loadDocuments();
    await loadItems();

    if (!already) $("#pwInput").focus();
  }
  document.addEventListener("DOMContentLoaded", init);

  // service worker
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => { }));
  }
})();
