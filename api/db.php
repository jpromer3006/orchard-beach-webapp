<?php
/**
 * PDO helpers. Every endpoint degrades gracefully: if MySQL is not running
 * or the databases are not imported yet, callers get null and the front end
 * falls back to its built in data, so the site never breaks.
 */
require_once __DIR__ . '/config.php';

function db_connect(string $dbname): ?PDO {
    try {
        $pdo = new PDO(
            "mysql:host=" . DB_HOST . ";dbname={$dbname};charset=utf8mb4",
            DB_USER, DB_PASS,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
             PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
             PDO::ATTR_TIMEOUT => 2]
        );
        return $pdo;
    } catch (Throwable $e) {
        return null;
    }
}

function db_public(): ?PDO { return db_connect(DB_PUBLIC); }
function db_staff():  ?PDO { return db_connect(DB_STAFF); }

function json_out(array $data, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

function json_in(): array {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : $_POST;
}
