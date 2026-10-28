-- ============================================================
-- ORCHARD BEACH v2.2 UPGRADE — approved photos publish to the
-- Share Your Experience gallery (5 slots, slideshow support).
-- Run ONLY if you already imported the database before v2.2.
--   phpMyAdmin -> orchard_beach_staff -> SQL -> paste -> Go
-- ============================================================
USE orchard_beach_staff;

ALTER TABLE submissions
  ADD COLUMN slot          TINYINT NULL      AFTER status,
  ADD COLUMN display_title VARCHAR(120) NULL AFTER slot;
