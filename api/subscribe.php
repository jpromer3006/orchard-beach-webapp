<?php
/** Visitor email + trip plan capture (requirement 5).
 *  Saves to the STAFF database; also appends to visitors.log as a no-MySQL
 *  fallback so no signup is ever lost during a demo. */
require_once __DIR__ . '/db.php';

$d = json_in();
$name  = trim($d['name'] ?? '');
$email = trim($d['email'] ?? '');
$date  = trim($d['visit_date'] ?? '');

if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || $date === '') {
    json_out(['ok' => false, 'error' => 'name, valid email, and visit_date are required'], 422);
}

$row = [
    'name'         => mb_substr($name, 0, 100),
    'email'        => mb_substr($email, 0, 190),
    'visit_date'   => $date,
    'start_time'   => preg_match('/^\d{2}:\d{2}$/', $d['start_time'] ?? '') ? $d['start_time'] : '10:00',
    'party_size'   => max(1, min(50, (int)($d['party_size'] ?? 2))),
    'arrival_mode' => ($d['arrival_mode'] ?? 'car') === 'bus' ? 'bus' : 'car',
    'duration_hrs' => in_array((int)($d['duration'] ?? 4), [2, 4, 6]) ? (int)$d['duration'] : 4,
    'interests'    => mb_substr(implode(',', array_filter((array)($d['interests'] ?? []), 'is_string')), 0, 255),
];

$saved = false;
$pdo = db_staff();
if ($pdo) {
    try {
        $st = $pdo->prepare(
            "INSERT INTO visitors (name, email, visit_date, start_time, party_size, arrival_mode, duration_hrs, interests)
             VALUES (:name, :email, :visit_date, :start_time, :party_size, :arrival_mode, :duration_hrs, :interests)"
        );
        $st->execute($row);
        $saved = true;
    } catch (Throwable $e) { /* fall through to log */ }
}
if (!$saved) {
    @file_put_contents(__DIR__ . '/../visitors.log',
        '[' . date('c') . '] ' . json_encode($row) . PHP_EOL, FILE_APPEND | LOCK_EX);
}
json_out(['ok' => true, 'stored' => $saved ? 'database' : 'logfile']);
