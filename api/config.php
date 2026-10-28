<?php
/**
 * Orchard Beach WebApp v2 — central configuration.
 * XAMPP defaults work out of the box: user root, empty password.
 */

// ---- MySQL (phpMyAdmin manages these; import sql/orchard_beach.sql first) ----
define('DB_HOST', '127.0.0.1');
define('DB_USER', 'root');
define('DB_PASS', '');                       // XAMPP default is empty
define('DB_PUBLIC', 'orchard_beach');        // locations + pictures (site + chatbot)
define('DB_STAFF',  'orchard_beach_staff');  // live staff-only database

// ---- Optional: real AI answers for the Beach Concierge ----
// Paste an Anthropic API key here to upgrade the chatbot from the local
// knowledge engine to Claude. Leave empty to stay fully local (still works).
define('ANTHROPIC_API_KEY', '');
define('ANTHROPIC_MODEL', 'claude-sonnet-4-5');

// ---- Optional: live nearby search for the Beach Concierge ----
// The concierge's "eat nearby" and "things to do" tools work out of the box
// with a curated family friendly list plus open Google Maps and Yelp search
// links. Add a key below to upgrade to LIVE results (api/nearby.php):
define('GOOGLE_PLACES_API_KEY', '');   // Google Places API (Text Search)
define('YELP_API_KEY', '');            // Yelp Fusion API

// ---- Optional: real email sending for itineraries ----
// Leave SMTP_USER empty to use the built in fallback flow (.ics download +
// a prefilled draft in the visitor's own mail app). To actually send from
// the server, create a Gmail App Password and fill these in:
define('SMTP_HOST', 'smtp.gmail.com');
define('SMTP_PORT', 587);
define('SMTP_USER', '');                     // e.g. yourgmail@gmail.com
define('SMTP_PASS', '');                     // 16 character Gmail App Password
define('SMTP_FROM_NAME', 'Orchard Beach Concierge');
