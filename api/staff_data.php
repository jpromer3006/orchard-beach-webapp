<?php
/** Staff data endpoints.
 *  Public (no session):  active_alert, set_flag, post_alert (quick panel).
 *  Session protected:    analytics, visitors, chatlog, csv export (staff.php).
 */
session_start();
require_once __DIR__ . '/db.php';

$action = $_GET['action'] ?? '';
$pdo = db_staff();

/* -------- endpoints the public page uses (quick staff panel + banner) ---- */
if ($action === 'active_alert') {
    if (!$pdo) json_out(['ok' => false], 503);
    try {
        $row = $pdo->query("SELECT message FROM alerts WHERE is_active = 1 ORDER BY id DESC LIMIT 1")->fetch();
        json_out(['ok' => true, 'alert' => $row['message'] ?? null]);
    } catch (Throwable $e) { json_out(['ok' => false], 500); }
}

if ($action === 'set_flag') {
    if (!$pdo) json_out(['ok' => false], 503);
    $d = json_in();
    $state = in_array($d['state'] ?? '', ['green', 'yellow', 'red']) ? $d['state'] : 'green';
    try {
        $pdo->prepare("UPDATE beach_flags SET state = ? WHERE section_key = ?")
            ->execute([$state, mb_substr($d['section'] ?? '', 0, 20)]);
        json_out(['ok' => true]);
    } catch (Throwable $e) { json_out(['ok' => false], 500); }
}

if ($action === 'post_alert') {
    if (!$pdo) json_out(['ok' => false], 503);
    $d = json_in();
    $msg = trim($d['message'] ?? '');
    if ($msg === '') json_out(['ok' => false, 'error' => 'empty'], 422);
    try {
        $pdo->exec("UPDATE alerts SET is_active = 0");
        $pdo->prepare("INSERT INTO alerts (message) VALUES (?)")->execute([mb_substr($msg, 0, 255)]);
        json_out(['ok' => true]);
    } catch (Throwable $e) { json_out(['ok' => false], 500); }
}

if ($action === 'clear_alert') {
    if (!$pdo) json_out(['ok' => false], 503);
    try { $pdo->exec("UPDATE alerts SET is_active = 0"); json_out(['ok' => true]); }
    catch (Throwable $e) { json_out(['ok' => false], 500); }
}

/* ---------------- everything below requires a staff session ------------- */
if (empty($_SESSION['staff_user'])) json_out(['ok' => false, 'error' => 'not authenticated'], 401);
if (!$pdo) json_out(['ok' => false, 'error' => 'staff database unavailable'], 503);

if ($action === 'analytics') {
    $date = preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['date'] ?? '') ? $_GET['date'] : date('Y-m-d');
    try {
        // expected people per location per hour, from saved itinerary stops
        $st = $pdo->prepare(
            "SELECT s.location_slug, s.location_name, HOUR(s.start_time) AS start_h, HOUR(s.end_time) AS end_h,
                    MINUTE(s.end_time) AS end_m, i.party_size
             FROM itinerary_stops s JOIN itineraries i ON i.id = s.itinerary_id
             WHERE i.visit_date = ?"
        );
        $st->execute([$date]);
        $byLocHour = [];   // slug -> hour -> expected people
        $names = [];
        foreach ($st->fetchAll() as $r) {
            $names[$r['location_slug']] = $r['location_name'];
            $endH = (int)$r['end_h'] + ((int)$r['end_m'] > 0 ? 1 : 0);
            for ($h = (int)$r['start_h']; $h < max($endH, (int)$r['start_h'] + 1); $h++) {
                $byLocHour[$r['location_slug']][$h] = ($byLocHour[$r['location_slug']][$h] ?? 0) + (int)$r['party_size'];
            }
        }
        $totals = $pdo->prepare(
            "SELECT COUNT(*) AS itineraries, COALESCE(SUM(party_size),0) AS people,
                    COALESCE(AVG(duration_hrs),0) AS avg_hours
             FROM itineraries WHERE visit_date = ?"
        );
        $totals->execute([$date]);
        $vc = $pdo->query("SELECT COUNT(*) AS c FROM visitors")->fetch();
        json_out([
            'ok' => true, 'date' => $date,
            'by_location_hour' => $byLocHour, 'location_names' => $names,
            'totals' => $totals->fetch(), 'visitor_count' => (int)($vc['c'] ?? 0),
        ]);
    } catch (Throwable $e) { json_out(['ok' => false, 'error' => 'analytics failed'], 500); }
}

