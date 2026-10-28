<?php
/** Saves a generated itinerary and its stops to the STAFF database.
 *  This is the data the analytics dashboard aggregates to predict which
 *  locations will be busiest at which times (requirement 8). */
require_once __DIR__ . '/db.php';

$d = json_in();
$stops = $d['stops'] ?? [];
if (!is_array($stops) || !count($stops)) json_out(['ok' => false, 'error' => 'no stops'], 422);

$pdo = db_staff();
if (!$pdo) json_out(['ok' => false, 'error' => 'database unavailable'], 503);

try {
    $pdo->beginTransaction();
    $st = $pdo->prepare(
        "INSERT INTO itineraries (visitor_name, visitor_email, visit_date, party_size, duration_hrs, doneness, arrival_mode, interests)
         VALUES (:n, :e, :d, :p, :h, :dn, :a, :i)"
    );
    $st->execute([
        'n'  => mb_substr(trim($d['name'] ?? ''), 0, 100),
        'e'  => mb_substr(trim($d['email'] ?? ''), 0, 190),
        'd'  => $d['visit_date'] ?? date('Y-m-d'),
        'p'  => max(1, min(50, (int)($d['party_size'] ?? 2))),
        'h'  => in_array((int)($d['duration'] ?? 4), [2, 4, 6]) ? (int)$d['duration'] : 4,
        'dn' => mb_substr($d['doneness'] ?? '', 0, 20),
        'a'  => ($d['arrival_mode'] ?? 'car') === 'bus' ? 'bus' : 'car',
        'i'  => mb_substr(implode(',', array_filter((array)($d['interests'] ?? []), 'is_string')), 0, 255),
    ]);
    $id = (int)$pdo->lastInsertId();
    $ss = $pdo->prepare(
        "INSERT INTO itinerary_stops (itinerary_id, location_slug, location_name, start_time, end_time)
         VALUES (:id, :slug, :name, :s, :e)"
    );
    foreach ($stops as $s) {
        if (!preg_match('/^\d{2}:\d{2}$/', $s['start_time'] ?? '') || !preg_match('/^\d{2}:\d{2}$/', $s['end_time'] ?? '')) continue;
        $ss->execute([
            'id'   => $id,
            'slug' => mb_substr($s['slug'] ?? '', 0, 50),
            'name' => mb_substr($s['name'] ?? '', 0, 120),
            's'    => $s['start_time'],
            'e'    => $s['end_time'],
        ]);
    }
    $pdo->commit();
    json_out(['ok' => true, 'itinerary_id' => $id]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    json_out(['ok' => false, 'error' => 'save failed'], 500);
}
