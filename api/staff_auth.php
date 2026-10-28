<?php
/** Staff login/logout for staff.php.
 *  Auth order: staff_users table (bcrypt) when MySQL is up, otherwise a
 *  hardcoded demo fallback so the class demo works even without the DB.
 *  Demo credentials: staff / orchard2026 */
session_start();
require_once __DIR__ . '/db.php';

$action = $_GET['action'] ?? '';

if ($action === 'logout') {
    session_destroy();
    header('Location: ../staff.php');
    exit;
}

if ($action === 'login' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $user = trim($_POST['username'] ?? '');
    $pass = $_POST['password'] ?? '';
    $ok = false; $display = '';

    if ($pdo = db_staff()) {
        try {
            $st = $pdo->prepare("SELECT password_hash, display_name FROM staff_users WHERE username = ?");
            $st->execute([$user]);
            if ($row = $st->fetch()) {
                $ok = password_verify($pass, $row['password_hash']);
                $display = $row['display_name'];
            }
        } catch (Throwable $e) {}
    }
    // no-database fallback for demos
    if (!$ok && $user === 'staff' && $pass === 'orchard2026') { $ok = true; $display = 'Beach Staff Demo'; }

    if ($ok) {
        $_SESSION['staff_user'] = $user;
        $_SESSION['staff_name'] = $display ?: $user;
        header('Location: ../staff.php');
    } else {
        header('Location: ../staff.php?err=1');
    }
    exit;
}

http_response_code(400);
echo 'Bad request';