if ($action === 'visitors') {
    try {
        $rows = $pdo->query(
            "SELECT name, email, visit_date, start_time, party_size, arrival_mode, duration_hrs, interests, created_at
             FROM visitors ORDER BY visit_date DESC, created_at DESC LIMIT 200"
        )->fetchAll();
        json_out(['ok' => true, 'visitors' => $rows]);
    } catch (Throwable $e) { json_out(['ok' => false], 500); }
}

if ($action === 'visitors_csv') {
    header('Content-Type: text/csv');
    header('Content-Disposition: attachment; filename="orchard_beach_visitors.csv"');
    $out = fopen('php://output', 'w');
    fputcsv($out, ['name', 'email', 'visit_date', 'start_time', 'party_size', 'arrival_mode', 'duration_hrs', 'interests', 'created_at']);
    try {
        foreach ($pdo->query("SELECT name, email, visit_date, start_time, party_size, arrival_mode, duration_hrs, interests, created_at FROM visitors ORDER BY visit_date DESC") as $r) {
            fputcsv($out, $r);
        }
    } catch (Throwable $e) {}
    fclose($out);
    exit;
}

if ($action === 'chatlog') {
    try {
        $rows = $pdo->query("SELECT question, answered_by, created_at FROM chat_log ORDER BY id DESC LIMIT 50")->fetchAll();
        json_out(['ok' => true, 'chatlog' => $rows]);
    } catch (Throwable $e) { json_out(['ok' => false], 500); }
}

if ($action === 'submissions') {
    try {
        $rows = $pdo->query(
            "SELECT id, file_path, mime_type, caption, visitor_name, visitor_email, status, slot, display_title, created_at
             FROM submissions ORDER BY (status = 'pending') DESC, id DESC LIMIT 100"
        )->fetchAll();
        json_out(['ok' => true, 'submissions' => $rows]);
    } catch (Throwable $e) { json_out(['ok' => false], 500); }
}

if ($action === 'review_submission') {
    $d = json_in();
    $id = (int)($d['id'] ?? 0);
    $status = in_array($d['status'] ?? '', ['approved', 'rejected']) ? $d['status'] : null;
    if (!$id || !$status) json_out(['ok' => false, 'error' => 'id and status required'], 422);
    // v2.2: approving publishes to the public gallery. Staff picks the tile
    // slot (1 = large feature, 2-5 = small tiles) and names it; each slot
    // holds at most 5 images (they cycle as a slideshow on the site).
    $slot  = (int)($d['slot'] ?? 0);
    $title = mb_substr(trim($d['title'] ?? ''), 0, 120);
    if ($status === 'approved') {
        if ($slot < 1 || $slot > 5) json_out(['ok' => false, 'error' => 'pick a gallery spot (1-5)'], 422);
        try {
            $c = $pdo->prepare("SELECT COUNT(*) AS c FROM submissions WHERE status='approved' AND slot=? AND id<>?");
            $c->execute([$slot, $id]);
            if ((int)$c->fetch()['c'] >= 5) {
                json_out(['ok' => false, 'error' => 'that spot already has 5 photos (slideshow max). Pick another spot or reject one first.'], 422);
            }
        } catch (Throwable $e) { json_out(['ok' => false], 500); }
    }
    try {
        $pdo->prepare("UPDATE submissions SET status = ?, slot = ?, display_title = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?")
            ->execute([$status, $status === 'approved' ? $slot : null,
                       $title !== '' ? $title : null, $_SESSION['staff_user'], $id]);
        json_out(['ok' => true]);
    } catch (Throwable $e) { json_out(['ok' => false], 500); }
}

if ($action === 'flags') {
    try {
        $rows = $pdo->query("SELECT section_key, section_name, state, updated_at FROM beach_flags")->fetchAll();
        json_out(['ok' => true, 'flags' => $rows]);
    } catch (Throwable $e) { json_out(['ok' => false], 500); }
}

json_out(['ok' => false, 'error' => 'unknown action'], 400);
