<?php
/** VISITOR PHOTO / PDF SUBMISSIONS (v2.1).
 *  Accepts one image (JPEG, PNG, WebP) or PDF up to 10 MB, stores it in
 *  uploads/submissions/ with a random name, and queues it as "pending" in
 *  the STAFF database for Parks staff to review in the Staff View.
 *  Nothing a visitor uploads is ever shown publicly without staff approval.
 */
require_once __DIR__ . '/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST' || empty($_FILES['file'])) {
    json_out(['ok' => false, 'error' => 'no file'], 422);
}

$f = $_FILES['file'];
if ($f['error'] !== UPLOAD_ERR_OK) json_out(['ok' => false, 'error' => 'upload error ' . $f['error']], 422);
if ($f['size'] > 10 * 1024 * 1024) json_out(['ok' => false, 'error' => 'file too large (10 MB max)'], 422);

// validate the REAL mime type, never trust the extension
$allowed = [
    'image/jpeg' => 'jpg',
    'image/png'  => 'png',
    'image/webp' => 'webp',
    'application/pdf' => 'pdf',
];
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = $finfo->file($f['tmp_name']);
if (!isset($allowed[$mime])) json_out(['ok' => false, 'error' => 'only JPEG, PNG, WebP, or PDF'], 422);

$dir = __DIR__ . '/../uploads/submissions';
if (!is_dir($dir) && !mkdir($dir, 0775, true)) json_out(['ok' => false, 'error' => 'storage unavailable'], 500);

$fname = date('Ymd-His') . '-' . bin2hex(random_bytes(6)) . '.' . $allowed[$mime];
if (!move_uploaded_file($f['tmp_name'], $dir . '/' . $fname)) {
    json_out(['ok' => false, 'error' => 'could not save file'], 500);
}
$relPath = 'uploads/submissions/' . $fname;

$caption = mb_substr(trim($_POST['caption'] ?? ''), 0, 255);
$name    = mb_substr(trim($_POST['name'] ?? ''), 0, 100);
$email   = mb_substr(trim($_POST['email'] ?? ''), 0, 190);

$queued = false;
if ($pdo = db_staff()) {
    try {
        $pdo->prepare(
            "INSERT INTO submissions (file_path, mime_type, caption, visitor_name, visitor_email, status)
             VALUES (?, ?, ?, ?, ?, 'pending')"
        )->execute([$relPath, $mime, $caption, $name, $email]);
        $queued = true;
    } catch (Throwable $e) { /* log fallback below */ }
}
if (!$queued) {
    @file_put_contents(__DIR__ . '/../submissions.log',
        '[' . date('c') . '] ' . json_encode(compact('relPath', 'mime', 'caption', 'name', 'email')) . PHP_EOL,
        FILE_APPEND | LOCK_EX);
}

json_out(['ok' => true, 'queued' => $queued ? 'database' : 'logfile']);
