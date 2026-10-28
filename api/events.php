<?php
/** LIVE EVENTS (requirement 3).
 *  Browsers cannot read nycgovparks.org directly (CORS), so this endpoint
 *  fetches the official NYC Parks events RSS feed server side, filters it to
 *  Pelham Bay Park / Orchard Beach, caches the result for 30 minutes, and
 *  returns clean JSON. If the feed is unreachable the front end shows its
 *  labeled sample schedule instead, so the page never breaks. */
require_once __DIR__ . '/db.php';

const FEED_URLS = [
    'https://www.nycgovparks.org/xml/events_rss.xml',
    'https://www.nycgovparks.org/common/xml/events_rss.xml',
];
$cacheFile = sys_get_temp_dir() . '/ob_events_cache.json';
$cacheTtl  = 1800; // 30 minutes

// serve fresh cache if we have it
if (is_file($cacheFile) && (time() - filemtime($cacheFile)) < $cacheTtl) {
    header('Content-Type: application/json');
    readfile($cacheFile);
    exit;
}

function fetch_url(string $url): ?string {
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT => 8,
            CURLOPT_USERAGENT => 'Mozilla/5.0 (OrchardBeachWebApp; Fordham student project)',
        ]);
        $body = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($body !== false && $code >= 200 && $code < 300) return $body;
        return null;
    }
    $ctx = stream_context_create(['http' => ['timeout' => 8, 'user_agent' => 'Mozilla/5.0 (OrchardBeachWebApp)']]);
    $body = @file_get_contents($url, false, $ctx);
    return $body === false ? null : $body;
}

$events = [];
foreach (FEED_URLS as $feed) {
    $xmlRaw = fetch_url($feed);
    if (!$xmlRaw) continue;
    $xml = @simplexml_load_string($xmlRaw, 'SimpleXMLElement', LIBXML_NOCDATA);
    if (!$xml || !isset($xml->channel->item)) continue;

    $bronxPool = []; // second ring: elsewhere in the Bronx, used if the park itself is quiet
    foreach ($xml->channel->item as $item) {
        $title = trim((string)$item->title);
        $desc  = trim(strip_tags((string)$item->description));
        $link  = trim((string)$item->link);
        $blob  = strtolower($title . ' ' . $desc . ' ' . $link);
        // nearest first: events at our park; Bronx-wide events are kept as backup
        $atPark  = strpos($blob, 'orchard beach') !== false || strpos($blob, 'pelham bay') !== false;
        $inBronx = strpos($blob, 'bronx') !== false || strpos($blob, 'city island') !== false;
        if (!$atPark && !$inBronx) continue;

        // best effort date: RSS pubDate, or a date inside the description
        $date = null;
        if (!empty($item->pubDate)) {
            $ts = strtotime((string)$item->pubDate);
            if ($ts) $date = date('Y-m-d', $ts);
        }
        if (!$date && preg_match('/(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}/i', $desc, $m)) {
            $ts = strtotime($m[0]);
            if ($ts) $date = date('Y-m-d', $ts);
        }
        $tag = 'NYC Parks';
        foreach (['concert' => 'Music', 'music' => 'Music', 'nature' => 'Nature', 'hike' => 'Nature',
                  'ranger' => 'Nature', 'sport' => 'Sports', 'fitness' => 'Sports', 'kids' => 'Family',
                  'family' => 'Family', 'clean' => 'Community', 'volunteer' => 'Community'] as $kw => $label) {
            if (strpos($blob, $kw) !== false) { $tag = $label; break; }
        }
        $row = [
            'title'    => $title,
            'date'     => $date ?: date('Y-m-d'),
            'link'     => $link,
            'location' => (strpos($blob, 'orchard beach') !== false) ? 'Orchard Beach'
                        : ($atPark ? 'Pelham Bay Park' : 'Elsewhere in the Bronx'),
            'tag'      => $tag,
        ];
        if ($atPark) $events[] = $row; else $bronxPool[] = $row;
    }
    // if the park itself has a quiet week, fill in with the nearest Bronx events
    if (count($events) < 5 && $bronxPool) {
        $events = array_merge($events, array_slice($bronxPool, 0, 8 - count($events)));
    }
    if ($events) break;
}

/* THIS WEEK first (all event categories are already included): events dated
   within the next 7 days lead; later-dated events follow, each group by date. */
$today = date('Y-m-d');
$weekEnd = date('Y-m-d', strtotime('+7 days'));
usort($events, function ($a, $b) use ($today, $weekEnd) {
    $aw = ($a['date'] >= $today && $a['date'] <= $weekEnd) ? 0 : 1;
    $bw = ($b['date'] >= $today && $b['date'] <= $weekEnd) ? 0 : 1;
    return $aw === $bw ? strcmp($a['date'], $b['date']) : $aw - $bw;
});

$payload = json_encode(['ok' => count($events) > 0, 'events' => array_slice($events, 0, 12), 'fetched_at' => date('c')]);
@file_put_contents($cacheFile, $payload);
header('Content-Type: application/json');
echo $payload;
