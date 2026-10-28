/* Orchard Beach interactive map, v2.
   Data flow: api/locations.php reads the orchard_beach MySQL database
   (phpMyAdmin manages it) and returns the same records the AI concierge
   uses. If PHP or MySQL is not running, FALLBACK_LOCATIONS below keeps the
   map fully working; it mirrors the database seed exactly. */
(function () {
  "use strict";
  const hasLeaflet = () => typeof L !== "undefined"; // offline: cards still render, map is skipped
  const t = (k) => window.I18N.t(k);
  const $ = (s, r) => (r || document).querySelector(s);

  const CAT_COLORS = {
    gateway: "#6b7b86", landmark: "#8a5aa5", beach: "#1E6E8C", family: "#E8A020",
    sports: "#C0392B", food: "#c77f1b", amenity: "#4A574C", nature: "#2C5A3B"
  };
  const CATS = ["all", "gateway", "landmark", "beach", "family", "sports", "food", "amenity", "nature"];

  /* Mirrors sql/orchard_beach.sql exactly. Coordinates are approximate. */
  const FALLBACK_LOCATIONS = [
    { id: 1,  slug: "parking-lot",      name: "Main Parking Lot",               cat: "gateway",  lat: 40.8656, lng: -73.7997, minutes: 10, desc: "The large seasonal lot behind the pavilion. $10 weekdays, $12 weekends.", img: "images/locations/parking-lot.jpg" },
    { id: 2,  slug: "bus-stop",         name: "Bx12 Bus Stop",                  cat: "gateway",  lat: 40.8662, lng: -73.7988, minutes: 5,  desc: "Summer weekend Bx12 service connects to the 6 train at Pelham Bay Park.", img: "images/locations/bus-stop.jpg" },
    { id: 3,  slug: "pavilion",         name: "Central Pavilion",               cat: "landmark", lat: 40.8672, lng: -73.7942, minutes: 45, desc: "The landmarked 1936 Art Deco bathhouse, reopened in 2026 after a $114 million restoration.", img: "images/locations/pavilion.jpg" },
    { id: 4,  slug: "promenade",        name: "Hexagonal Block Promenade",      cat: "landmark", lat: 40.8667, lng: -73.7935, minutes: 40, desc: "The mile long promenade of hexagonal blocks tracing the full crescent.", img: "images/locations/promenade.jpg" },
    { id: 5,  slug: "beach-central",    name: "Central Beach, Sections 5-8",    cat: "beach",    lat: 40.8674, lng: -73.7920, minutes: 90, desc: "The heart of the crescent, closest to the pavilion, snack bar, and lifeguard headquarters.", img: "images/locations/beach-central.jpg" },
    { id: 6,  slug: "beach-north",      name: "North Beach, Sections 1-4",      cat: "beach",    lat: 40.8712, lng: -73.7898, minutes: 90, desc: "Quieter sands near the nature trails at the north end.", img: "images/locations/beach-north.jpg" },
    { id: 7,  slug: "beach-south",      name: "South Beach, Sections 9-13",     cat: "beach",    lat: 40.8630, lng: -73.7952, minutes: 90, desc: "Lively southern sections near the courts and picnic groves.", img: "images/locations/beach-south.jpg" },
    { id: 8,  slug: "playground-north", name: "North Playground",               cat: "family",   lat: 40.8690, lng: -73.7936, minutes: 40, desc: "One of two playgrounds, steps from the sand near section 4.", img: "images/locations/playground-north.jpg" },
    { id: 9,  slug: "playground-south", name: "South Playground",               cat: "family",   lat: 40.8650, lng: -73.7952, minutes: 40, desc: "The second playground, by the southern picnic areas.", img: "images/locations/playground-south.jpg" },
    { id: 10, slug: "picnic-north",     name: "North Picnic Grove",             cat: "family",   lat: 40.8686, lng: -73.7947, minutes: 60, desc: "Shaded tables and designated barbecue areas behind the north sections.", img: "images/locations/picnic-north.jpg" },
    { id: 11, slug: "picnic-south",     name: "South Picnic Grove",             cat: "family",   lat: 40.8644, lng: -73.7962, minutes: 60, desc: "The second picnic area, with grills, behind the south sections.", img: "images/locations/picnic-south.jpg" },
    { id: 12, slug: "courts",           name: "26 Courts Complex",              cat: "sports",   lat: 40.8655, lng: -73.7965, minutes: 60, desc: "26 courts for basketball, volleyball, and handball at the south end.", img: "images/locations/courts.jpg" },
    { id: 13, slug: "snack-bar",        name: "Snack Bar & Food Court",         cat: "food",     lat: 40.8670, lng: -73.7940, minutes: 30, desc: "Burgers, hot dogs, fried chicken, and slushes at the pavilion plaza, 10 AM to 8 PM.", img: "images/locations/snack-bar.jpg" },
    { id: 14, slug: "carts",            name: "Food & Souvenir Carts",          cat: "food",     lat: 40.8666, lng: -73.7930, minutes: 15, desc: "Ice cream, cold drinks, hats, towels, and a free SPF 30 sunscreen station along the promenade.", img: "images/locations/carts.jpg" },
    { id: 15, slug: "changing-areas",   name: "Changing Areas & Showers",       cat: "amenity",  lat: 40.8671, lng: -73.7944, minutes: 15, desc: "Changing rooms, showers, and restrooms inside the pavilion, open in season.", img: "images/locations/changing-areas.jpg" },
    { id: 16, slug: "nature-center",    name: "Orchard Beach Nature Center",    cat: "nature",   lat: 40.8702, lng: -73.7891, minutes: 45, desc: "Ranger led exhibits on Long Island Sound wildlife, at the north end of the promenade.", img: "images/locations/nature-center.jpg" },
    { id: 17, slug: "hunter-island",    name: "Hunter Island Trails",           cat: "nature",   lat: 40.8737, lng: -73.7885, minutes: 60, desc: "Wooded Kazimiroff Nature Trail loops over glacial rock with Sound views.", img: "images/locations/hunter-island.jpg" },
    { id: 18, slug: "twin-island",      name: "Twin Islands Overlook",          cat: "nature",   lat: 40.8752, lng: -73.7860, minutes: 30, desc: "Salt marsh overlook and a favorite birdwatching spot.", img: "images/locations/twin-island.jpg" }
  ];

  const PH_GRADS = ["#2C5A3B,#3E8E5A", "#1E6E8C,#3E8E5A", "#1C3D28,#1E6E8C", "#E8A020,#c77f1b"];
  function placeholderImg(loc, i) {
    const [a, b] = PH_GRADS[i % PH_GRADS.length].split(",");
    const svg = "<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360'>" +
      "<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>" +
      "<stop offset='0' stop-color='" + a + "'/><stop offset='1' stop-color='" + b + "'/></linearGradient></defs>" +
      "<rect width='640' height='360' fill='url(%23g)'/>" +
      "<text x='320' y='190' font-family='Arial' font-size='28' fill='white' text-anchor='middle'>" + loc.name.replace(/&/g, "and") + "</text></svg>";
    return "data:image/svg+xml," + encodeURIComponent(svg).replace(/%2523/g, "%23");
  }

  let map = null, markers = [], activeCat = "all", locations = FALLBACK_LOCATIONS, fromDb = false;
  // share the fallback immediately so the concierge always has location knowledge
  window.OB = window.OB || {};
  window.OB.locations = locations;

  async function loadLocations() {
    try {
      const r = await fetch("api/locations.php", { cache: "no-store" });
      if (!r.ok) throw new Error("no api");
      const j = await r.json();
      if (j && j.ok && Array.isArray(j.locations) && j.locations.length) {
        locations = j.locations.map((l) => ({
          id: +l.id, slug: l.slug, name: l.name, cat: l.category,
          lat: +l.lat, lng: +l.lng, minutes: +l.avg_minutes,
          desc: l.description, img: l.image_path
        }));
        fromDb = true;
        const badge = $("#mapSource"); if (badge) badge.hidden = false;
      }
    } catch (e) { /* fallback stays in place */ }
    window.OB.locations = locations;
    render();
    if (window.OB.concierge && window.OB.concierge.onLocations) window.OB.concierge.onLocations(locations);
  }

  function imgUrl(loc, i) {
    // real photo if the file exists is handled lazily: we optimistically use the
    // path and swap to a generated placeholder on error via CSS background testing
    return loc._resolved || loc.img;
  }

  function resolveImages() {
    locations.forEach((loc, i) => {
      const probe = new Image();
      probe.onload = () => { loc._resolved = loc.img; refreshMedia(loc); };
      probe.onerror = () => { loc._resolved = placeholderImg(loc, i); refreshMedia(loc); };
      probe.src = loc.img;
    });
  }
  function refreshMedia(loc) {
    document.querySelectorAll('[data-loc-media="' + loc.slug + '"]').forEach((el) => {
      el.style.backgroundImage = "url('" + loc._resolved + "')";
    });
  }

  function makeMarker(loc) {
    const icon = L.divIcon({
      className: "",
      html: '<div style="width:18px;height:18px;border-radius:50%;background:' + (CAT_COLORS[loc.cat] || "#2C5A3B") +
        ';border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.5);"></div>',
      iconSize: [18, 18], iconAnchor: [9, 9]
    });
    const m = L.marker([loc.lat, loc.lng], { icon });
    m.bindPopup(
      "<strong>" + loc.name + "</strong><br><em>" + t("cat_" + loc.cat) + "</em>" +
      '<div class="pop-img" data-loc-media="' + loc.slug + '" style="background-image:url(\'' + (loc._resolved || loc.img) + '\')"></div>' +
      '<p style="font-size:.84rem;margin:2px 0 0">' + loc.desc + "</p>"
    );
    return m;
  }

  function render() {
    const mapEl = $("#obMap");
    if (mapEl && hasLeaflet()) {
      if (!map) {
        map = L.map("obMap", { scrollWheelZoom: false }).setView([40.8685, -73.7925], 15);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19, attribution: "&copy; OpenStreetMap contributors"
        }).addTo(map);
      }
      markers.forEach((m) => map.removeLayer(m.marker));
      markers = locations.map((loc) => {
        const marker = makeMarker(loc);
        if (activeCat === "all" || loc.cat === activeCat) marker.addTo(map);
        return { loc, marker };
      });
    } else if (mapEl && !hasLeaflet()) {
      mapEl.style.display = "none"; // no map library (offline); cards below still work
    }
    renderFilters();
    renderCards();
    resolveImages();
  }

  function renderFilters() {
    const bar = $("#mapFilters"); if (!bar) return;
    bar.innerHTML = "";
    CATS.forEach((c) => {
      const b = document.createElement("button");
      b.textContent = t("cat_" + c);
      if (c === activeCat) b.className = "active";
      b.addEventListener("click", () => { activeCat = c; render(); });
      bar.appendChild(b);
    });
  }

  function renderCards() {
    const grid = $("#locationGrid"); if (!grid) return;
    grid.innerHTML = "";
    locations
      .filter((l) => activeCat === "all" || l.cat === activeCat)
      .forEach((l, i) => {
        const card = document.createElement("div");
        card.className = "loc-card";
        card.innerHTML =
          '<div class="loc-media" data-loc-media="' + l.slug + '" style="background-image:url(\'' + (l._resolved || l.img) + '\')">' +
          '<span class="loc-cat">' + t("cat_" + l.cat) + "</span></div>" +
          '<div class="loc-body"><h4>' + l.name + "</h4><p>" + l.desc + "</p></div>";
        card.addEventListener("click", () => {
          if (!map) return;
          map.setView([l.lat, l.lng], 17);
          const m = markers.find((x) => x.loc.slug === l.slug);
          if (m) { if (!map.hasLayer(m.marker)) m.marker.addTo(map); m.marker.openPopup(); }
          $("#obMap").scrollIntoView({ behavior: "smooth", block: "center" });
        });
        grid.appendChild(card);
      });
  }

  // re-render category labels when the language changes
  window.OB = window.OB || {};
  (window.OB.rerenderHooks = window.OB.rerenderHooks || []).push(() => { renderFilters(); renderCards(); });

  document.addEventListener("DOMContentLoaded", loadLocations);
})();
