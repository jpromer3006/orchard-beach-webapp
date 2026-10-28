# Orchard Beach Website Enhancement, v2

A mobile friendly information hub for Orchard Beach, the Bronx's only public beach.
Built by Fordham Group 2 (Ishtiaq Iqbal, JP Romero, Lauren Zecca) for Web Application
Development. Concept prototype, not affiliated with NYC Parks.

v2 keeps everything from v1 (live Beach Conditions from Open-Meteo, lifeguard flags,
crowd and parking cards, food and vendors, the Ask form, EN/ES) and adds the features
below.

## What is new in v2

1. **Dark mode.** Follows the visitor's OS preference automatically, with a manual
   sun/moon toggle in the header. The choice is remembered.
2. **Hybrid languages.** English and Spanish stay instant and hand translated. The
   language menu now adds 24 more languages (the most spoken in NYC) through Google
   Translate, loaded lazily only when someone picks one, so there is no latency cost
   on page load.
3. **Live events.** `api/events.php` fetches the official NYC Parks events RSS feed
   server side, filters it to Pelham Bay Park / Orchard Beach, caches it 30 minutes,
   and the Events section renders it with real links. If the feed is unreachable the
   old sample schedule appears, clearly labeled as a sample.
4. **Beach rules.** A new Rules section summarizes the key rules with a prominent
   link to the official page, and the Plan a Visit section links every official NYC
   Parks page for the beach (facility page, all beaches, rules, events, park page,
   water quality).
5. **Visitor emails + trip plans.** The "Plan your trip" form captures name, email,
   date, party size, arrival mode, duration, and interests into the staff database
   (`visitors` table), with a logfile fallback when MySQL is off.
6. **Two databases** (`sql/orchard_beach.sql` creates both):
   - `orchard_beach` (public): the pictures and mapping records that the interactive
     map AND the chatbot pull from.
   - `orchard_beach_staff` (staff view only): visitors, itineraries and stops, flags,
     alerts, staff logins, chatbot question log.
7. **The Beach Concierge** (the prize feature): floating chat widget that answers
   questions from a local knowledge engine (weather, parking, food, rules, events,
   every mapped location). Saying "plan my day" builds a personalized itinerary
   across the 115 acre, 1.1 mile crescent, starting from the Parking Lot or the Bx12
   stop, in three sizes: **Rare (2 hrs), Medium Rare (4 hrs), Well Done (6 hrs)**.
   The itinerary opens as a timed picture slideshow, downloads as a calendar `.ics`
   (every stop becomes a calendar event), and can be emailed (real SMTP if
   configured in `api/config.php`, otherwise a prefilled draft in the visitor's mail
   app). Adding an Anthropic API key in `api/config.php` upgrades free text answers
   to Claude, grounded in the same locations database.
8. **Staff analytics dashboard** (`staff.php`, Bootstrap 5 + Chart.js): expected
   crowding by hour and busiest locations, computed from saved itineraries, plus
   visitor signups with CSV export, live flags, and recent concierge questions.
   Login: `staff` / `orchard2026`.
9. **Interactive map** (Leaflet + OpenStreetMap, no API key): every location as a
   colored pin with photo popups, category filters, and cards that fly the map to
   the spot. Data comes from the database; a built in fallback keeps it working
   without MySQL.

## What is new in v2.1

- **Nav that pops:** animated gradient underlines, hover lift, and a scrollspy
  that highlights the section you are reading.
- **Weather in the nav bar:** live temperature and water temperature chip, always
  in view, linking to the full Conditions panel.
- **50% off parking:** promo strip and parking card highlight; reserving a day in
  the trip planner (or with the concierge) issues a demo voucher code shown on
  the site and by the chatbot.
- **Concierge nearby tools:** "Eat nearby" and "Things to do" answer with family
  friendly picks within 20 miles outside the park, each with Google Maps and Yelp
  links. `api/nearby.php` upgrades to live Google Places or Yelp Fusion results
  when you add a key in `api/config.php`; bars/nightlife are filtered out either way.
- **Share your photos:** visitors submit pictures or PDFs (10 MB max, real MIME
  checked) with a consent disclaimer; everything lands in a pending queue that
  Parks staff approve or reject in the Staff View. Files go to `uploads/submissions/`.
- **Local Events:** the events section now leads with the nearest events this week
  across ALL NYC Parks categories (Orchard Beach and Pelham Bay first, then the
  rest of the Bronx), and links to the official Orchard Beach page and the full
  events calendar. Existing databases: import `sql/upgrade_v2_1.sql` once.

## Run it in XAMPP (macOS)

1. Put this folder at `/Applications/XAMPP/xamppfiles/htdocs/WebApp/Orchard_WebApp`
   (avoid trailing spaces in the folder name; they break URLs and tooling).
2. Start **Apache** and **MySQL** in the XAMPP control panel.
3. Import the databases: open `http://localhost/phpmyadmin`, Import, choose
   `sql/orchard_beach.sql`, Go. (Or:
   `/Applications/XAMPP/xamppfiles/bin/mysql -u root < sql/orchard_beach.sql`)
4. Open `http://localhost/WebApp/Orchard_WebApp/`.
5. Staff dashboard: `http://localhost/WebApp/Orchard_WebApp/staff.php`
   (staff / orchard2026).

Everything degrades gracefully: without MySQL the map, concierge, and itineraries
still work from built in data; without internet the weather shows a retry message;
without an API key the chatbot uses its local engine; without SMTP the email button
opens a prefilled draft instead.

## Optional upgrades

- **Real AI chat:** put an Anthropic API key in `api/config.php`
  (`ANTHROPIC_API_KEY`). The concierge header switches to "AI powered".
- **Real email sending:** fill `SMTP_USER` and `SMTP_PASS` (Gmail App Password) in
  `api/config.php`. PHPMailer is used if installed (`composer require
  phpmailer/phpmailer`); otherwise a built in SMTP client sends the mail.
- **Real photos:** see `images/README.txt` for the exact file names the gallery,
  map, and slideshow look for.

## Files

- `index.html` — the public page (all v1 sections plus Rules, Map, My Trip)
- `staff.php` — login protected staff dashboard (Bootstrap 5, Chart.js)
- `css/styles.css` — v1 styling plus dark theme and new components
- `js/i18n.js` — EN/ES dictionary (v2 keys added)
- `js/app.js` — live data, dark mode, language menu, live events
- `js/map.js` — Leaflet map fed by `api/locations.php`
- `js/concierge.js` — chatbot, itinerary engine, slideshow, .ics, email
- `api/` — config, db helper, locations, subscribe, itinerary, events,
  chatbot, staff auth, staff data, send email
- `sql/orchard_beach.sql` — both databases, schema plus seed data
- `submit.php` — v1 Ask form handler (unchanged)
- `images/` — drop in photos (see its README)
