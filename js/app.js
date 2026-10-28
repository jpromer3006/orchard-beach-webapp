/* Orchard Beach concept prototype, v2
   Live data: Open-Meteo (no API key). Marine API for waves and water temperature.
   v2 adds: dark mode, hybrid language menu (custom EN/ES + Google Translate),
   live NYC Parks events via api/events.php with a sample fallback, and shared
   state (window.OB) that the map and the concierge read from. */
(function () {
  "use strict";
  const LAT = 40.8673, LON = -73.7925;
  const t = (k) => window.I18N.t(k);

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));

  const state = {
    flags: [
      { sec: "North Beach", key: "north", state: "green" },
      { sec: "Section 4-6", key: "s46", state: "green" },
      { sec: "Central Beach", key: "central", state: "yellow" },
      { sec: "Section 9-11", key: "s911", state: "green" },
      { sec: "South Beach", key: "south", state: "green" }
    ],
    weather: null
  };
  // Shared bus for map.js and concierge.js
  window.OB = window.OB || {};
  window.OB.state = state;
  window.OB.rerenderHooks = [];

  /* ---------- WMO weather code -> label + icon ---------- */
  const IC = {
    sun: '<svg viewBox="0 0 64 64" width="100%" height="100%"><circle cx="32" cy="32" r="13" fill="#F6C766"/><g stroke="#F6C766" stroke-width="4" stroke-linecap="round"><path d="M32 6v9M32 49v9M6 32h9M49 32h9M13 13l6 6M45 45l6 6M51 13l-6 6M19 45l-6 6"/></g></svg>',
    part: '<svg viewBox="0 0 64 64" width="100%" height="100%"><circle cx="24" cy="24" r="10" fill="#F6C766"/><g stroke="#F6C766" stroke-width="3" stroke-linecap="round"><path d="M24 4v6M24 38v6M4 24h6M38 24h6M10 10l4 4M38 38l4 4M42 10l-4 4"/></g><path d="M26 44a11 11 0 0 1 21-3 8 8 0 0 1-1 16H28a9 9 0 0 1-2-13z" fill="#EAF0EC" stroke="#cdd8cf" stroke-width="1.5"/></svg>',
    cloud: '<svg viewBox="0 0 64 64" width="100%" height="100%"><path d="M20 46a12 12 0 0 1 23-4 9 9 0 0 1-1 18H22a10 10 0 0 1-2-14z" fill="#E7EDE8" stroke="#c6d2c8" stroke-width="2"/></svg>',
    rain: '<svg viewBox="0 0 64 64" width="100%" height="100%"><path d="M20 38a12 12 0 0 1 23-4 9 9 0 0 1-1 18H22a10 10 0 0 1-2-14z" fill="#E7EDE8" stroke="#c6d2c8" stroke-width="2"/><g stroke="#1E6E8C" stroke-width="3" stroke-linecap="round"><path d="M24 54l-2 4M34 54l-2 4M44 54l-2 4"/></g></svg>',
    storm: '<svg viewBox="0 0 64 64" width="100%" height="100%"><path d="M20 36a12 12 0 0 1 23-4 9 9 0 0 1-1 18H22a10 10 0 0 1-2-14z" fill="#D9E2DB" stroke="#b7c4b9" stroke-width="2"/><path d="M34 40l-8 12h7l-3 10 11-15h-7z" fill="#E8A020"/></svg>',
    snow: '<svg viewBox="0 0 64 64" width="100%" height="100%"><path d="M20 38a12 12 0 0 1 23-4 9 9 0 0 1-1 18H22a10 10 0 0 1-2-14z" fill="#E7EDE8" stroke="#c6d2c8" stroke-width="2"/><g fill="#9fb6c9"><circle cx="26" cy="55" r="2"/><circle cx="34" cy="57" r="2"/><circle cx="42" cy="55" r="2"/></g></svg>',
    fog: '<svg viewBox="0 0 64 64" width="100%" height="100%"><g stroke="#b7c4b9" stroke-width="4" stroke-linecap="round"><path d="M14 26h36M10 36h44M16 46h34"/></g></svg>'
  };
  function wx(code) {
    if (code === 0) return { icon: IC.sun, label: { en: "Clear", es: "Despejado" } };
    if (code === 1 || code === 2) return { icon: IC.part, label: { en: "Partly cloudy", es: "Parcialmente nublado" } };
    if (code === 3) return { icon: IC.cloud, label: { en: "Overcast", es: "Nublado" } };
    if (code === 45 || code === 48) return { icon: IC.fog, label: { en: "Fog", es: "Niebla" } };
    if (code >= 51 && code <= 67) return { icon: IC.rain, label: { en: "Drizzle", es: "Llovizna" } };
    if (code >= 71 && code <= 77) return { icon: IC.snow, label: { en: "Snow", es: "Nieve" } };
    if (code >= 80 && code <= 82) return { icon: IC.rain, label: { en: "Rain showers", es: "Chubascos" } };
    if (code >= 85 && code <= 86) return { icon: IC.snow, label: { en: "Snow showers", es: "Nevadas" } };
    if (code >= 95) return { icon: IC.storm, label: { en: "Thunderstorm", es: "Tormenta" } };
    return { icon: IC.cloud, label: { en: "Cloudy", es: "Nublado" } };
  }
  const dirName = (d) => ["N","NE","E","SE","S","SW","W","NW"][Math.round(((d % 360) / 45)) % 8];
  const c2f = (c) => c == null ? null : Math.round(c * 9 / 5 + 32);
  const m2ft = (m) => m == null ? null : Math.round(m * 3.28084 * 10) / 10;
  const hhmm = (iso) => { const dt = new Date(iso); let h = dt.getHours(), m = dt.getMinutes(); const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12; return h + ":" + String(m).padStart(2, "0") + " " + ap; };

  /* ---------- Season / lifeguard status ---------- */
  function seasonStatus() {
    const now = new Date(), m = now.getMonth() + 1, d = now.getDate(), h = now.getHours();
    const inSeason = (m > 5 && m < 9) || (m === 5 && d >= 24) || (m === 9 && d <= 8);
    const guardsOn = inSeason && h >= 10 && h < 18;
    return { inSeason, guardsOn };
  }
  window.OB.seasonStatus = seasonStatus;

  function renderStatusStrip() {
    const s = seasonStatus();
    const bv = $("#beachStatusValue"), gv = $("#guardStatusValue");
    bv.textContent = s.inSeason ? t("inseason_open") : t("offseason");
    bv.className = "pill-value " + (s.inSeason ? "ok" : "warn");
    gv.textContent = s.guardsOn ? t("guard_on") : t("guard_off");
    gv.className = "pill-value " + (s.guardsOn ? "ok" : "warn");
  }

  /* ---------- Weather fetch ---------- */
  async function loadWeather() {
    const upd = $("#updatedText");
    upd.textContent = t("loading");
    const fUrl = "https://api.open-meteo.com/v1/forecast?latitude=" + LAT + "&longitude=" + LON +
      "&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,wind_direction_10m" +
      "&hourly=uv_index&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset" +
      "&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FNew_York&forecast_days=5";
    const mUrl = "https://marine-api.open-meteo.com/v1/marine?latitude=" + LAT + "&longitude=" + LON +
      "&current=wave_height,sea_surface_temperature&timezone=America%2FNew_York";
    try {
      const [fRes, mRes] = await Promise.all([fetch(fUrl), fetch(mUrl).catch(() => null)]);
      const f = await fRes.json();
      const m = mRes ? await mRes.json().catch(() => null) : null;
      state.weather = { f, m };
      renderWeather();
      const now = new Date();
      upd.textContent = (window.I18N.get() === "es" ? "Actualizado " : "Updated ") + hhmm(now.toISOString());
    } catch (e) {
      upd.textContent = window.I18N.get() === "es" ? "Datos no disponibles. Reintenta." : "Live data unavailable. Try refresh.";
    }
  }

  function renderWeather() {
    if (!state.weather) return;
    const { f, m } = state.weather, lang = window.I18N.get();
    const cur = f.current || {};
    const setTxt = (id, v) => { const el = $(id); if (el) el.textContent = (v == null ? "--" : v); };

    setTxt("#tempVal", Math.round(cur.temperature_2m));
    setTxt("#feelsVal", Math.round(cur.apparent_temperature));
    setTxt("#humidVal", Math.round(cur.relative_humidity_2m));
    setTxt("#windVal", Math.round(cur.wind_speed_10m));
    $("#windDir").textContent = dirName(cur.wind_direction_10m) + " " + t("wind");

    const w = wx(cur.weather_code);
    $("#wxIcon").innerHTML = w.icon;
    $("#wxLabel").textContent = w.label[lang] || w.label.en;

    // nav weather chip, always in view (v2.1)
    const nav = $("#navWeather");
    if (nav) {
      $("#nwIcon").innerHTML = w.icon;
      $("#nwTemp").textContent = Math.round(cur.temperature_2m);
      nav.hidden = false;
    }

    // UV from hourly at current hour
    let uv = null;
    try {
      const key = (cur.time || "").slice(0, 13);
      const idx = f.hourly.time.findIndex((x) => x.slice(0, 13) === key);
      uv = idx >= 0 ? f.hourly.uv_index[idx] : Math.max.apply(null, f.hourly.uv_index.slice(0, 12));
    } catch (e) {}
    setTxt("#uvVal", uv == null ? "--" : Math.round(uv));
    const chip = $("#uvChip");
    if (uv != null) {
      const r = Math.round(uv);
      chip.textContent = r <= 2 ? (lang === "es" ? "Bajo" : "Low") : r <= 5 ? (lang === "es" ? "Moderado" : "Moderate") : r <= 7 ? (lang === "es" ? "Alto" : "High") : (lang === "es" ? "Muy alto" : "Very high");
      chip.className = "chip " + (r <= 2 ? "low" : r <= 5 ? "mod" : r <= 7 ? "high" : "veryhigh");
    }

    // marine
    let water = null, wave = null;
    if (m && m.current) { water = c2f(m.current.sea_surface_temperature); wave = m2ft(m.current.wave_height); }
    setTxt("#waterTempVal", water == null ? "--" : water);
    setTxt("#waveVal", wave == null ? "--" : wave);
    setTxt("#nwWater", water == null ? "--" : water);

    // sun times
    try { $("#sunriseVal").textContent = hhmm(f.daily.sunrise[0]); $("#sunsetVal").textContent = hhmm(f.daily.sunset[0]); } catch (e) {}

    renderForecast(f.daily, lang);
  }

  function renderForecast(daily, lang) {
    if (!daily) return;
    const strip = $("#forecastStrip"); strip.innerHTML = "";
    const days = window.I18N.t("days");
    for (let i = 0; i < Math.min(5, daily.time.length); i++) {
      const dt = new Date(daily.time[i] + "T12:00:00");
      const w = wx(daily.weather_code[i]);
      const el = document.createElement("div");
      el.className = "fc-day";
      el.innerHTML = '<div class="fc-name">' + days[dt.getDay()] + '</div>' +
        '<div class="fc-ic">' + w.icon + '</div>' +
        '<div class="fc-temps"><span class="fc-hi">' + Math.round(daily.temperature_2m_max[i]) + '&deg;</span> ' +
        '<span class="fc-lo">' + Math.round(daily.temperature_2m_min[i]) + '&deg;</span></div>';
      strip.appendChild(el);
    }
  }

  /* ---------- Parking today ---------- */
  function renderParking() {
    const day = new Date().getDay(), weekend = day === 0 || day === 6;
    $("#parkingToday").textContent = weekend ? t("today_wknd") : t("today_wkday");
    renderPromo();
  }

  /* ---------- HALF OFF PARKING promo (v2.1) ----------
     Visitors who reserve their day through the trip planner get a demo
     voucher code, shown here and by the concierge, for 50% off parking. */
  const PROMO = {
    codeFor(dateStr) { return "SHORE50-" + String(dateStr || "").replace(/-/g, "").slice(4); },
    get() { try { return JSON.parse(localStorage.getItem("ob-promo") || "null"); } catch (e) { return null; } },
    set(p) { try { localStorage.setItem("ob-promo", JSON.stringify(p)); } catch (e) {} window.OB.promo = p; }
  };
  window.OB.promo = PROMO.get();
  window.OB.claimPromo = function (date, name) {
    const p = { code: PROMO.codeFor(date || new Date().toISOString().slice(0, 10)), date, name };
    PROMO.set(p); renderPromo();
    return p.code;
  };

  function renderPromo() {
    const p = PROMO.get(), box = $("#parkingPromo"), txt = $("#parkingPromoText");
    if (!box || !txt) return;
    if (p && p.code) {
      box.classList.add("claimed");
      txt.innerHTML = t("promo_claimed") + ' <span class="promo-code">' + p.code + "</span><br><small>" + t("promo_note") + "</small>";
    } else {
      box.classList.remove("claimed");
      txt.textContent = t("promo_parking");
    }
  }

  /* ---------- Flags ---------- */
  function stateWord(s) { return s === "green" ? t("st_open") : s === "yellow" ? t("st_caution") : t("st_closed"); }
  function renderFlags() {
    const grid = $("#flagsGrid"); grid.innerHTML = "";
    state.flags.forEach((f) => {
      const el = document.createElement("div");
      el.className = "flag-card " + f.state;
      el.innerHTML = '<div class="flag-sec">' + f.sec + '</div>' +
        '<div class="flag-state"><span class="flag-dot ' + f.state + '"></span>' + stateWord(f.state) + '</div>';
      grid.appendChild(el);
    });
  }

  /* ---------- Vendors (open/closed by current hour) ---------- */
  function renderVendors() {
    const lang = window.I18N.get(), h = new Date().getHours();
    const defs = [
      { en: "Orchard Beach Snack Bar", es: "Snack Bar de Orchard Beach", open: 10, close: 20, desc: { en: "Burgers, hot dogs, fried chicken, fries, wings, slushes.", es: "Hamburguesas, hot dogs, pollo frito, papas, alitas, granizados." } },
      { en: "Boardwalk Ice Cream Cart", es: "Carrito de Helados", open: 11, close: 19, desc: { en: "Soft serve, ice cream, cold drinks along the promenade.", es: "Helado suave, helados y bebidas frías en el paseo." } },
      { en: "The Pavilion Cafe", es: "Café del Pabellón", soon: true, desc: { en: "New pavilion concession opening later this summer.", es: "Nueva concesión que abre a finales del verano." } },
      { en: "Souvenir and Sun Care Cart", es: "Carrito de Souvenirs y Protección Solar", open: 10, close: 18, desc: { en: "Hats, towels, and free SPF 30 sunscreen station nearby.", es: "Sombreros, toallas y estación gratuita de protector SPF 30." } }
    ];
    window.OB.vendors = defs;
    const grid = $("#vendorGrid"); grid.innerHTML = "";
    defs.forEach((d) => {
      let cls, label, hours;
      if (d.soon) { cls = "soon"; label = t("soon"); hours = lang === "es" ? "Próximamente 2026" : "Opening 2026"; }
      else { const isOpen = h >= d.open && h < d.close; cls = isOpen ? "open" : "closed"; label = isOpen ? t("open") : t("closed"); hours = (d.open > 12 ? d.open - 12 : d.open) + " AM - " + (d.close - 12) + " PM"; }
      const card = document.createElement("div");
      card.className = "vendor";
      card.innerHTML = '<div class="vendor-top"><h4>' + (lang === "es" ? d.es : d.en) + '</h4><span class="v-status ' + cls + '">' + label + '</span></div>' +
        '<p>' + (d.desc[lang] || d.desc.en) + '</p>' +
        '<div class="v-hours">' + hours + '</div>';
      grid.appendChild(card);
    });
  }

  /* ---------- Gallery with graceful photo drop-in ---------- */
  function initGallery() {
    const phClasses = ["placeholder", "placeholder p2", "placeholder p3", "placeholder", "placeholder p2"];
    $$("#gallery .shot, .hero-shot").forEach((fig, i) => {
      const src = fig.getAttribute("data-img"), label = fig.getAttribute("data-label");
      const img = new Image();
      img.onload = () => { fig.style.backgroundImage = "url('" + src + "')"; };
      img.onerror = () => {
        fig.className += " " + phClasses[i % phClasses.length];
        const mark = document.createElement("span");
        mark.className = "ph-mark";
        mark.textContent = t("ph_add") + ": " + src.replace("images/", "");
        fig.insertBefore(mark, fig.firstChild);
      };
      img.src = src;
    });
  }

  /* ---------- Live gallery: staff-approved visitor photos (v2.2) ----------
     When staff Approve a submission in the Staff View they assign it one of
     the five gallery spots and a display name. This layer fetches that feed
     and swaps the tiles in: spot 1 is the large feature tile, spots 2-5 the
     small tiles. A spot with several photos cycles as a slideshow (5 max).
     On file:// or when the DB is down the fetch fails silently and the
     original curated photos stay — the gallery never goes blank. */
  const _slideTimers = [];
  function initLiveGallery() {
    fetch("api/gallery.php").then((r) => r.json()).then((j) => {
      if (!j.ok || !j.slots) return;
      const figs = $$("#gallery .shot");            // [0]=feature, [1..4]=tiles
      _slideTimers.forEach(clearInterval); _slideTimers.length = 0;
      Object.entries(j.slots).forEach(([slot, data]) => {
        const fig = figs[+slot - 1];
        if (!fig || !data.images || !data.images.length) return;
        fig.classList.remove("placeholder", "p2", "p3");
        const mark = fig.querySelector(".ph-mark"); if (mark) mark.remove();
        fig.style.backgroundImage = "url('" + data.images[0] + "')";
        const cap = fig.querySelector("figcaption");
        if (cap && data.title) { cap.removeAttribute("data-i18n"); cap.textContent = data.title; }
        if (data.images.length > 1) {               // slideshow
          let i = 0;
          _slideTimers.push(setInterval(() => {
            i = (i + 1) % data.images.length;
            fig.style.backgroundImage = "url('" + data.images[i] + "')";
          }, 4000));
        }
      });
    }).catch(() => {});                             // offline/file:// -> keep defaults
  }

  /* ---------- Fullscreen photo viewer (v2.2) ----------
     Click any location photo (map popup or card) or gallery tile to see it
     full screen. Click anywhere, the X, or press Escape to close. Uses the
     element's background-image so it works for popups Leaflet injects. */
  function showPhotoFull(src, label) {
    if (!src) return;
    const old = document.querySelector(".ob-lightbox"); if (old) old.remove();
    const box = document.createElement("div");
    box.className = "ob-lightbox";
    box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true");
    box.innerHTML = '<button class="ob-lb-close" aria-label="Close">&times;</button>' +
      '<img src="' + src + '" alt="">' +
      (label ? '<div class="ob-lb-cap"></div>' : "");
    if (label) box.querySelector(".ob-lb-cap").textContent = label;
    const close = () => { box.remove(); document.removeEventListener("keydown", esc); };
    const esc = (e) => { if (e.key === "Escape") close(); };
    box.addEventListener("click", close);
    document.addEventListener("keydown", esc);
    document.body.appendChild(box);
  }
  function bgUrl(el) {
    const m = (el.style.backgroundImage || getComputedStyle(el).backgroundImage || "")
      .match(/url\(["']?(.*?)["']?\)/);
    return m ? m[1] : "";
  }
  document.addEventListener("click", (e) => {
    const pop = e.target.closest(".pop-img");                 // map popup photo
    if (pop) { 
      const wrap = pop.closest(".leaflet-popup-content");
      const name = wrap && wrap.querySelector("strong") ? wrap.querySelector("strong").textContent : "";
      showPhotoFull(bgUrl(pop), name); return;
    }
    const media = e.target.closest(".loc-media");             // location card photo
    if (media) {
      e.stopPropagation();                                    // don't also pan the map
      const card = media.closest(".loc-card");
      const name = card && card.querySelector("h4") ? card.querySelector("h4").textContent : "";
      showPhotoFull(bgUrl(media), name); return;
    }
    const shot = e.target.closest("#gallery .shot");          // gallery tile
    if (shot && !shot.classList.contains("placeholder")) {
      const cap = shot.querySelector("figcaption");
      showPhotoFull(bgUrl(shot), cap ? cap.textContent : "");
    }
  }, true);                                                   // capture: beat the card's pan handler

  /* ---------- Staff quick panel ---------- */
  function initStaff() {
    const modal = $("#staffModal");
    const open = () => { renderStaffFlags(); modal.hidden = false; document.body.style.overflow = "hidden"; };
    const close = () => { modal.hidden = true; document.body.style.overflow = ""; };
    $("#openStaff").addEventListener("click", open);
    $("#closeStaff").addEventListener("click", close);
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) close(); });

    $("#postAlert").addEventListener("click", () => {
      const v = $("#alertInput").value.trim(); if (!v) return;
      $("#alertText").textContent = v; $("#alertBanner").hidden = false;
      // best effort persistence to the staff database (ignored if PHP is absent)
      fetch("api/staff_data.php?action=post_alert", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: v })
      }).catch(() => {});
    });
    $("#clearAlert").addEventListener("click", () => { $("#alertBanner").hidden = true; });

    // show a persisted alert if the staff database has one
    fetch("api/staff_data.php?action=active_alert").then(r => r.ok ? r.json() : null).then(j => {
      if (j && j.ok && j.alert) { $("#alertText").textContent = j.alert; $("#alertBanner").hidden = false; }
    }).catch(() => {});
  }
  function renderStaffFlags() {
    const box = $("#staffFlags"); box.innerHTML = "";
    state.flags.forEach((f, idx) => {
      const el = document.createElement("div"); el.className = "sflag";
      el.innerHTML = '<div class="flag-sec">' + f.sec + '</div>' +
        '<div class="sflag-btns">' +
        '<button class="g ' + (f.state === "green" ? "on" : "") + '" data-i="' + idx + '" data-s="green">' + t("open").toUpperCase() + '</button>' +
        '<button class="y ' + (f.state === "yellow" ? "on" : "") + '" data-i="' + idx + '" data-s="yellow">!</button>' +
        '<button class="r ' + (f.state === "red" ? "on" : "") + '" data-i="' + idx + '" data-s="red">' + t("closed").toUpperCase() + '</button>' +
        '</div>';
      box.appendChild(el);
    });
    $$("#staffFlags button").forEach((b) => b.addEventListener("click", () => {
      state.flags[+b.dataset.i].state = b.dataset.s;
      renderStaffFlags(); renderFlags();
      fetch("api/staff_data.php?action=set_flag", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: state.flags[+b.dataset.i].key, state: b.dataset.s })
      }).catch(() => {});
    }));
  }

  /* ---------- Dark mode ---------- */
  function initTheme() {
    const btn = $("#themeBtn");
    const apply = (mode) => {
      document.documentElement.setAttribute("data-theme", mode);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", mode === "dark" ? "#141b16" : "#2C5A3B");
    };
    btn.addEventListener("click", () => {
      const cur = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
      const next = cur === "dark" ? "light" : "dark";
      apply(next);
      try { localStorage.setItem("ob-theme", next); } catch (e) {}
    });
    // follow OS changes live, unless the visitor has chosen explicitly
    if (window.matchMedia) {
      matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
        try { if (localStorage.getItem("ob-theme")) return; } catch (err) {}
        apply(e.matches ? "dark" : "light");
      });
    }
  }

  /* ---------- Hybrid language menu ----------
     EN and ES: instant, hand translated, zero latency (js/i18n.js).
     Everything else: Google Translate, loaded lazily only when the visitor
     first picks one of those languages, so the page never pays the widget
     cost up front. The list below covers the most spoken languages in NYC. */
  const GOOGLE_LANGS = [
    ["zh-CN", "Chinese (Simplified)", "中文"],
    ["fr", "French", "Français"],
    ["ht", "Haitian Creole", "Kreyòl Ayisyen"],
    ["ru", "Russian", "Русский"],
    ["bn", "Bengali", "বাংলা"],
    ["ko", "Korean", "한국어"],
    ["ar", "Arabic", "العربية"],
    ["it", "Italian", "Italiano"],
    ["sq", "Albanian", "Shqip"],
    ["pt", "Portuguese", "Português"],
    ["pl", "Polish", "Polski"],
    ["el", "Greek", "Ελληνικά"],
    ["yi", "Yiddish", "ייִדיש"],
    ["he", "Hebrew", "עברית"],
    ["hi", "Hindi", "हिन्दी"],
    ["ur", "Urdu", "اردو"],
    ["pa", "Punjabi", "ਪੰਜਾਬੀ"],
    ["tl", "Tagalog", "Tagalog"],
    ["vi", "Vietnamese", "Tiếng Việt"],
    ["ja", "Japanese", "日本語"],
    ["de", "German", "Deutsch"],
    ["uk", "Ukrainian", "Українська"],
    ["sw", "Swahili", "Kiswahili"],
    ["wo", "Wolof", "Wolof"]
  ];
  let gtLoaded = false, gtPending = null;

  function loadGoogleTranslate(cb) {
    if (gtLoaded) { cb(); return; }
    window.googleTranslateElementInit = function () {
      new google.translate.TranslateElement({
        pageLanguage: "en",
        includedLanguages: GOOGLE_LANGS.map((l) => l[0]).join(","),
        autoDisplay: false
      }, "google_translate_element");
      gtLoaded = true;
      cb();
    };
    const s = document.createElement("script");
    s.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    s.onerror = () => { alert("Google Translate could not be loaded. Check your connection."); };
    document.head.appendChild(s);
  }

  function setGoogleLang(code) {
    const attempt = (tries) => {
      const combo = document.querySelector("select.goog-te-combo");
      if (combo) {
        combo.value = code;
        combo.dispatchEvent(new Event("change"));
      } else if (tries > 0) {
        setTimeout(() => attempt(tries - 1), 300);
      }
    };
    attempt(20);
  }

  function resetGoogleLang() {
    // return the page to the original English before applying custom i18n
    if (!gtLoaded) return;
    const combo = document.querySelector("select.goog-te-combo");
    if (combo && combo.value) { combo.value = ""; combo.dispatchEvent(new Event("change")); }
    // also clear the googtrans cookie so the choice does not persist
    document.cookie = "googtrans=;path=/;expires=Thu, 01 Jan 1970 00:00:00 UTC";
    document.cookie = "googtrans=;path=/;domain=" + location.hostname + ";expires=Thu, 01 Jan 1970 00:00:00 UTC";
  }

  function rerenderAll() {
    renderStatusStrip(); renderParking(); renderFlags(); renderVendors();
    if (state.weather) renderWeather();
    (window.OB.rerenderHooks || []).forEach((fn) => { try { fn(); } catch (e) {} });
  }
  window.OB.rerenderAll = rerenderAll;

  function initLang() {
    const btn = $("#langBtn"), menu = $("#langMenu"), current = $("#langCurrent");
    const build = () => {
      menu.innerHTML = "";
      const note1 = document.createElement("div"); note1.className = "lm-note"; note1.textContent = "Instant";
      menu.appendChild(note1);
      [["en", "English", "English"], ["es", "Spanish", "Español"]].forEach(([code, name, native]) => {
        const b = document.createElement("button");
        b.innerHTML = "<span>" + name + "</span><span class='lm-native'>" + native + "</span>";
        if (window.I18N.get() === code && !document.body.classList.contains("gt-active")) b.className = "on";
        b.addEventListener("click", () => {
          resetGoogleLang();
          document.body.classList.remove("gt-active");
          window.I18N.set(code);
          current.textContent = code.toUpperCase();
          rerenderAll();
          closeMenu();
        });
        menu.appendChild(b);
      });
      const note2 = document.createElement("div"); note2.className = "lm-note"; note2.textContent = "Google Translate";
      menu.appendChild(note2);
      GOOGLE_LANGS.forEach(([code, name, native]) => {
        const b = document.createElement("button");
        b.innerHTML = "<span>" + name + "</span><span class='lm-native'>" + native + "</span>";
        b.addEventListener("click", () => {
          // Google translates best from the English source text
          window.I18N.set("en"); rerenderAll();
          document.body.classList.add("gt-active");
          current.textContent = code.split("-")[0].toUpperCase();
          loadGoogleTranslate(() => setGoogleLang(code));
          closeMenu();
        });
        menu.appendChild(b);
      });
    };
    const openMenu = () => { build(); menu.hidden = false; btn.setAttribute("aria-expanded", "true"); };
    const closeMenu = () => { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); };
    btn.addEventListener("click", () => { menu.hidden ? openMenu() : closeMenu(); });
    document.addEventListener("click", (e) => { if (!menu.hidden && !e.target.closest(".lang-wrap")) closeMenu(); });
    current.textContent = window.I18N.get().toUpperCase();
  }

  /* ---------- Accessibility: font size, TTS ---------- */
  function initA11y() {
    const sizes = [1, 1.12, 1.28]; let si = 0;
    $("#fontBtn").addEventListener("click", () => {
      si = (si + 1) % sizes.length;
      document.documentElement.style.setProperty("--fs", sizes[si]);
      $("#fontBtn").classList.toggle("active", si !== 0);
    });

    $("#ttsBtn").addEventListener("click", () => {
      if (!("speechSynthesis" in window)) return;
      if (speechSynthesis.speaking) { speechSynthesis.cancel(); $("#ttsBtn").classList.remove("active"); return; }
      const g = (id) => { const el = $(id); return el ? el.textContent : "--"; };
      let s = t("read_summary")
        .replace("$temp", g("#tempVal")).replace("$feels", g("#feelsVal"))
        .replace("$water", g("#waterTempVal")).replace("$wave", g("#waveVal"))
        .replace("$wind", g("#windVal")).replace("$uv", g("#uvVal"));
      const u = new SpeechSynthesisUtterance(s);
      u.lang = window.I18N.get() === "es" ? "es-US" : "en-US";
      u.onend = () => $("#ttsBtn").classList.remove("active");
      $("#ttsBtn").classList.add("active");
      speechSynthesis.speak(u);
    });
  }

  /* ---------- Ask form (kept from v1) ---------- */
  function initForm() {
    const form = $("#askForm"), status = $("#formStatus");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = $("#qName").value.trim(), email = $("#qEmail").value.trim(), msg = $("#qMsg").value.trim();
      const okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!name || !okEmail || !msg) { status.className = "form-status err"; status.textContent = t("sent_err"); return; }
      status.className = "form-status"; status.textContent = "...";
      try {
        const r = await fetch("submit.php", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, topic: $("#qTopic").value, message: msg })
        });
        if (r.ok) { const j = await r.json().catch(() => ({})); status.className = "form-status ok"; status.textContent = j.message || t("sent_ok"); form.reset(); return; }
        throw new Error("no handler");
      } catch (err) {
        status.className = "form-status ok"; status.textContent = t("sent_ok"); form.reset();
      }
    });
  }

  /* ---------- Trip plan form (v2): captures visitor email + plan ---------- */
  function initPlanForm() {
    const form = $("#planForm"), status = $("#planStatus");
    // clear any stale validation message as soon as the visitor edits the form
    form.addEventListener("input", () => { status.textContent = ""; status.className = "form-status"; });
    // default the date to today
    try { $("#pDate").value = new Date().toISOString().slice(0, 10); } catch (e) {}
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = $("#pName").value.trim(), email = $("#pEmail").value.trim(), date = $("#pDate").value;
      const okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!name || !okEmail || !date) { status.className = "form-status err"; status.textContent = t("plan_err"); return; }
      const interests = $$("#interestChips input:checked").map((i) => i.value);
      const plan = {
        name, email, visit_date: date,
        start_time: $("#pStart").value,
        party_size: parseInt($("#pParty").value, 10) || 2,
        arrival_mode: $("#pArrive").value,
        duration: parseInt($("#pDur").value, 10),
        interests
      };
      // reservation made: issue the half off parking voucher (demo)
      PROMO.set({ code: PROMO.codeFor(date), date, name });
      renderPromo();
      status.className = "form-status ok";
      status.innerHTML = t("plan_ok") + " " + t("promo_claimed") + ' <span class="promo-code">' + PROMO.codeFor(date) + "</span>";
      // save the visitor + plan (best effort; the concierge works either way)
      fetch("api/subscribe.php", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(plan)
      }).catch(() => {});
      // hand off to the concierge to build and show the itinerary
      if (window.OB.concierge) window.OB.concierge.buildFromPlan(plan);
    });
  }

  /* ---------- Share your photos (v2.1): staff reviewed submissions ---------- */
  function initShareForm() {
    const form = $("#shareForm"); if (!form) return;
    const status = $("#shareStatus");
    form.addEventListener("input", () => { status.textContent = ""; status.className = "form-status"; });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = $("#sFile").files[0];
      const okType = f && ["image/jpeg", "image/png", "image/webp", "application/pdf"].indexOf(f.type) >= 0;
      if (!f || !okType || f.size > 10 * 1024 * 1024 || !$("#sConsent").checked) {
        status.className = "form-status err"; status.textContent = t("up_err"); return;
      }
      if (location.protocol === "file:") {
        status.className = "form-status err"; status.textContent = t("up_server"); return;
      }
      status.className = "form-status"; status.textContent = "...";
      const fd = new FormData();
      fd.append("file", f);
      fd.append("caption", $("#sCaption").value.trim());
      fd.append("name", $("#sName").value.trim());
      fd.append("email", $("#sEmail").value.trim());
      try {
        const r = await fetch("api/upload.php", { method: "POST", body: fd });
        const j = await r.json();
        if (j && j.ok) { status.className = "form-status ok"; status.textContent = t("up_ok"); form.reset(); return; }
        throw new Error((j && j.error) || "upload failed");
      } catch (err) {
        status.className = "form-status err"; status.textContent = t("up_server");
      }
    });
  }

  /* ---------- Nav scrollspy (v2.1): highlight the section in view ---------- */
  function initScrollspy() {
    const links = $$(".main-nav a");
    const byId = {};
    links.forEach((a) => {
      const id = (a.getAttribute("href") || "").slice(1);
      const sec = document.getElementById(id);
      if (sec) byId[id] = a;
    });
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((ents) => {
      ents.forEach((en) => {
        if (!en.isIntersecting) return;
        links.forEach((l) => l.classList.remove("active"));
        const a = byId[en.target.id];
        if (a) a.classList.add("active");
      });
    }, { rootMargin: "-30% 0px -60% 0px" });
    Object.keys(byId).forEach((id) => io.observe(document.getElementById(id)));
  }

  /* ---------- Scroll reveal + header shadow ---------- */
  function initReveal() {
    $$(".section, .hero-content").forEach((el) => el.classList.add("reveal"));
    if (!("IntersectionObserver" in window)) { $$(".reveal").forEach((el) => el.classList.add("in")); return; }
    const io = new IntersectionObserver((ents) => {
      ents.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { threshold: 0.12 });
    $$(".reveal").forEach((el) => io.observe(el));
  }

  /* ---------- Init ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    window.I18N.apply();
    renderStatusStrip();
    renderParking();
    renderFlags();
    renderVendors();
    initGallery();
    initLiveGallery();
    initStaff();
    initTheme();
    initLang();
    initA11y();
    initForm();
    initPlanForm();
    initShareForm();
    initScrollspy();
    initReveal();
    loadWeather();
    $("#refreshBtn").addEventListener("click", loadWeather);
    // refresh live data every 10 minutes
    setInterval(loadWeather, 600000);
    setInterval(renderStatusStrip, 60000);
  });
})();
