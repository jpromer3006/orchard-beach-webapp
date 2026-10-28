<?php
/** Public locations feed: the map, the cards, and the AI concierge all pull
 *  from the orchard_beach database through this endpoint. */
require_once __DIR__ . '/db.php';

$pdo = db_public();
if (!$pdo) json_out(['ok' => false, 'error' => 'database unavailable'], 503);

try {
    $rows = $pdo->query(
        "SELECT id, slug, name, category, lat, lng, avg_minutes, description, image_path
         FROM locations WHERE is_active = 1 ORDER BY id"
    )->fetchAll();
    json_out(['ok' => true, 'locations' => $rows]);
} catch (Throwable $e) {
    json_out(['ok' => false, 'error' => 'query failed'], 500);
}
