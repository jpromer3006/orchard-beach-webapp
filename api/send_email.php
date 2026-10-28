<?php
/** Real email sending for itineraries ("Both" option).
 *  If SMTP_USER is configured in config.php, this endpoint sends the
 *  itinerary through Gmail SMTP using PHPMailer when available, or a
 *  minimal built in SMTP client otherwise. If SMTP is NOT configured it
 *  returns sent:false and the front end falls back to the .ics download
 *  plus a prefilled mail draft, which needs no setup at all. */
require_once __DIR__ . '/db.php';

$d = json_in();
$to      = trim($d['to'] ?? '');
$subject = trim($d['subject'] ?? 'Your Orchard Beach itinerary');
$body    = (string)($d['body'] ?? '');

if (!filter_var($to, FILTER_VALIDATE_EMAIL) || $body === '') {
    json_out(['ok' => false, 'sent' => false, 'error' => 'valid to + body required'], 422);
}

if (SMTP_USER === '' || SMTP_PASS === '') {
    // not configured: tell the front end to use the mailto/.ics fallback
    json_out(['ok' => true, 'sent' => false, 'reason' => 'smtp not configured']);
}

/* ---- Preferred: PHPMailer, if installed via composer ---- */
$autoload = __DIR__ . '/../vendor/autoload.php';
if (is_file($autoload)) {
    require $autoload;
    try {
        $mail = new PHPMailer\PHPMailer\PHPMailer(true);
        $mail->isSMTP();
        $mail->Host = SMTP_HOST; $mail->Port = SMTP_PORT;
        $mail->SMTPAuth = true; $mail->SMTPSecure = 'tls';
        $mail->Username = SMTP_USER; $mail->Password = SMTP_PASS;
        $mail->setFrom(SMTP_USER, SMTP_FROM_NAME);
        $mail->addAddress($to);
        $mail->Subject = $subject;
        $mail->Body = $body;
        $mail->send();
        json_out(['ok' => true, 'sent' => true, 'via' => 'phpmailer']);
    } catch (Throwable $e) {
        json_out(['ok' => false, 'sent' => false, 'error' => 'phpmailer failed'], 502);
    }
}

/* ---- Fallback: minimal STARTTLS SMTP client (no dependencies) ---- */
function smtp_cmd($fp, string $cmd, array $expect): bool {
    if ($cmd !== '') fwrite($fp, $cmd . "\r\n");
    $line = '';
    do { $line = fgets($fp, 512); } while ($line !== false && isset($line[3]) && $line[3] === '-');
    if ($line === false) return false;
    return in_array((int)substr($line, 0, 3), $expect, true);
}

$fp = @stream_socket_client('tcp://' . SMTP_HOST . ':' . SMTP_PORT, $en, $es, 10);
if (!$fp) json_out(['ok' => false, 'sent' => false, 'error' => 'smtp connect failed'], 502);
stream_set_timeout($fp, 10);

$okFlow =
    smtp_cmd($fp, '', [220]) &&
    smtp_cmd($fp, 'EHLO orchardbeach.local', [250]) &&
    smtp_cmd($fp, 'STARTTLS', [220]) &&
    stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT) &&
    smtp_cmd($fp, 'EHLO orchardbeach.local', [250]) &&
    smtp_cmd($fp, 'AUTH LOGIN', [334]) &&
    smtp_cmd($fp, base64_encode(SMTP_USER), [334]) &&
    smtp_cmd($fp, base64_encode(SMTP_PASS), [235]) &&
    smtp_cmd($fp, 'MAIL FROM:<' . SMTP_USER . '>', [250]) &&
    smtp_cmd($fp, 'RCPT TO:<' . $to . '>', [250, 251]) &&
    smtp_cmd($fp, 'DATA', [354]);

if ($okFlow) {
    $headers = "From: " . SMTP_FROM_NAME . " <" . SMTP_USER . ">\r\n" .
               "To: <{$to}>\r\n" .
               "Subject: " . mb_encode_mimeheader($subject, 'UTF-8') . "\r\n" .
               "MIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n";
    $data = $headers . "\r\n" . str_replace("\n.", "\n..", $body) . "\r\n.";
    $okFlow = smtp_cmd($fp, $data, [250]);
    smtp_cmd($fp, 'QUIT', [221]);
}
fclose($fp);

if ($okFlow) json_out(['ok' => true, 'sent' => true, 'via' => 'builtin-smtp']);
json_out(['ok' => false, 'sent' => false, 'error' => 'smtp send failed'], 502);
