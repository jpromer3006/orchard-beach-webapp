<?php
/** AI Chatbot Concierge backend (requirement 7).
 *  GET  -> reports whether an Anthropic API key is configured, so the front
 *          end knows to run in "AI powered" or "local knowledge base" mode.
 *  POST -> if a key is set, answers the visitor's question with Claude,
 *          grounded in the locations database (the chatbot "pulls from" the
 *          pictures and mapping database, requirement 6). Every question is
 *          also logged to chat_log so staff can see what visitors ask. */
require_once __DIR__ . '/db.php';

$hasKey = defined('ANTHROPIC_API_KEY') && ANTHROPIC_API_KEY !== '';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    json_out(['ok' => true, 'ai_available' => $hasKey]);
}

$d = json_in();
$question = trim($d['question'] ?? '');
if ($question === '') json_out(['ok' => false, 'error' => 'empty question'], 422);

// log the question for staff analytics (best effort)
if ($staff = db_staff()) {
    try {
        $staff->prepare("INSERT INTO chat_log (question, answered_by) VALUES (?, ?)")
              ->execute([mb_substr($question, 0, 2000), $hasKey ? 'ai' : 'local']);
    } catch (Throwable $e) {}
}

if (!$hasKey) json_out(['ok' => true, 'local' => true]);

// ---- ground the model in the locations database ----
$kb = [];
if ($pub = db_public()) {
    try {
        $kb = $pub->query("SELECT name, category, description, avg_minutes FROM locations WHERE is_active = 1")->fetchAll();
    } catch (Throwable $e) {}
}
$context = $d['context'] ?? [];

$system = "You are the Beach Concierge for Orchard Beach in Pelham Bay Park, the Bronx (the Bronx Riviera). "
    . "Answer briefly and warmly, in the language the visitor writes in. Facts you can rely on: "
    . "115 acres, 1.1 mile crescent beach on Long Island Sound. Season: Memorial Day weekend through the Sunday after Labor Day. "
    . "Lifeguards daily 10 AM to 6 PM; swimming only when lifeguards are on duty. "
    . "Parking: cars \$10 weekdays, \$12 weekends/holidays, buses \$15, seniors 65+ \$6 weekdays. "
    . "Transit: Bx12 bus on summer weekends from the Pelham Bay Park 6 train station. "
    . "Rules: no alcohol or glass, no pets on sand, barbecue only in designated picnic areas. "
    . "Official rules: https://www.nycgovparks.org/rules/orchard-beach . "
    . "Locations database: " . json_encode($kb) . " "
    . "Live page context (weather, events): " . json_encode($context) . " "
    . "If asked to plan a day, suggest they say 'plan my day' so the itinerary builder opens.";

$payload = json_encode([
    'model' => ANTHROPIC_MODEL,
    'max_tokens' => 400,
    'system' => $system,
    'messages' => [['role' => 'user', 'content' => $question]],
]);

$ch = curl_init('https://api.anthropic.com/v1/messages');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_TIMEOUT => 20,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'x-api-key: ' . ANTHROPIC_API_KEY,
        'anthropic-version: 2023-06-01',
    ],
]);
$res  = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($res === false || $code !== 200) json_out(['ok' => false, 'error' => 'AI request failed'], 502);
$j = json_decode($res, true);
$answer = $j['content'][0]['text'] ?? null;
if (!$answer) json_out(['ok' => false, 'error' => 'empty AI response'], 502);
json_out(['ok' => true, 'answer' => $answer]);
