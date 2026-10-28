-- ============================================================
-- ORCHARD BEACH WEBAPP v2 — DATABASE SETUP
-- Fordham Web Application Development, Group 2
--
-- TWO databases, by design (requirement 6):
--   1. orchard_beach        PUBLIC content database. Pictures and mapping
--                           records for the site and the AI Chatbot
--                           Concierge to pull from.
--   2. orchard_beach_staff  LIVE operational database, used only by the
--                           Staff View: visitor emails and trip plans,
--                           saved itineraries (drives the analytics
--                           dashboard), lifeguard flags, alerts, staff
--                           logins, and the chatbot question log.
--
-- HOW TO RUN (XAMPP):
--   phpMyAdmin  ->  Import  ->  choose this file  ->  Go
--   or from Terminal:
--   /Applications/XAMPP/xamppfiles/bin/mysql -u root < sql/orchard_beach.sql
-- ============================================================

-- ------------------------------------------------------------
-- DATABASE 1: PUBLIC (locations + pictures for the map & chatbot)
-- ------------------------------------------------------------
DROP DATABASE IF EXISTS orchard_beach;
CREATE DATABASE orchard_beach CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE orchard_beach;

CREATE TABLE locations (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  slug          VARCHAR(50)  NOT NULL UNIQUE,
  name          VARCHAR(120) NOT NULL,
  category      ENUM('gateway','landmark','beach','family','sports','food','amenity','nature') NOT NULL,
  lat           DECIMAL(9,6) NOT NULL,
  lng           DECIMAL(9,6) NOT NULL,
  avg_minutes   INT NOT NULL DEFAULT 30,    -- typical dwell time, used by the itinerary engine
  description   TEXT NOT NULL,
  image_path    VARCHAR(255) NOT NULL,      -- relative path; drop real photos into images/locations/
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- extra pictures per location (gallery / slideshow support)
CREATE TABLE location_photos (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  location_id   INT NOT NULL,
  image_path    VARCHAR(255) NOT NULL,
  caption       VARCHAR(255),
  sort_order    INT NOT NULL DEFAULT 0,
  FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT INTO locations (slug, name, category, lat, lng, avg_minutes, description, image_path) VALUES
('parking-lot',      'Main Parking Lot',              'gateway',  40.865600, -73.799700, 10, 'The large seasonal lot behind the pavilion. $10 weekdays, $12 weekends.', 'images/locations/parking-lot.jpg'),
('bus-stop',         'Bx12 Bus Stop',                 'gateway',  40.866200, -73.798800,  5, 'Summer weekend Bx12 service connects to the 6 train at Pelham Bay Park.', 'images/locations/bus-stop.jpg'),
('pavilion',         'Central Pavilion',              'landmark', 40.867200, -73.794200, 45, 'The landmarked 1936 Art Deco bathhouse, reopened in 2026 after a $114 million restoration.', 'images/locations/pavilion.jpg'),
('promenade',        'Hexagonal Block Promenade',     'landmark', 40.866700, -73.793500, 40, 'The mile long promenade of hexagonal blocks tracing the full crescent.', 'images/locations/promenade.jpg'),
('beach-central',    'Central Beach, Sections 5-8',   'beach',    40.867400, -73.792000, 90, 'The heart of the crescent, closest to the pavilion, snack bar, and lifeguard headquarters.', 'images/locations/beach-central.jpg'),
('beach-north',      'North Beach, Sections 1-4',     'beach',    40.871200, -73.789800, 90, 'Quieter sands near the nature trails at the north end.', 'images/locations/beach-north.jpg'),
('beach-south',      'South Beach, Sections 9-13',    'beach',    40.863000, -73.795200, 90, 'Lively southern sections near the courts and picnic groves.', 'images/locations/beach-south.jpg'),
('playground-north', 'North Playground',              'family',   40.869000, -73.793600, 40, 'One of two playgrounds, steps from the sand near section 4.', 'images/locations/playground-north.jpg'),
('playground-south', 'South Playground',              'family',   40.865000, -73.795200, 40, 'The second playground, by the southern picnic areas.', 'images/locations/playground-south.jpg'),
('picnic-north',     'North Picnic Grove',            'family',   40.868600, -73.794700, 60, 'Shaded tables and designated barbecue areas behind the north sections.', 'images/locations/picnic-north.jpg'),
('picnic-south',     'South Picnic Grove',            'family',   40.864400, -73.796200, 60, 'The second picnic area, with grills, behind the south sections.', 'images/locations/picnic-south.jpg'),
('courts',           '26 Courts Complex',             'sports',   40.865500, -73.796500, 60, '26 courts for basketball, volleyball, and handball at the south end.', 'images/locations/courts.jpg'),
('snack-bar',        'Snack Bar & Food Court',        'food',     40.867000, -73.794000, 30, 'Burgers, hot dogs, fried chicken, and slushes at the pavilion plaza, 10 AM to 8 PM.', 'images/locations/snack-bar.jpg'),
('carts',            'Food & Souvenir Carts',         'food',     40.866600, -73.793000, 15, 'Ice cream, cold drinks, hats, towels, and a free SPF 30 sunscreen station along the promenade.', 'images/locations/carts.jpg'),
('changing-areas',   'Changing Areas & Showers',      'amenity',  40.867100, -73.794400, 15, 'Changing rooms, showers, and restrooms inside the pavilion, open in season.', 'images/locations/changing-areas.jpg'),
('nature-center',    'Orchard Beach Nature Center',   'nature',   40.870200, -73.789100, 45, 'Ranger led exhibits on Long Island Sound wildlife, at the north end of the promenade.', 'images/locations/nature-center.jpg'),
('hunter-island',    'Hunter Island Trails',          'nature',   40.873700, -73.788500, 60, 'Wooded Kazimiroff Nature Trail loops over glacial rock with Sound views.', 'images/locations/hunter-island.jpg'),
('twin-island',      'Twin Islands Overlook',         'nature',   40.875200, -73.786000, 30, 'Salt marsh overlook and a favorite birdwatching spot.', 'images/locations/twin-island.jpg');

-- ------------------------------------------------------------
-- DATABASE 2: STAFF (live operational data, Staff View only)
-- ------------------------------------------------------------
DROP DATABASE IF EXISTS orchard_beach_staff;
CREATE DATABASE orchard_beach_staff CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE orchard_beach_staff;

-- staff logins for staff.php  (demo user: staff / orchard2026)
CREATE TABLE staff_users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name  VARCHAR(100) NOT NULL,
  role          ENUM('admin','staff') NOT NULL DEFAULT 'staff',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO staff_users (username, password_hash, display_name, role) VALUES
('staff', '$2y$12$McfB8car/Ij9PRozbJdjWuG5XnHx/189k/MYK5TMfWhCf/MDWszl.', 'Beach Staff Demo', 'admin');

-- visitor email capture + trip plans (requirement 5)
CREATE TABLE visitors (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(190) NOT NULL,
  visit_date    DATE NOT NULL,
  start_time    TIME NOT NULL DEFAULT '10:00:00',
  party_size    INT NOT NULL DEFAULT 2,
  arrival_mode  ENUM('car','bus') NOT NULL DEFAULT 'car',
  duration_hrs  INT NOT NULL DEFAULT 4,
  interests     VARCHAR(255),                -- comma separated: beach,family,sports,nature,food
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_visit_date (visit_date),
  INDEX idx_email (email)
) ENGINE=InnoDB;

-- saved itineraries (drive the analytics dashboard, requirement 8)
CREATE TABLE itineraries (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  visitor_name  VARCHAR(100),
  visitor_email VARCHAR(190),
  visit_date    DATE NOT NULL,
  party_size    INT NOT NULL DEFAULT 2,
  duration_hrs  INT NOT NULL,
  doneness      VARCHAR(20),                 -- RARE / MEDIUM RARE / WELL DONE
  arrival_mode  ENUM('car','bus') NOT NULL DEFAULT 'car',
  interests     VARCHAR(255),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_visit_date (visit_date)
) ENGINE=InnoDB;

CREATE TABLE itinerary_stops (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  itinerary_id  INT NOT NULL,
  location_slug VARCHAR(50) NOT NULL,        -- joins to orchard_beach.locations.slug
  location_name VARCHAR(120) NOT NULL,
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  FOREIGN KEY (itinerary_id) REFERENCES itineraries(id) ON DELETE CASCADE,
  INDEX idx_slug (location_slug)
) ENGINE=InnoDB;

-- live lifeguard flags (persisted version of the quick staff panel)
CREATE TABLE beach_flags (
  section_key   VARCHAR(20) PRIMARY KEY,
  section_name  VARCHAR(50) NOT NULL,
  state         ENUM('green','yellow','red') NOT NULL DEFAULT 'green',
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO beach_flags (section_key, section_name, state) VALUES
('north',   'North Beach',   'green'),
('s46',     'Section 4-6',   'green'),
('central', 'Central Beach', 'yellow'),
('s911',    'Section 9-11',  'green'),
('south',   'South Beach',   'green');

-- safety alerts posted by staff
CREATE TABLE alerts (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  message       VARCHAR(255) NOT NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- visitor photo / PDF submissions, reviewed by staff before any use (v2.1)
CREATE TABLE submissions (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  file_path     VARCHAR(255) NOT NULL,
  mime_type     VARCHAR(100) NOT NULL,
  caption       VARCHAR(255),
  visitor_name  VARCHAR(100),
  visitor_email VARCHAR(190),
  status        ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  slot          TINYINT NULL,              -- gallery spot 1-5 (1 = large feature tile)
  display_title VARCHAR(120) NULL,         -- staff-given name, shown as the tile caption
  reviewed_by   VARCHAR(50),
  reviewed_at   DATETIME NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_status (status)
) ENGINE=InnoDB;

-- what visitors ask the concierge (helps staff spot information gaps)
CREATE TABLE chat_log (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  question      TEXT NOT NULL,
  answered_by   ENUM('local','ai') NOT NULL DEFAULT 'local',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- SEED DATA: sample itineraries so the analytics dashboard has
-- something to show on first run. Dates are relative to today.
-- ------------------------------------------------------------
INSERT INTO itineraries (visitor_name, visitor_email, visit_date, party_size, duration_hrs, doneness, arrival_mode, interests) VALUES
('Maria G.',  'maria@example.com',  CURDATE(), 4, 4, 'MEDIUM RARE', 'car', 'beach,family,food'),
('Devon R.',  'devon@example.com',  CURDATE(), 2, 2, 'RARE',        'bus', 'beach,food'),
('The Lees',  'lees@example.com',   CURDATE(), 5, 6, 'WELL DONE',   'car', 'family,nature,food'),
('Sofia P.',  'sofia@example.com',  CURDATE() + INTERVAL 1 DAY, 3, 4, 'MEDIUM RARE', 'bus', 'sports,beach'),
('Andre W.',  'andre@example.com',  CURDATE() + INTERVAL 1 DAY, 2, 6, 'WELL DONE',   'car', 'nature,beach'),
('Grace K.',  'grace@example.com',  CURDATE() + INTERVAL 2 DAY, 6, 4, 'MEDIUM RARE', 'car', 'family,food');

INSERT INTO itinerary_stops (itinerary_id, location_slug, location_name, start_time, end_time) VALUES
(1, 'parking-lot',   'Main Parking Lot',            '10:00', '10:10'),
(1, 'pavilion',      'Central Pavilion',            '10:10', '10:40'),
(1, 'beach-central', 'Central Beach, Sections 5-8', '10:40', '12:10'),
(1, 'snack-bar',     'Snack Bar & Food Court',      '12:10', '12:40'),
(1, 'playground-north','North Playground',          '12:40', '13:20'),
(1, 'changing-areas','Changing Areas & Showers',    '13:20', '13:40'),
(2, 'bus-stop',      'Bx12 Bus Stop',               '11:00', '11:10'),
(2, 'beach-central', 'Central Beach, Sections 5-8', '11:10', '12:10'),
(2, 'snack-bar',     'Snack Bar & Food Court',      '12:10', '12:35'),
(2, 'promenade',     'Hexagonal Block Promenade',   '12:35', '13:00'),
(3, 'parking-lot',   'Main Parking Lot',            '10:00', '10:10'),
(3, 'pavilion',      'Central Pavilion',            '10:10', '10:40'),
(3, 'beach-central', 'Central Beach, Sections 5-8', '10:40', '12:40'),
(3, 'picnic-north',  'North Picnic Grove',          '12:40', '13:40'),
(3, 'playground-north','North Playground',          '13:40', '14:20'),
(3, 'nature-center', 'Orchard Beach Nature Center', '14:20', '15:00'),
(3, 'promenade',     'Hexagonal Block Promenade',   '15:00', '15:40'),
(3, 'changing-areas','Changing Areas & Showers',    '15:40', '16:00'),
(4, 'bus-stop',      'Bx12 Bus Stop',               '12:00', '12:10'),
(4, 'courts',        '26 Courts Complex',           '12:10', '13:10'),
(4, 'beach-south',   'South Beach, Sections 9-13',  '13:10', '14:40'),
(4, 'snack-bar',     'Snack Bar & Food Court',      '14:40', '15:10'),
(4, 'changing-areas','Changing Areas & Showers',    '15:10', '15:30'),
(5, 'parking-lot',   'Main Parking Lot',            '09:00', '09:10'),
(5, 'hunter-island', 'Hunter Island Trails',        '09:10', '10:10'),
(5, 'nature-center', 'Orchard Beach Nature Center', '10:10', '10:50'),
(5, 'beach-north',   'North Beach, Sections 1-4',   '10:50', '12:50'),
(5, 'carts',         'Food & Souvenir Carts',       '12:50', '13:10'),
(5, 'promenade',     'Hexagonal Block Promenade',   '13:10', '13:50'),
(5, 'changing-areas','Changing Areas & Showers',    '13:50', '14:10'),
(6, 'parking-lot',   'Main Parking Lot',            '11:00', '11:10'),
(6, 'playground-south','South Playground',          '11:10', '11:50'),
(6, 'picnic-south',  'South Picnic Grove',          '11:50', '12:50'),
(6, 'beach-south',   'South Beach, Sections 9-13',  '12:50', '14:20'),
(6, 'snack-bar',     'Snack Bar & Food Court',      '14:20', '14:50'),
(6, 'changing-areas','Changing Areas & Showers',    '14:50', '15:10');

INSERT INTO visitors (name, email, visit_date, start_time, party_size, arrival_mode, duration_hrs, interests) VALUES
('Maria G.', 'maria@example.com', CURDATE(), '10:00', 4, 'car', 4, 'beach,family,food'),
('Devon R.', 'devon@example.com', CURDATE(), '11:00', 2, 'bus', 2, 'beach,food'),
('The Lees', 'lees@example.com',  CURDATE(), '10:00', 5, 'car', 6, 'family,nature,food');

INSERT INTO chat_log (question, answered_by) VALUES
('Is parking free?', 'local'),
('Can I bring my dog?', 'local'),
('plan my day', 'local');
