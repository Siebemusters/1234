// Frontend — vanilla JS SPA. Geen framework, geen build. Praat met de backend
// via /api en rendert. Alle door de gebruiker ingevoerde tekst gaat via
// textContent (geen innerHTML-interpolatie) → geen XSS.

// ---------- kleine DOM-helper ----------
function h(tag, props = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k === "html") el.innerHTML = v; // alleen voor eigen, veilige markup
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, "");
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

// ---------- formatting ----------
const eur = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const eur2 = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });

const STATUS_COLORS = {
  "Nieuw": "#E4D3B8", "In gesprek": "#CBB088", "Voorstel": "#B8925A",
  "Gewonnen": "#8C7A3E", "Verloren": "#A89C8A",
};
const AVATAR_COLORS = ["#B8925A", "#8C7A3E", "#A2745A", "#7C8A5A", "#5A7C8A", "#8A5A7C"];

// ---------- state ----------
let state = { customers: [], quotes: [], stats: null, statuses: [] };
let currentView = "dashboard";

// ---------- API ----------
async function api(method, path, body) {
  const res = await fetch("/api" + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Serverfout");
  return data;
}
async function loadState() {
  const [s, meta] = await Promise.all([api("GET", "/state"), api("GET", "/meta")]);
  state = { ...s, statuses: meta.statuses };
}
// mutaties geven de volledige nieuwe state terug
function applyState(s) { state = { ...state, ...s }; }

// ---------- logo ----------
function getDomain(website) {
  if (!website) return "";
  return website.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0];
}
function logoUrl(website) {
  const d = getDomain(website);
  if (!d) return "";
  // Standaard: favicon (gratis, geen key). Voor echte logo's: zet in de
  // console window.LOGO_DEV_TOKEN = "..." en dit schakelt over naar logo.dev.
  if (window.LOGO_DEV_TOKEN) return `https://img.logo.dev/${d}?token=${window.LOGO_DEV_TOKEN}&size=128`;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=128`;
}
function initials(name) {
  const parts = (name || "?").trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0] || "").join("").toUpperCase() || "?";
}
function colorFor(name) {
  let hash = 0;
  for (const ch of name || "") hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
function avatar(customer, size = "") {
  const el = h("div", { class: "avatar" + (size ? " " + size : "") });
  el.style.background = colorFor(customer.name);
  el.textContent = initials(customer.name);
  const url = logoUrl(customer.website);
  if (url) {
    const img = h("img", { alt: "" });
    img.addEventListener("load", () => { el.textContent = ""; el.append(img); });
    img.addEventListener("error", () => {}); // val terug op initialen (al gezet)
    img.src = url;
  }
  return el;
}

// ---------- helpers ----------
function quotesFor(customerId) { return state.quotes.filter((q) => q.customerId === customerId); }
function customerValue(customerId) {
  return quotesFor(customerId).reduce((s, q) => s + (Number(q.value) || 0), 0);
}
function wonValue(customerId) {
  return quotesFor(customerId).filter((q) => q.status === "Gewonnen").reduce((s, q) => s + (Number(q.value) || 0), 0);
}

function toast(msg, isErr = false) {
  const t = h("div", { class: "toast" + (isErr ? " err" : ""), text: msg });
  document.getElementById("toasts").append(t);
  setTimeout(() => t.remove(), 2600);
}

// ---------- views ----------
function renderDashboard() {
  const s = state.stats;
  const content = document.getElementById("content");
  content.innerHTML = "";

  const metric = (label, value, sub) =>
    h("div", { class: "metric" }, [
      h("div", { class: "label", text: label }),
      h("div", { class: "value", text: value }),
      h("div", { class: "sub", text: sub }),
    ]);

  content.append(
    h("div", { class: "fade-in" }, [
      h("h2", { class: "view-title", text: "Dashboard" }),
      h("div", { class: "metrics" }, [
        metric("Totale omzet", eur.format(s.revenue), "gewonnen offertes"),
        metric("Conversie", Math.round(s.conversion) + "%", "gewonnen ÷ totaal offertes"),
        metric("€ per klant", eur.format(s.valuePerCustomer), "omzet ÷ aantal klanten"),
      ]),
      h("div", { class: "metrics", style: "margin-top:14px" }, [
        metric("Open offertes", String(s.openCount), eur.format(s.openValue) + " open"),
        metric("Gesloten offertes", String(s.closedCount), "gewonnen + verloren"),
        metric("Klanten", String(s.customerCount), s.totalQuotes + (s.totalQuotes === 1 ? " offerte" : " offertes")),
      ]),
      renderStatusPanel(s),
    ])
  );
}

function renderStatusPanel(s) {
  const maxVal = Math.max(0, ...state.statuses.map((st) => s.perStatus[st].value));
  const rows = state.statuses.map((st) => {
    const cell = s.perStatus[st];
    const pct = maxVal > 0 ? (cell.value / maxVal) * 100 : 0;
    const fill = h("div", { class: "bar-fill" });
    fill.style.width = pct + "%";
    fill.style.background = STATUS_COLORS[st];
    const dot = h("span", { class: "dot" });
    dot.style.background = STATUS_COLORS[st];
    return h("div", { class: "status-row" }, [
      h("div", { class: "status-name" }, [dot, st]),
      h("div", { class: "bar-track" }, [fill]),
      h("div", { class: "status-meta" }, [h("strong", { text: eur.format(cell.value) }), " · " + cell.count + "x"]),
    ]);
  });
  return h("div", { class: "panel" }, [h("h3", { text: "Waarde per status" }), ...rows]);
}

function renderCustomers() {
  const content = document.getElementById("content");
  content.innerHTML = "";
  const wrap = h("div", { class: "fade-in" }, [h("h2", { class: "view-title", text: "Klanten" })]);

  if (state.customers.length === 0) {
    wrap.append(h("div", { class: "empty" }, [
      h("p", { text: "Nog geen klanten." }),
      h("button", { class: "btn-primary", onclick: () => openCustomerSheet(null) }, "+ Eerste klant toevoegen"),
    ]));
    content.append(wrap);
    return;
  }

  const grid = h("div", { class: "grid" });
  for (const c of state.customers) {
    const stat = (n, l) => h("div", { class: "card-stat" }, [h("div", { class: "n", text: n }), h("div", { class: "l", text: l })]);
    grid.append(
      h("button", { class: "card", onclick: () => openCustomerSheet(c.id) }, [
        h("div", { class: "card-head" }, [
          avatar(c),
          h("div", {}, [
            h("div", { class: "card-name", text: c.name }),
            c.website ? h("div", { class: "card-web", text: getDomain(c.website) }) : null,
          ]),
        ]),
        h("div", { class: "card-stats" }, [
          stat(String(quotesFor(c.id).length), "offertes"),
          stat(eur.format(customerValue(c.id)), "totaal"),
          stat(eur.format(wonValue(c.id)), "gewonnen"),
        ]),
      ])
    );
  }
  wrap.append(grid);
  content.append(wrap);
}

function render() {
  document.querySelectorAll(".seg").forEach((b) => b.classList.toggle("active", b.dataset.view === currentView));
  if (currentView === "dashboard") renderDashboard();
  else renderCustomers();
}

// ---------- sheet (create/edit klant + offertes) ----------
function openSheet(node) {
  const sheet = document.getElementById("sheet");
  sheet.innerHTML = "";
  sheet.append(node);
  document.getElementById("scrim").hidden = false;
}
function closeSheet() { document.getElementById("scrim").hidden = true; }

function fieldInput(label, id, value, opts = {}) {
  const input = h(opts.textarea ? "textarea" : "input", { id, value: value || "" });
  if (opts.type) input.type = opts.type;
  if (opts.placeholder) input.placeholder = opts.placeholder;
  return h("div", { class: "field" }, [h("label", { for: id, text: label }), input]);
}

function openCustomerSheet(customerId) {
  const isNew = !customerId;
  const c = isNew ? { name: "", website: "", email: "", phone: "", notes: "" } : state.customers.find((x) => x.id === customerId);
  if (!c) return;

  const head = h("div", { class: "sheet-head" }, [
    avatar(c, "lg"),
    h("div", { class: "title", text: isNew ? "Nieuwe klant" : c.name }),
    h("button", { class: "sheet-close", text: "×", onclick: closeSheet, "aria-label": "Sluiten" }),
  ]);

  const errBox = h("div", { class: "field-err" });

  const nameField = fieldInput("Naam *", "f-name", c.name, { placeholder: "bv. De Vries Studio" });
  const websiteField = fieldInput("Website", "f-website", c.website, { placeholder: "bv. devries.nl" });
  const emailField = fieldInput("E-mail", "f-email", c.email, { type: "email", placeholder: "naam@bedrijf.nl" });
  const phoneField = fieldInput("Telefoon", "f-phone", c.phone, { placeholder: "06 12345678" });
  const notesField = fieldInput("Notities", "f-notes", c.notes, { textarea: true, placeholder: "Context over deze klant…" });

  // live logo-preview bij website-invoer
  const preview = h("div", { class: "logo-preview" }, [avatar(c), h("div", { class: "hint", text: "Logo wordt automatisch opgehaald uit de website." })]);
  const refreshPreview = () => {
    const tmp = { name: document.getElementById("f-name").value, website: document.getElementById("f-website").value };
    preview.replaceChild(avatar(tmp), preview.firstChild);
  };
  websiteField.querySelector("input").addEventListener("input", debounce(refreshPreview, 350));
  nameField.querySelector("input").addEventListener("input", debounce(refreshPreview, 350));

  function collect() {
    return {
      name: document.getElementById("f-name").value.trim(),
      website: document.getElementById("f-website").value.trim(),
      email: document.getElementById("f-email").value.trim(),
      phone: document.getElementById("f-phone").value.trim(),
      notes: document.getElementById("f-notes").value.trim(),
    };
  }

  async function save() {
    errBox.textContent = "";
    try {
      if (isNew) {
        const s = await api("POST", "/customers", collect());
        applyState(s);
        // heropen in edit-modus zodat offertes toegevoegd kunnen worden
        const created = state.customers[state.customers.length - 1];
        toast("Klant aangemaakt");
        render();
        openCustomerSheet(created.id);
      } else {
        const s = await api("PATCH", "/customers/" + customerId, collect());
        applyState(s);
        toast("Opgeslagen");
        render();
        closeSheet();
      }
    } catch (e) { errBox.textContent = e.message; }
  }

  async function removeCustomer() {
    const n = quotesFor(customerId).length;
    const msg = n > 0 ? `Deze klant heeft ${n} offerte(s). Klant én offertes verwijderen?` : "Deze klant verwijderen?";
    if (!confirm(msg)) return;
    try {
      applyState(await api("DELETE", "/customers/" + customerId));
      toast("Klant verwijderd");
      render();
      closeSheet();
    } catch (e) { toast(e.message, true); }
  }

  const body = h("div", {}, [
    preview,
    nameField,
    websiteField,
    h("div", { class: "row" }, [emailField, phoneField]),
    notesField,
    errBox,
  ]);

  // Offertes-sectie (alleen bij bestaande klant)
  if (!isNew) {
    body.append(h("div", { class: "section-label", text: "Offertes" }));
    body.append(renderQuotes(customerId));
    body.append(renderAddQuote(customerId));
  }

  const actions = h("div", { class: "sheet-actions" }, [
    h("button", { class: "btn-primary", onclick: save, text: isNew ? "Klant aanmaken" : "Opslaan" }),
    h("div", { class: "spacer" }),
    !isNew ? h("button", { class: "btn-danger", onclick: removeCustomer, text: "Verwijder klant" }) : null,
  ]);

  openSheet(h("div", {}, [head, body, actions]));
}

function renderQuotes(customerId) {
  const list = h("div", {});
  const quotes = quotesFor(customerId);
  if (quotes.length === 0) {
    list.append(h("div", { class: "empty", style: "padding:16px", text: "Nog geen offertes voor deze klant." }));
    return list;
  }
  for (const q of quotes) {
    const valueInput = h("input", { type: "number", min: "0", step: "0.01", value: q.value });
    valueInput.addEventListener("change", async () => {
      try { applyState(await api("PATCH", "/quotes/" + q.id, { value: parseFloat(valueInput.value) || 0 })); toast("Bijgewerkt"); render(); refreshSheet(customerId); }
      catch (e) { toast(e.message, true); }
    });
    const statusSelect = h("select", {}, state.statuses.map((st) => h("option", { value: st, ...(st === q.status ? { selected: true } : {}) }, st)));
    statusSelect.addEventListener("change", async () => {
      try { applyState(await api("PATCH", "/quotes/" + q.id, { status: statusSelect.value })); toast("Status bijgewerkt"); render(); refreshSheet(customerId); }
      catch (e) { toast(e.message, true); }
    });
    const del = h("button", { class: "icon-btn", text: "verwijder", onclick: async () => {
      if (!confirm("Deze offerte verwijderen?")) return;
      try { applyState(await api("DELETE", "/quotes/" + q.id)); toast("Offerte verwijderd"); render(); refreshSheet(customerId); }
      catch (e) { toast(e.message, true); }
    }});
    list.append(h("div", { class: "quote" }, [
      h("div", { class: "q-title" }, [q.title || "Offerte", h("small", { text: new Date(q.createdAt).toLocaleDateString("nl-NL") })]),
      valueInput, statusSelect, del,
    ]));
  }
  return list;
}

function renderAddQuote(customerId) {
  const title = h("input", { placeholder: "Titel (bv. Website redesign)" });
  const value = h("input", { type: "number", min: "0", step: "0.01", placeholder: "Waarde €" });
  const status = h("select", {}, state.statuses.map((st) => h("option", { value: st }, st)));
  const err = h("div", { class: "field-err" });
  const add = h("button", { class: "btn-ghost", text: "+ Offerte toevoegen", onclick: async () => {
    err.textContent = "";
    const v = parseFloat(value.value);
    if (value.value === "" || !Number.isFinite(v) || v < 0) { err.textContent = "Vul een geldige waarde in."; return; }
    try {
      applyState(await api("POST", "/quotes", { customerId, title: title.value.trim(), value: v, status: status.value }));
      toast("Offerte toegevoegd");
      render();
      refreshSheet(customerId);
    } catch (e) { err.textContent = e.message; }
  }});
  return h("div", { style: "margin-top:12px" }, [
    h("div", { class: "row" }, [
      h("div", { class: "field", style: "flex:2" }, [title]),
      h("div", { class: "field" }, [value]),
      h("div", { class: "field" }, [status]),
    ]),
    err, add,
  ]);
}

// Herteken de open sheet (na een offerte-mutatie) zonder 'm te sluiten.
function refreshSheet(customerId) {
  if (!document.getElementById("scrim").hidden) openCustomerSheet(customerId);
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

// ---------- init ----------
function bindChrome() {
  document.getElementById("segmented").addEventListener("click", (e) => {
    const b = e.target.closest(".seg");
    if (!b) return;
    currentView = b.dataset.view;
    render();
  });
  document.getElementById("newCustomerBtn").addEventListener("click", () => openCustomerSheet(null));
  document.getElementById("scrim").addEventListener("click", (e) => { if (e.target.id === "scrim") closeSheet(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });
}

async function init() {
  bindChrome();
  try {
    await loadState();
    render();
  } catch (e) {
    document.getElementById("content").innerHTML = "";
    document.getElementById("content").append(
      h("div", { class: "empty" }, [h("p", { text: "Kon data niet laden: " + e.message }), h("button", { class: "btn-ghost", text: "Opnieuw", onclick: init })])
    );
  }
}

init();
