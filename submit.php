<?php
/**
 * Optional question handler for the Orchard Beach prototype.
 * Works out of the box in XAMPP (Apache + PHP). No database or mail setup required.
 * It validates input and appends the question to questions.log, then returns JSON.
 * The front end also works without this file: if PHP is unavailable it shows a
 * client side confirmation instead.
 */
header("Content-Type: application/json");

$raw  = file_get_contents("php://input");
$data = json_decode($raw, true);
if (!is_array($data)) { $data = $_POST; }

$name    = trim($data["name"]    ?? "");
$email   = trim($data["email"]   ?? "");
$topic   = trim($data["topic"]   ?? "");
$message = trim($data["message"] ?? "");

if ($name === "" || !filter_var($email, FILTER_VALIDATE_EMAIL) || $message === "") {
    http_response_code(422);
    echo json_encode(["ok" => false, "message" => "Please provide a name, a valid email, and a message."]);
    exit;
}

$line = sprintf("[%s] %s <%s> | %s | %s\n",
    date("c"),
    str_replace(["\n", "\r"], " ", $name),
    $email,
    str_replace(["\n", "\r"], " ", $topic),
    str_replace(["\n", "\r"], " ", $message)
);
@file_put_contents(__DIR__ . "/questions.log", $line, FILE_APPEND | LOCK_EX);

echo json_encode([
    "ok" => true,
    "message" => "Thank you. Your question has been received. Beach staff would follow up by email."
]);
