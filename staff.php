<?php
/**
 * STAFF VIEW — full dashboard (requirements 6 and 8).
 * Login protected (session). Data comes ONLY from the orchard_beach_staff
 * database: visitor signups, saved itineraries, expected crowding by
 * location and hour, lifeguard flags, alerts, and the chatbot question log.
 * Demo login: staff / orchard2026
 */
session_start();
$loggedIn = !empty($_SESSION['staff_user']);
$staffName = $_SESSION['staff_name'] ?? '';
?>
<!DOCTYPE html>
<html lang="en" data-bs-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Staff View | Orchard Beach</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"></script>
  <style>
    :root { --ob-green:#2C5A3B; --ob-gold:#E8A020; }
    body { background:#f2f4ef; }
    .navbar { background: var(--ob-green); }
    .navbar-brand, .navbar .nav-link, .navbar span { color:#fff !important; }
    .card { border:none; border-radius:14px; box-shadow:0 4px 14px rgba(22,49,31,.08); }
    .stat-value { font-size:2rem; font-weight:800; color:var(--ob-green); }
    .btn-ob { background:var(--ob-green); color:#fff; font-weight:700; border:2px solid rgba(255,255,255,.9); }
    .navbar .btn-outline-light { border:2px solid rgba(255,255,255,.9); font-weight:600; }
    .navbar .btn-outline-light:hover { background:rgba(255,255,255,.15); }
    .btn-ob:hover { background:#1C3D28; color:#fff; }
    .login-wrap { max-width:400px; margin:8vh auto; }
    .flag-pill { width:14px; height:14px; border-radius:50%; display:inline-block; margin-right:6px; }
    .fg-green{background:#3E8E5A}.fg-yellow{background:#E3A712}.fg-red{background:#C0392B}
    [data-bs-theme="dark"] body { background:#141b16; }
    [data-bs-theme="dark"] .card { background:#1b241d; color:#e6efe8; }
    [data-bs-theme="dark"] .stat-value { color:#9fd4ae; }
  </style>
</head>
<body>

<nav class="navbar navbar-expand-lg mb-4">
  <div class="container">
    <a class="navbar-brand fw-bold" href="index.html">&larr; Orchard Beach — Staff View</a>
    <div class="d-flex align-items-center gap-3">
      <button id="themeToggle" class="btn btn-sm btn-outline-light">Dark mode</button>
      <?php if ($loggedIn): ?>
        <span class="small">Signed in: <strong><?= htmlspecialchars($staffName) ?></strong></span>
        <a class="btn btn-sm btn-outline-light" href="api/staff_auth.php?action=logout">Log out</a>
      <?php endif; ?>
    </div>
  </div>
</nav>

<?php if (!$loggedIn): ?>
  <div class="login-wrap">
    <div class="card p-4">
      <h4 class="mb-1">Staff sign in</h4>
      <p class="text-secondary small mb-3">Demo credentials: <code>staff</code> / <code>orchard2026</code></p>
      <?php if (isset($_GET['err'])): ?>
        <div class="alert alert-danger py-2">Wrong username or password.</div>
      <?php endif; ?>
      <form method="post" action="api/staff_auth.php?action=login">
        <div class="mb-3">
          <label class="form-label">Username</label>
          <input class="form-control" name="username" autocomplete="username" required>
        </div>
        <div class="mb-3">
          <label class="form-label">Password</label>
          <input class="form-control" type="password" name="password" autocomplete="current-password" required>
        </div>
        <button class="btn btn-ob w-100">Sign in</button>
      </form>
    </div>
  </div>
<?php else: ?>

<div class="container pb-5">

  <div class="d-flex flex-wrap align-items-end justify-content-between gap-2 mb-3">
    <div>
      <h3 class="mb-0">Operations dashboard</h3>
      <span class="text-secondary small">Live from the <code>orchard_beach_staff</code> database</span>
    </div>
    <div class="d-flex align-items-center gap-2">
      <label class="form-label mb-0 small">Forecast date</label>
      <input type="date" id="datePick" class="form-control form-control-sm" style="width:auto">
      <button id="reloadBtn" class="btn btn-sm btn-ob">Refresh</button>
    </div>
  </div>

  <div id="dbWarning" class="alert alert-warning d-none">
    The staff database is unreachable. Start MySQL in XAMPP and import <code>sql/orchard_beach.sql</code> in phpMyAdmin.
  </div>

  <!-- Stat cards -->
  <div class="row g-3 mb-4">
    <div class="col-6 col-lg-3"><div class="card p-3"><div class="text-secondary small">Itineraries for this date</div><div class="stat-value" id="statItins">--</div></div></div>
    <div class="col-6 col-lg-3"><div class="card p-3"><div class="text-secondary small">Expected visitors (planned)</div><div class="stat-value" id="statPeople">--</div></div></div>
    <div class="col-6 col-lg-3"><div class="card p-3"><div class="text-secondary small">Average planned stay</div><div class="stat-value" id="statHours">--</div></div></div>
    <div class="col-6 col-lg-3"><div class="card p-3"><div class="text-secondary small">Email signups (all time)</div><div class="stat-value" id="statEmails">--</div></div></div>
  </div>

  <!-- Charts: where and when it will be busy -->
  <div class="row g-3 mb-4">
    <div class="col-lg-7">
      <div class="card p-3">
        <h6 class="mb-1">Expected crowding by hour</h6>
        <p class="text-secondary small mb-2">Sum of planned party sizes across saved itineraries. Staff can pre-position lifeguards, carts, and cleaning crews.</p>
        <canvas id="hourChart" height="220"></canvas>
      </div>
    </div>
    <div class="col-lg-5">
      <div class="card p-3">
        <h6 class="mb-1">Busiest locations</h6>
        <p class="text-secondary small mb-2">Peak expected visitors per location for the chosen date.</p>
        <canvas id="locChart" height="220"></canvas>
      </div>
    </div>
  </div>

  <!-- Flags + visitor list -->
  <div class="row g-3 mb-4">
    <div class="col-lg-4">
      <div class="card p-3">
        <h6>Lifeguard flags (live)</h6>
        <ul class="list-unstyled mb-2" id="flagList"><li class="text-secondary small">Loading...</li></ul>
        <p class="text-secondary small mb-0">Change flags from the quick Staff panel on the public page; they persist here.</p>
      </div>
      <div class="card p-3 mt-3">
        <h6>Recent concierge questions</h6>
        <ul class="small mb-0" id="chatList"><li class="text-secondary">Loading...</li></ul>
      </div>
      <div class="card p-3 mt-3">
        <h6>Visitor submissions <span class="badge text-bg-warning" id="subCount" hidden>0 pending</span></h6>
        <p class="text-secondary small mb-2">Pictures and PDFs shared through the site. Nothing is published without approval here. <strong>Approving a picture publishes it to the Share Your Experience gallery</strong>: pick a spot (Feature is the big picture), name the tile, and stack up to 5 photos in one spot to make a slideshow.</p>
        <div id="subList" class="d-flex flex-column gap-2"><span class="text-secondary small">Loading...</span></div>
      </div>
    </div>
    <div class="col-lg-8">
      <div class="card p-3">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h6 class="mb-0">Visitor signups and trip plans</h6>
          <a class="btn btn-sm btn-ob" href="api/staff_data.php?action=visitors_csv">Export CSV</a>
        </div>
        <div class="table-responsive" style="max-height:420px">
          <table class="table table-sm table-hover align-middle">
            <thead><tr><th>Name</th><th>Email</th><th>Date</th><th>Arrive</th><th>Party</th><th>Mode</th><th>Hours</th><th>Interests</th></tr></thead>
            <tbody id="visitorRows"><tr><td colspan="8" class="text-secondary">Loading...</td></tr></tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

</div>

<script>
(function () {
  const $ = (s) => document.querySelector(s);
  let hourChart = null, locChart = null;

  // dark mode, same preference key as the public site
  const applyTheme = (m) => document.documentElement.setAttribute("data-bs-theme", m);
  try { applyTheme(localStorage.getItem("ob-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")); } catch (e) {}
  $("#themeToggle").addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-bs-theme") === "dark" ? "light" : "dark";
    applyTheme(next);
    try { localStorage.setItem("ob-theme", next); } catch (e) {}
  });

  $("#datePick").value = new Date().toISOString().slice(0, 10);

  async function getJson(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error("http " + r.status);
    return r.json();
  }

  async function loadAnalytics() {
    try {
      const j = await getJson("api/staff_data.php?action=analytics&date=" + $("#datePick").value);
      if (!j.ok) throw new Error("analytics");
      $("#dbWarning").classList.add("d-none");
      $("#statItins").textContent = j.totals.itineraries;
      $("#statPeople").textContent = j.totals.people;
      $("#statHours").textContent = (+j.totals.avg_hours).toFixed(1) + "h";
      $("#statEmails").textContent = j.visitor_count;

      // hour chart: total expected people per hour (9..19)
      const hours = []; for (let h = 9; h <= 19; h++) hours.push(h);
      const totals = hours.map((h) => {
        let s = 0;
        Object.values(j.by_location_hour).forEach((byH) => { s += byH[h] || 0; });
        return s;
      });
      const labels = hours.map((h) => (h % 12 || 12) + (h >= 12 ? " PM" : " AM"));
      if (hourChart) hourChart.destroy();
      hourChart = new Chart($("#hourChart"), {
        type: "bar",
        data: { labels, datasets: [{ label: "Expected people", data: totals, backgroundColor: "#3E8E5A", borderRadius: 6 }] },
        options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
      });

      // location chart: peak expected people per location
      const locs = Object.entries(j.by_location_hour).map(([slug, byH]) => ({
        name: j.location_names[slug] || slug,
        peak: Math.max(0, ...Object.values(byH))
      })).sort((a, b) => b.peak - a.peak).slice(0, 8);
      if (locChart) locChart.destroy();
      locChart = new Chart($("#locChart"), {
        type: "bar",
        data: {
          labels: locs.map((l) => l.name),
          datasets: [{ label: "Peak expected", data: locs.map((l) => l.peak), backgroundColor: "#E8A020", borderRadius: 6 }]
        },
        options: { indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } }
      });
    } catch (e) {
      $("#dbWarning").classList.remove("d-none");
    }
  }

  async function loadFlags() {
    try {
      const j = await getJson("api/staff_data.php?action=flags");
      if (!j.ok) return;
      $("#flagList").innerHTML = j.flags.map((f) =>
        '<li class="mb-1"><span class="flag-pill fg-' + f.state + '"></span>' + f.section_name +
        ' <span class="text-secondary small">(' + f.state + ")</span></li>").join("");
    } catch (e) {}
  }

  async function loadVisitors() {
    try {
      const j = await getJson("api/staff_data.php?action=visitors");
      if (!j.ok) return;
      $("#visitorRows").innerHTML = j.visitors.length ? j.visitors.map((v) =>
        "<tr><td>" + v.name + "</td><td>" + v.email + "</td><td>" + v.visit_date + "</td><td>" +
        (v.start_time || "").slice(0, 5) + "</td><td>" + v.party_size + "</td><td>" + v.arrival_mode +
        "</td><td>" + v.duration_hrs + "</td><td class='small text-secondary'>" + (v.interests || "") + "</td></tr>"
      ).join("") : '<tr><td colspan="8" class="text-secondary">No signups yet.</td></tr>';
    } catch (e) {}
  }

  async function loadChat() {
    try {
      const j = await getJson("api/staff_data.php?action=chatlog");
      if (!j.ok) return;
      $("#chatList").innerHTML = j.chatlog.length ? j.chatlog.slice(0, 8).map((c) =>
        "<li>&ldquo;" + c.question + "&rdquo; <span class='text-secondary'>(" + c.answered_by + ")</span></li>").join("")
        : '<li class="text-secondary">No questions yet.</li>';
    } catch (e) {}
  }

  async function loadSubmissions() {
    try {
      const j = await getJson("api/staff_data.php?action=submissions");
      if (!j.ok) return;
      const pending = j.submissions.filter((s) => s.status === "pending").length;
      const badge = $("#subCount");
      badge.hidden = pending === 0;
      badge.textContent = pending + " pending";
      const SPOTS = { 1: "Feature (large)", 2: "Tile 2", 3: "Tile 3", 4: "Tile 4", 5: "Tile 5" };
      $("#subList").innerHTML = j.submissions.length ? j.submissions.slice(0, 12).map((s) => {
        const isImg = (s.mime_type || "").indexOf("image/") === 0;
        const media = isImg
          ? '<img src="' + s.file_path + '" alt="" style="width:64px;height:48px;object-fit:cover;border-radius:6px">'
          : '<span class="badge text-bg-danger" style="width:64px">PDF</span>';
        // Approving PUBLISHES to the Share Your Experience gallery: staff
        // picks the tile spot (Feature = the big picture; a spot with
        // several photos becomes a slideshow, 5 max) and names the tile —
        // like the subject line of an email. Prefilled from the caption.
        const controls = s.status === "pending"
          ? (isImg
              ? '<div class="d-flex flex-wrap align-items-center gap-1 mt-1">' +
                '<select class="form-select form-select-sm" data-slot-for="' + s.id + '" style="width:auto">' +
                Object.entries(SPOTS).map(([v, l]) => '<option value="' + v + '">' + l + "</option>").join("") +
                "</select>" +
                '<input class="form-control form-control-sm" data-title-for="' + s.id + '" style="width:9rem"' +
                ' placeholder="Name this tile" value="' + String(s.caption || s.visitor_name || "").replace(/"/g, "&quot;") + '">' +
                '<div class="btn-group btn-group-sm"><button class="btn btn-success" data-sub="' + s.id + '" data-st="approved">Approve</button>' +
                '<button class="btn btn-outline-danger" data-sub="' + s.id + '" data-st="rejected">Reject</button></div></div>'
              : '<div class="btn-group btn-group-sm mt-1"><button class="btn btn-outline-danger" data-sub="' + s.id + '" data-st="rejected">Reject</button>' +
                '<span class="badge text-bg-secondary align-self-center ms-1">PDFs are never published</span></div>')
          : '<span class="badge ' + (s.status === "approved" ? "text-bg-success" : "text-bg-secondary") + '">' +
            s.status + (s.status === "approved" && s.slot ? " · " + (SPOTS[s.slot] || "spot " + s.slot) : "") + "</span>" +
            (s.status === "approved" && s.display_title ? ' <span class="text-secondary">&ldquo;' + s.display_title + "&rdquo;</span>" : "");
        return '<div class="small border-bottom pb-2">' +
          '<div class="d-flex align-items-center gap-2">' +
          '<a href="' + s.file_path + '" target="_blank">' + media + "</a>" +
          '<div class="flex-grow-1"><div>' + (s.caption || "<em>no caption</em>") + "</div>" +
          '<div class="text-secondary">' + (s.visitor_name || "anonymous") + " · " + (s.created_at || "") + "</div></div></div>" +
          controls + "</div>";
      }).join("") : '<span class="text-secondary small">No submissions yet.</span>';
      $("#subList").querySelectorAll("button[data-sub]").forEach((b) => b.addEventListener("click", async () => {
        const id = +b.dataset.sub;
        const slotEl = $("#subList").querySelector('[data-slot-for="' + id + '"]');
        const titleEl = $("#subList").querySelector('[data-title-for="' + id + '"]');
        const r = await fetch("api/staff_data.php?action=review_submission", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, status: b.dataset.st,
                                 slot: slotEl ? +slotEl.value : 0,
                                 title: titleEl ? titleEl.value.trim() : "" })
        });
        const jj = await r.json().catch(() => ({}));
        if (!r.ok || !jj.ok) alert(jj.error || "Could not save the review.");
        loadSubmissions();
      }));
    } catch (e) {}
  }

  function loadAll() { loadAnalytics(); loadFlags(); loadVisitors(); loadChat(); loadSubmissions(); }
  $("#reloadBtn").addEventListener("click", loadAll);
  $("#datePick").addEventListener("change", loadAnalytics);
  loadAll();
  setInterval(loadAll, 60000);
})();
</script>
<?php endif; ?>
</body>
</html>
