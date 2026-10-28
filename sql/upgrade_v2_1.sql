-- ============================================================
-- ORCHARD BEACH v2.1 UPGRADE
-- Run this if you ALREADY imported sql/orchard_beach.sql before v2.1
-- and want to keep your existing data. (Fresh installs can just import
-- sql/orchard_beach.sql, which now includes this table.)
--
--   phpMyAdmin -> Import -> this file -> Go
-- ============================================================
USE orchard_beach_staff;

CREATE TABLE IF NOT EXISTS submissions (
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
