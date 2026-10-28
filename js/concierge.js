/* Beach Concierge, v2: the AI trip planner for Orchard Beach.
   Two engines, one experience:
   1. Local knowledge engine (always available): intent matching over the same
      locations database the map uses, plus live weather, vendors, parking,
      rules, and events already loaded on the page. Runs with zero setup.
   2. Optional Claude API (api/chatbot.php): if the site owner adds an
      Anthropic API key in api/config.php, free text questions are answered by
      a real model grounded in the same database. The concierge checks once at
      startup and upgrades itself automatically.
   The itinerary feature maps the day out from the Parking Lot or the Bx12 bus
   stop across the 115 acre, 1.1 mile crescent: promenade, central pavilion,
   snack bars, food and souvenir carts, two playgrounds, two picnic areas, the
   26 courts, changing areas and showers, and the nature trails. Three sizes:
   Rare (2 hours), Medium Rare (4 hours), Well Done (6 hours). */
(function () {
  "use strict";
  const t = (k) => window.I18N.t(k);
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));

  let aiMode = false;          // upgraded if api/chatbot.php reports a key
  let locations = [];          // filled from map.js (database or fallback)
  let itinerary = null;        // last built itinerary
  let visitor = null;          // last plan form data
  let slideIndex = 0, slideTimer = null;

  /* ============ Panel plumbing ============ */
  function openPanel() { $("#conciergePanel").hidden = false; $("#ccText").focus(); }
  function closePanel() { $("#conciergePanel").hidden = true; }

  function say(text, opts) {
    const log = $("#ccLog");
    const el = document.createElement("div");
    el.className = "cc-msg bot";
    el.innerHTML = text;
    if (opts && opts.img) {
      const th = document.createElement("span");
      th.className = "cc-thumb";
      th.style.backgroundImage = "url('" + opts.img + "')";
      el.appendChild(th);
    }
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  }
  function sayUser(text) {
    const log = $("#ccLog");
    const el = document.createElement("div");
    el.className = "cc-msg user";
    el.textContent = text;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  }
  function typing(on) {
    let el = $("#ccTyping");
    if (on) {
      if (el) return;
      el = document.createElement("div");
      el.className = "cc-typing"; el.id = "ccTyping";
      el.innerHTML = "<span></span><span></span><span></span>";
      $("#ccLog").appendChild(el);
      $("#ccLog").scrollTop = $("#ccLog").scrollHeight;
    } else if (el) el.remove();
  }

  function esc(s) { return String(s).replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  /* ============ Local knowledge engine ============ */
  function weatherAnswer() {
    const w = window.OB.state && window.OB.state.weather;
    if (!w || !w.f || !w.f.current) return "I am still loading the live weather. Scroll to the Conditions section, or try again in a moment.";
    const c = w.f.current;
    const water = $("#waterTempVal") ? $("#waterTempVal").textContent : "--";
    const uv = $("#uvVal") ? $("#uvVal").textContent : "--";
    return "Right now at the beach: " + Math.round(c.temperature_2m) + "°F, feels like " +
      Math.round(c.apparent_temperature) + "°F. Water is about " + water + "°F, wind " +
      Math.round(c.wind_speed_10m) + " mph, UV index " + uv + ". Live data is in the Conditions section.";
  }
  function parkingAnswer() {
    const wknd = [0, 6].indexOf(new Date().getDay()) >= 0;
    return "The main lot is off Park Drive, Bronx, NY 10464. Today cars are " + (wknd ? "$12.00 (weekend rate)" : "$10.00 (weekday rate)") +
      ". Buses and commercial are $15. Seniors 65+ pay $6 on weekdays. There is also the Bx12 bus on summer weekends from the Pelham Bay Park 6 train station.\n" + promoAnswer();
  }
  function foodAnswer() {
    const h = new Date().getHours();
    const snack = h >= 10 && h < 20 ? "open now (10 AM to 8 PM)" : "closed right now (opens 10 AM)";
    return "The Snack Bar at the pavilion plaza is " + snack + ": burgers, hot dogs, fried chicken, slushes. Ice cream and drink carts run along the promenade, and a souvenir cart has hats, towels, and a free SPF 30 sunscreen station. The full Pavilion Cafe opens later this summer.";
  }
  function rulesAnswer() {
    return "The big ones: swim only when lifeguards are on duty (10 AM to 6 PM in season), no alcohol or glass, no pets on the sand, barbecue only in the designated picnic areas, and carry out your trash. Full official rules: " +
      '<a href="https://www.nycgovparks.org/rules/orchard-beach" target="_blank" rel="noopener">nycgovparks.org/rules/orchard-beach</a>';
  }
  function eventsAnswer() {
    const evs = window.OB.liveEvents;
    if (evs && evs.length) {
      let out = "Coming up at the park (live from NYC Parks):\n";
      evs.slice(0, 4).forEach((e) => { out += "• " + e.date + ": " + esc(e.title) + "\n"; });
      return out + 'More: <a href="https://www.nycgovparks.org/parks/pelham-bay-park/events" target="_blank" rel="noopener">official events page</a>';
    }
    return 'The Events section lists what is coming up. The official calendar is at <a href="https://www.nycgovparks.org/parks/pelham-bay-park/events" target="_blank" rel="noopener">nycgovparks.org</a>.';
  }
  function lifeguardAnswer() {
    const s = window.OB.seasonStatus ? window.OB.seasonStatus() : null;
    if (!s) return "Lifeguards are on duty 10 AM to 6 PM daily in season.";
    return s.guardsOn
      ? "Lifeguards are on duty right now (daily 10 AM to 6 PM in season). Check the flags per section in the Safety area."
      : "Lifeguards are off duty right now. They work daily 10 AM to 6 PM, Memorial Day weekend through the Sunday after Labor Day. No swimming without lifeguards.";
  }
  function accessibilityAnswer() {
    return "Accessible ramps connect the upper pavilion, the plaza, and the beach itself. Accessible restrooms and changing areas are in the pavilion. The promenade is flat and wheelchair friendly for its full mile.";
  }
  /* ============ Nearby tools (v2.1): Google local search + Yelp ============
     Ethics by design: only family appropriate places (restaurants, ice cream,
     museums, gardens, parks, mini golf) within 20 miles of the beach and
     OUTSIDE the park itself. No bars, no nightlife, no ad money involved:
     these are neutral picks plus open Google and Yelp searches the visitor
     controls. api/nearby.php upgrades to live Google Places or Yelp Fusion
     results when the site owner adds an API key; this curated list is the
     zero setup fallback and mirrors the server side one. */
  const NEARBY = {
    eat: [
      { name: "Johnny's Reef Restaurant", area: "City Island", dist: "1.5 mi", desc: "Counter service seafood at the tip of City Island, outdoor tables over the water." },
      { name: "The Original Crab Shanty", area: "City Island", dist: "1.3 mi", desc: "Big family seafood feasts, bibs included." },
      { name: "Lickety Split Ice Cream", area: "City Island", dist: "1.4 mi", desc: "Classic scoop shop for the ride home." },
      { name: "Louie & Ernie's Pizza", area: "Schuylerville, Bronx", dist: "3.5 mi", desc: "Legendary thin crust slices, worth the detour." },
      { name: "Havana Café", area: "East Tremont, Bronx", dist: "4 mi", desc: "Cuban and Latin plates, lively and family friendly." }
    ],
    do: [
      { name: "Turtle Cove Golf Center", area: "Pelham Bay Park edge", dist: "1.2 mi", desc: "Driving range, mini golf, and batting cages by the lagoon." },
      { name: "Bartow-Pell Mansion Museum", area: "Pelham Bay Park", dist: "1.6 mi", desc: "1840s mansion, gardens, and carriage house tours." },
      { name: "City Island Nautical Museum", area: "City Island", dist: "1.7 mi", desc: "The island's seafaring history in an old schoolhouse." },
      { name: "Glen Island Park", area: "New Rochelle", dist: "4.5 mi", desc: "Waterfront county park with a castle and picnic lawns." },
      { name: "Bronx Zoo", area: "Bronx Park", dist: "7 mi", desc: "One of the world's great zoos, easy drive down the Pelham Parkway." },
      { name: "New York Botanical Garden", area: "Bronx Park", dist: "7.5 mi", desc: "250 acres of gardens and the landmark conservatory." }
    ]
  };
  const gmapsLink = (q) => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q + " near Orchard Beach, Bronx NY");
  const yelpLink = (q) => "https://www.yelp.com/search?find_desc=" + encodeURIComponent(q) + "&find_loc=" + encodeURIComponent("Orchard Beach, Bronx, NY");

  function renderNearbyList(type, places, source) {
    const label = type === "eat" ? "places to eat" : "things to do";
    let out = "<strong>" + (type === "eat" ? "Good eats" : "Great outings") + " near the beach</strong> (outside the park, all within 20 miles" +
      (source && source !== "curated" ? ", live from " + esc(source) : "") + "):\n";
    places.slice(0, 5).forEach((p) => {
      out += "• <strong>" + esc(p.name) + "</strong> — " + esc(p.area || "") + (p.dist ? ", " + esc(p.dist) : "") + ". " + esc(p.desc || "") +
        ' <a href="' + gmapsLink(p.name) + '" target="_blank" rel="noopener">Google Maps</a> · ' +
        '<a href="' + yelpLink(p.name) + '" target="_blank" rel="noopener">Yelp</a>\n';
    });
    out += 'Search more yourself: <a href="' + gmapsLink(type === "eat" ? "family restaurants" : "family activities") +
      '" target="_blank" rel="noopener">Google local search</a> · <a href="' + yelpLink(type === "eat" ? "family restaurants" : "family activities") +
      '" target="_blank" rel="noopener">Yelp</a>';
    return out;
  }

  async function nearbyAnswer(type) {
    try {
      const r = await fetch("api/nearby.php?type=" + type, { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        if (j && j.ok && Array.isArray(j.places) && j.places.length) return renderNearbyList(type, j.places, j.source);
      }
    } catch (e) { /* curated fallback below */ }
    return renderNearbyList(type, NEARBY[type], "curated");
  }

  function promoAnswer() {
    const p = window.OB.promo;
    if (p && p.code) {
      return "You already have it: show <strong class=\"promo-code\">" + esc(p.code) + "</strong> at the parking booth for 50% off" +
        (p.date ? " on " + esc(p.date) : "") + ". (Concept demo: the real system would validate it at the booth.)";
    }
    return "Reserve your beach day on this site and parking is half price: fill the Plan your trip form (or tell me “plan my day”) and I will issue your 50% off code on the spot.";
  }

  function findLocation(q) {
    const ql = q.toLowerCase();
    return locations.find((l) =>
      ql.indexOf(l.slug.replace(/-/g, " ")) >= 0 ||
      l.name.toLowerCase().split(/[,&]/)[0].split(" ").filter((w) => w.length > 3).some((w) => ql.indexOf(w.toLowerCase()) >= 0)
    );
  }

  function localAnswer(q) {
    const ql = q.toLowerCase();
    if (/\b(plan|itinerar|schedule|day trip|build)\b/.test(ql)) return { action: "plan" };
    // v2.1 nearby tools take priority over on-beach food answers
    const wantsNearby = /\b(nearby|near ?by|near the beach|around here|close by|outside|off the beach|city island|local)\b/.test(ql);
    if (wantsNearby && /\b(eat|food|restaurant|dinner|lunch|brunch|coffee|ice cream|pizza|seafood)\b/.test(ql)) return { action: "nearby", type: "eat" };
    if (/\b(things to do|what to do|to do|activities|activity|attraction|museum|zoo|garden|golf|kayak|mini ?golf|visit)\b/.test(ql) && (wantsNearby || /\b(things to do|activities|attraction|museum|zoo|garden|golf)\b/.test(ql))) return { action: "nearby", type: "do" };
    if (/\b(promo|discount|half off|50%|coupon|voucher|code|reserv)\b/.test(ql)) return { text: promoAnswer() };
    if (/\b(weather|temp|hot|cold|rain|water|wave|wind|uv|forecast)\b/.test(ql)) return { text: weatherAnswer() };
    if (/\b(park|parking|car|drive|lot|bus|train|subway|get there|directions|transit)\b/.test(ql)) return { text: parkingAnswer() };
    if (/\b(food|eat|snack|hungry|drink|ice cream|restaurant|cafe|vendor)\b/.test(ql)) return { text: foodAnswer() };
    if (/\b(rule|alcohol|glass|pet|dog|bbq|barbecue|grill|drone|smoke|allowed)\b/.test(ql)) return { text: rulesAnswer() };
    if (/\b(event|concert|music|program|happening)\b/.test(ql)) return { text: eventsAnswer() };
    if (/\b(lifeguard|swim|safe|flag|open|hour|season)\b/.test(ql)) return { text: lifeguardAnswer() };
    if (/\b(wheelchair|accessib|ramp|ada)\b/.test(ql)) return { text: accessibilityAnswer() };
    const loc = findLocation(ql);
    if (loc) return { text: "<strong>" + esc(loc.name) + "</strong>: " + esc(loc.desc) + " You can find it on the interactive map (the " + t("cat_" + loc.cat) + " filter).", img: loc._resolved || loc.img };
    return { text: "I know this beach well: conditions, parking, food, rules, events, accessibility, and every spot on the map, from the pavilion to the Twin Islands overlook. Try one of the quick buttons, or say “plan my day” and I will build you a full itinerary with pictures." };
  }

  /* ============ Optional AI engine (Claude via PHP proxy) ============ */
  async function checkAi() {
    try {
      const r = await fetch("api/chatbot.php", { method: "GET", cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json();
      if (j && j.ai_available) {
        aiMode = true;
        $("#ccMode").textContent = t("cc_ai");
      }
    } catch (e) { /* stay local */ }
  }

  async function aiAnswer(q) {
    const kb = {
      weather: $("#tempVal") ? ($("#tempVal").textContent + "F, water " + ($("#waterTempVal") || {}).textContent + "F") : null,
      locations: locations.map((l) => ({ name: l.name, category: l.cat, description: l.desc })),
      events: (window.OB.liveEvents || []).slice(0, 6)
    };
    const r = await fetch("api/chatbot.php", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q, context: kb })
    });
    if (!r.ok) throw new Error("ai down");
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || "ai error");
    return j.answer;
  }

  /* ============ Itinerary engine ============ */
  const DONENESS = { 2: "RARE", 4: "MEDIUM RARE", 6: "WELL DONE" };

  function slugStop(slug, minutes, note) {
    const loc = locations.find((l) => l.slug === slug);
    if (!loc) return null;
    return { loc, minutes: minutes || loc.minutes, note: note || "" };
  }

  function buildStops(plan) {
    const has = (i) => plan.interests.indexOf(i) >= 0;
    const stops = [];
    // arrival
    stops.push(slugStop(plan.arrival_mode === "bus" ? "bus-stop" : "parking-lot", 10,
      plan.arrival_mode === "bus" ? "Hop off the Bx12 and follow the crowd toward the water." : "Park, load up, and follow the walkway toward the pavilion."));
    // essentials for every itinerary
    stops.push(slugStop("pavilion", plan.duration >= 4 ? 30 : 20, "The Art Deco landmark. Changing areas, showers, and restrooms are inside."));
    // core beach block scales with duration
    const beachMin = plan.duration === 2 ? 45 : plan.duration === 4 ? 90 : 120;
    stops.push(slugStop("beach-central", beachMin, "Claim your spot. Swim only when lifeguards are on duty, 10 AM to 6 PM."));
    // food for everyone unless deselected
    if (has("food") || plan.duration >= 4) stops.push(slugStop("snack-bar", plan.duration === 2 ? 20 : 30, "Fuel up. The slushes are the local favorite."));
    if (plan.duration >= 4) {
      if (has("family")) {
        stops.push(slugStop("playground-north", 35, "Let the kids run. Restrooms are close by at the pavilion."));
        stops.push(slugStop("picnic-north", 45, "Shaded tables and the designated barbecue area."));
      }
      if (has("sports")) stops.push(slugStop("courts", 45, "26 courts: basketball, volleyball, handball. Mornings are easiest to get one."));
      if (!has("family") && !has("sports")) stops.push(slugStop("promenade", 35, "Walk the hexagonal blocks with the Sound on your shoulder."));
    }
    if (plan.duration >= 6) {
      if (has("nature")) {
        stops.push(slugStop("nature-center", 30, "Say hi to the rangers and see what is living in the Sound."));
        stops.push(slugStop("hunter-island", 50, "The Kazimiroff Trail loop. Sneakers recommended."));
      } else {
        stops.push(slugStop("beach-north", 45, "Quieter sand for the last stretch of the afternoon."));
        stops.push(slugStop("carts", 20, "Ice cream for the walk. The souvenir cart has free SPF 30."));
      }
      stops.push(slugStop("promenade", 30, "Golden hour on the promenade to close the day."));
    }
    // wrap up
    stops.push(slugStop("changing-areas", 15, "Rinse off and change before heading out."));
    return stops.filter(Boolean);
  }

  function scheduleStops(stops, plan) {
    const [h, m] = plan.start_time.split(":").map(Number);
    let cur = h * 60 + m;
    const total = plan.duration * 60;
    const used = stops.reduce((s, x) => s + x.minutes, 0);
    // scale to fit the chosen doneness exactly
    const k = total / used;
    return stops.map((s) => {
      const mins = Math.max(10, Math.round(s.minutes * k / 5) * 5);
      const start = cur; cur += mins;
      return { ...s, startMin: start, endMin: cur };
    });
  }

  const fmtTime = (mins) => {
    let h = Math.floor(mins / 60) % 24, m = mins % 60;
    const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
    return h + ":" + String(m).padStart(2, "0") + " " + ap;
  };

  function buildFromPlan(plan) {
    visitor = plan;
    // make sure the locations knowledge is loaded (map.js shares it)
    if (!locations.length && window.OB.locations) locations = window.OB.locations;
    if (!locations.length) {
      openPanel();
      say("I could not load the locations database yet. Give the page a second and try again.");
      return;
    }
    const stops = scheduleStops(buildStops(plan), plan);
    if (!stops.length) {
      openPanel();
      say("Something went wrong building the stops. Try again in a moment.");
      return;
    }
    itinerary = { plan, stops, doneness: DONENESS[plan.duration] || "CUSTOM" };
    openPanel();
    say("<strong>" + esc(plan.name) + "</strong>, your <strong>" + itinerary.doneness +
      "</strong> day is ready: " + stops.length + " stops over " + plan.duration + " hours, starting from the " +
      (plan.arrival_mode === "bus" ? "Bx12 bus stop" : "parking lot") + ". Opening the slideshow now. You can add it to your calendar or email it to yourself from there.");
    // half off parking voucher for reserving on the site (v2.1)
    if (window.OB.claimPromo) {
      const code = window.OB.claimPromo(plan.visit_date, plan.name);
      say("Because you reserved here, parking is <strong>half price</strong>" +
        (plan.arrival_mode === "bus" ? " if you switch to driving" : "") +
        ". Show this code at the booth: <span class=\"promo-code\">" + esc(code) + "</span>");
    }
    // weather aware tip
    const w = window.OB.state && window.OB.state.weather;
    if (w && w.f && w.f.current) {
      const c = w.f.current;
      if (c.weather_code >= 61) say("Heads up: the live forecast shows rain. The pavilion and the Nature Center are your best cover, and check the flags before swimming.");
      else if (c.temperature_2m >= 85) say("It is a hot one. The free SPF 30 station is at the souvenir cart, and lifeguards are on duty until 6 PM.");
    }
    showSlides();
    // save for staff analytics (best effort)
    fetch("api/itinerary.php", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: plan.name, email: plan.email, visit_date: plan.visit_date,
        party_size: plan.party_size, duration: plan.duration, doneness: itinerary.doneness,
        arrival_mode: plan.arrival_mode, interests: plan.interests,
        stops: itinerary.stops.map((s) => ({
          slug: s.loc.slug, name: s.loc.name,
          start_time: String(Math.floor(s.startMin / 60)).padStart(2, "0") + ":" + String(s.startMin % 60).padStart(2, "0"),
          end_time: String(Math.floor(s.endMin / 60)).padStart(2, "0") + ":" + String(s.endMin % 60).padStart(2, "0")
        }))
      })
    }).then((r) => { if (r.ok) say(t("it_saved")); }).catch(() => {});
  }

  /* ============ Slideshow ============ */
  function showSlides() {
    if (!itinerary || !itinerary.stops.length) return;
    slideIndex = 0;
    $("#slideModal").hidden = false;
    document.body.style.overflow = "hidden";
    $("#slideTitle").textContent = (visitor ? visitor.name + ", " : "") + "Your " + itinerary.doneness + " Day at Orchard Beach";
    renderSlide();
    renderDots();
  }
  function closeSlides() {
    $("#slideModal").hidden = true;
    document.body.style.overflow = "";
    stopPlay();
  }
  function renderSlide() {
    const s = itinerary.stops[slideIndex];
    const media = $("#slideMedia");
    media.style.backgroundImage = "url('" + (s.loc._resolved || s.loc.img) + "')";
    media.innerHTML = '<span class="slide-badge">' + (slideIndex + 1) + " / " + itinerary.stops.length + " · " + itinerary.doneness + "</span>";
    $("#slideTime").textContent = fmtTime(s.startMin) + " – " + fmtTime(s.endMin);
    $("#slideName").textContent = s.loc.name;
    $("#slideDesc").textContent = (s.note ? s.note + " " : "") + s.loc.desc;
    renderDots();
  }
  function renderDots() {
    const dots = $("#slideDots"); dots.innerHTML = "";
    itinerary.stops.forEach((_, i) => {
      const d = document.createElement("span");
      if (i === slideIndex) d.className = "on";
      d.addEventListener("click", () => { slideIndex = i; renderSlide(); });
      dots.appendChild(d);
    });
  }
  function nextSlide() { slideIndex = (slideIndex + 1) % itinerary.stops.length; renderSlide(); }
  function prevSlide() { slideIndex = (slideIndex - 1 + itinerary.stops.length) % itinerary.stops.length; renderSlide(); }
  function startPlay() { stopPlay(); $("#slidePlay").innerHTML = "&#10074;&#10074;"; slideTimer = setInterval(nextSlide, 3000); }
  function stopPlay() { if (slideTimer) { clearInterval(slideTimer); slideTimer = null; $("#slidePlay").innerHTML = "&#9654;"; } }

  /* ============ Calendar (.ics) ============ */
  function downloadIcs() {
    if (!itinerary || !visitor) return;
    const d = visitor.visit_date.replace(/-/g, "");
    const pad = (n) => String(n).padStart(2, "0");
    const stamp = (mins) => d + "T" + pad(Math.floor(mins / 60)) + pad(mins % 60) + "00";
    let ics = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Orchard Beach Concierge//EN\r\nCALSCALE:GREGORIAN\r\n";
    itinerary.stops.forEach((s, i) => {
      ics += "BEGIN:VEVENT\r\n" +
        "UID:ob-" + d + "-" + i + "@orchardbeach.local\r\n" +
        "DTSTART;TZID=America/New_York:" + stamp(s.startMin) + "\r\n" +
        "DTEND;TZID=America/New_York:" + stamp(s.endMin) + "\r\n" +
        "SUMMARY:" + s.loc.name.replace(/,/g, "\\,") + " (Orchard Beach)\r\n" +
        "DESCRIPTION:" + (s.note + " " + s.loc.desc).replace(/,/g, "\\,").replace(/\n/g, " ") + "\r\n" +
        "LOCATION:Orchard Beach\\, Bronx\\, NY 10464\r\n" +
        "GEO:" + s.loc.lat + ";" + s.loc.lng + "\r\n" +
        "END:VEVENT\r\n";
    });
    ics += "END:VCALENDAR\r\n";
    const blob = new Blob([ics], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "orchard-beach-" + itinerary.doneness.toLowerCase().replace(/ /g, "-") + "-day.ics";
    a.click();
    URL.revokeObjectURL(a.href);
    $("#slideStatus").className = "form-status ok";
    $("#slideStatus").textContent = "orchard-beach day .ics downloaded. Open it to add every stop to your calendar.";
  }

  /* ============ Email ============ */
  function itineraryText() {
    let out = "Your " + itinerary.doneness + " day at Orchard Beach (" + visitor.visit_date + ")\n" +
      "Planned for " + visitor.name + ", party of " + visitor.party_size + "\n\n";
    itinerary.stops.forEach((s) => {
      out += fmtTime(s.startMin) + " - " + fmtTime(s.endMin) + "  " + s.loc.name + "\n    " + (s.note || s.loc.desc) + "\n";
    });
    out += "\nParking: $10 weekdays, $12 weekends. Lifeguards 10 AM - 6 PM.\n" +
      "Rules: https://www.nycgovparks.org/rules/orchard-beach\n" +
      "Built by the Orchard Beach Concierge (Fordham Group 2 prototype).";
    return out;
  }
  async function emailItinerary() {
    if (!itinerary || !visitor) return;
    const status = $("#slideStatus");
    // try real SMTP first (api/send_email.php only sends if configured)
    try {
      const r = await fetch("api/send_email.php", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: visitor.email, name: visitor.name, subject: "Your " + itinerary.doneness + " day at Orchard Beach", body: itineraryText() })
      });
      const j = await r.json();
      if (j && j.ok && j.sent) { status.className = "form-status ok"; status.textContent = t("it_email_ok"); return; }
    } catch (e) { /* fall through to mailto */ }
    // fallback: open a prefilled draft in the visitor's own mail app
    const link = "mailto:" + encodeURIComponent(visitor.email) +
      "?subject=" + encodeURIComponent("Your " + itinerary.doneness + " day at Orchard Beach") +
      "&body=" + encodeURIComponent(itineraryText());
    window.location.href = link;
    status.className = "form-status ok";
    status.textContent = t("it_email_draft");
  }

  /* ============ Conversational plan flow (chat driven) ============ */
  let chatPlan = null; // partial plan being collected in chat
  function startChatPlan() {
    chatPlan = { step: "duration" };
    say("Love it. How much beach are we talking?\n• <strong>Rare</strong>, 2 hours\n• <strong>Medium Rare</strong>, 4 hours\n• <strong>Well Done</strong>, 6 hours\nJust answer: rare, medium rare, or well done.");
  }
  function continueChatPlan(text) {
    const q = text.toLowerCase();
    if (chatPlan.step === "duration") {
      const dur = /well/.test(q) ? 6 : /medium|mid/.test(q) ? 4 : /rare|2/.test(q) ? 2 : null;
      if (!dur) { say("Rare (2 hrs), Medium Rare (4 hrs), or Well Done (6 hrs)?"); return; }
      chatPlan.duration = dur; chatPlan.step = "arrival";
      say("A " + DONENESS[dur] + " day it is. Are you arriving by <strong>car</strong> (parking lot) or by <strong>bus</strong> (Bx12)?");
      return;
    }
    if (chatPlan.step === "arrival") {
      chatPlan.arrival_mode = /bus|bx12|train|subway/.test(q) ? "bus" : "car";
      chatPlan.step = "interests";
      say("Got it. What do you love? Say any of: beach, family, sports, nature, food. (For example: “family and food”)");
      return;
    }
    if (chatPlan.step === "interests") {
      const ints = ["beach", "family", "sports", "nature", "food"].filter((i) => q.indexOf(i) >= 0);
      chatPlan.interests = ints.length ? ints : ["beach", "food"];
      chatPlan.step = "name";
      say("Last thing: what is your name? (I will put it on the itinerary.)");
      return;
    }
    if (chatPlan.step === "name") {
      const name = text.trim() || "Beach lover";
      const plan = {
        name, email: (visitor && visitor.email) || "",
        visit_date: new Date().toISOString().slice(0, 10),
        start_time: "10:00",
        party_size: 2,
        arrival_mode: chatPlan.arrival_mode,
        duration: chatPlan.duration,
        interests: chatPlan.interests
      };
      chatPlan = null;
      buildFromPlan(plan);
      return;
    }
  }

  /* ============ Input handling ============ */
  async function handle(text) {
    sayUser(text);
    if (chatPlan) { continueChatPlan(text); return; }
    typing(true);
    // AI mode: free text goes to the model; the plan flow stays local
    const local = localAnswer(text);
    if (local.action === "plan") {
      typing(false);
      startChatPlan();
      return;
    }
    if (local.action === "nearby") {
      const ans = await nearbyAnswer(local.type);
      typing(false);
      say(ans);
      return;
    }
    if (aiMode) {
      try {
        const ans = await aiAnswer(text);
        typing(false);
        say(esc(ans).replace(/\n/g, "<br>"));
        return;
      } catch (e) { /* graceful fallback to local below */ }
    }
    setTimeout(() => {
      typing(false);
      say(local.text, { img: local.img });
    }, aiMode ? 0 : 450);
  }

  function renderQuick() {
    const q = $("#ccQuick"); q.innerHTML = "";
    [["qc_plan", "plan my day"], ["qc_weather", "weather"], ["qc_eat", "places to eat nearby"],
     ["qc_do", "things to do nearby"], ["qc_parking", "parking"], ["qc_events", "events"]].forEach(([key, msg]) => {
      const b = document.createElement("button");
      b.textContent = t(key);
      b.addEventListener("click", () => handle(msg));
      q.appendChild(b);
    });
  }

  /* ============ Wiring ============ */
  document.addEventListener("DOMContentLoaded", function () {
    $("#conciergeFab").addEventListener("click", () => {
      const p = $("#conciergePanel");
      if (p.hidden) {
        openPanel();
        if (!$("#ccLog").children.length) {
          say("Welcome to the Bronx Riviera. I am the Beach Concierge. I can answer anything about Orchard Beach, and if you say <strong>plan my day</strong> I will build you a personalized itinerary with pictures: Rare (2 hrs), Medium Rare (4 hrs), or Well Done (6 hrs).");
        }
      } else closePanel();
    });
    $("#closeConcierge").addEventListener("click", closePanel);
    $("#heroConcierge").addEventListener("click", () => {
      document.getElementById("plan").scrollIntoView({ behavior: "smooth" });
      setTimeout(openPanel, 600);
      if (!$("#ccLog").children.length) say("Fill the trip form below, or just tell me: plan my day.");
    });
    $("#ccForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const v = $("#ccText").value.trim();
      if (!v) return;
      $("#ccText").value = "";
      handle(v);
    });
    renderQuick();
    checkAi();

    // slideshow controls
    $("#closeSlides").addEventListener("click", closeSlides);
    $("#slideModal").addEventListener("click", (e) => { if (e.target.id === "slideModal") closeSlides(); });
    $("#slideNext").addEventListener("click", () => { stopPlay(); nextSlide(); });
    $("#slidePrev").addEventListener("click", () => { stopPlay(); prevSlide(); });
    $("#slidePlay").addEventListener("click", () => { slideTimer ? stopPlay() : startPlay(); });
    $("#icsBtn").addEventListener("click", downloadIcs);
    $("#emailItinBtn").addEventListener("click", emailItinerary);
    document.addEventListener("keydown", (e) => {
      if ($("#slideModal").hidden) return;
      if (e.key === "ArrowRight") nextSlide();
      if (e.key === "ArrowLeft") prevSlide();
      if (e.key === "Escape") closeSlides();
    });

    (window.OB.rerenderHooks = window.OB.rerenderHooks || []).push(renderQuick);
  });

  // public surface for app.js (plan form) and map.js (locations feed)
  window.OB = window.OB || {};
  window.OB.concierge = {
    buildFromPlan,
    onLocations: (locs) => { locations = locs; },
    open: openPanel
  };
})();
