<?php
/** NEARBY SEARCH TOOL for the Beach Concierge (v2.1).
 *  GET ?type=eat|do  ->  family appropriate places to eat or things to do
 *  near Orchard Beach but OUTSIDE the park, within a 20 mile radius.
 *
 *  Three tiers, best available wins:
 *    1. Google Places Text Search  (GOOGLE_PLACES_API_KEY in config.php)
 *    2. Yelp Fusion                (YELP_API_KEY in config.php)
 *    3. Curated list               (no keys needed, mirrors js/concierge.js)
 *
 *  Ethics by design: results are filtered to family friendly categories.
 *  Bars, nightlife, casinos, and adult venues are excluded regardless of
 *  which provider answers. Results are cached for 6 hours.
 */
require_once __DIR__ . '/db.php';

const OB_LAT = 40.8673;
const OB_LNG = -73.7925;
const RADIUS_M = 32187; // 20 miles

$type = ($_GET['type'] ?? 'eat') === 'do' ? 'do' : 'eat';
$cacheFile = sys_get_temp_dir() . "/ob_nearby_{$type}.json";
if (is_file($cacheFile) && (time() - filemtime($cacheFile)) < 21600) {
    header('Content-Type: application/json');
    readfile($cacheFile);
    exit;
}

$blockWords = ['bar', 'nightclub', 'night_club', 'casino', 'adult', 'liquor', 'hookah', 'strip', 'cannabis', 'smoke'];
function is_family_ok(string $blob, array $blockWords): bool {
    foreach ($blockWords as $w) if (stripos($blob, $w) !== false) return false;
    return true;
}

function http_get(string $url, array $headers = []): ?array {
    if (!function_exists('curl_init')) return null;
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_USERAGENT => 'OrchardBeachWebApp (Fordham student project)',
    ]);
    $res = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($res === false || $code !== 200) return null;
    $j = json_decode($res, true);
    return is_array($j) ? $j : null;
}

$places = [];
$source = 'curated';

/* ---- Tier 1: Google Places ---- */
if (GOOGLE_PLACES_API_KEY !== '') {
    $query = $type === 'eat' ? 'family restaurants' : 'family attractions museums parks';
    $j = http_get('https://maps.googleapis.com/maps/api/place/textsearch/json?query=' . urlencode($query) .
        '&location=' . OB_LAT . ',' . OB_LNG . '&radius=' . RADIUS_M . '&key=' . GOOGLE_PLACES_API_KEY);
    if ($j && !empty($j['results'])) {
        foreach ($j['results'] as $r) {
            $blob = strtolower(($r['name'] ?? '') . ' ' . implode(' ', $r['types'] ?? []));
            if (!is_family_ok($blob, $blockWords)) continue;
            // skip anything inside the park itself: the beach is the destination, this tool is for beyond it
            if (stripos($r['name'] ?? '', 'orchard beach') !== false) continue;
            $places[] = [
                'name' => $r['name'] ?? '',
                'area' => $r['formatted_address'] ?? '',
                'dist' => null,
                'desc' => ($r['rating'] ?? null) ? ('Google rating ' . $r['rating'] . ' (' . ($r['user_ratings_total'] ?? 0) . ' reviews)') : '',
            ];
            if (count($places) >= 8) break;
        }
        if ($places) $source = 'Google Places';
    }
}

/* ---- Tier 2: Yelp Fusion ---- */
if (!$places && YELP_API_KEY !== '') {
    $cats = $type === 'eat' ? 'restaurants,icecream,bakeries' : 'active,arts,museums,gardens,mini_golf,kids_activities';
    $j = http_get('https://api.yelp.com/v3/businesses/search?latitude=' . OB_LAT . '&longitude=' . OB_LNG .
        '&radius=' . min(RADIUS_M, 40000) . '&categories=' . urlencode($cats) . '&limit=10&sort_by=rating',
        ['Authorization: Bearer ' . YELP_API_KEY]);
    if ($j && !empty($j['businesses'])) {
        foreach ($j['businesses'] as $b) {
            $blob = strtolower(($b['name'] ?? '') . ' ' . json_encode($b['categories'] ?? []));
            if (!is_family_ok($blob, $blockWords)) continue;
            if (stripos($b['name'] ?? '', 'orchard beach') !== false) continue;
            $places[] = [
                'name' => $b['name'] ?? '',
                'area' => $b['location']['city'] ?? '',
                'dist' => isset($b['distance']) ? round($b['distance'] / 1609, 1) . ' mi' : null,
                'desc' => ($b['rating'] ?? null) ? ('Yelp rating ' . $b['rating'] . ' (' . ($b['review_count'] ?? 0) . ' reviews)') : '',
            ];
            if (count($places) >= 8) break;
        }
        if ($places) $source = 'Yelp';
    }
}

/* ---- Tier 3: curated (always available, mirrors js/concierge.js) ---- */
if (!$places) {
    $curated = [
        'eat' => [
            ['name' => "Johnny's Reef Restaurant", 'area' => 'City Island', 'dist' => '1.5 mi', 'desc' => 'Counter service seafood at the tip of City Island, outdoor tables over the water.'],
            ['name' => 'The Original Crab Shanty', 'area' => 'City Island', 'dist' => '1.3 mi', 'desc' => 'Big family seafood feasts, bibs included.'],
            ['name' => 'Lickety Split Ice Cream', 'area' => 'City Island', 'dist' => '1.4 mi', 'desc' => 'Classic scoop shop for the ride home.'],
            ['name' => "Louie & Ernie's Pizza", 'area' => 'Schuylerville, Bronx', 'dist' => '3.5 mi', 'desc' => 'Legendary thin crust slices, worth the detour.'],
            ['name' => 'Havana Café', 'area' => 'East Tremont, Bronx', 'dist' => '4 mi', 'desc' => 'Cuban and Latin plates, lively and family friendly.'],
        ],
        'do' => [
            ['name' => 'Turtle Cove Golf Center', 'area' => 'Pelham Bay Park edge', 'dist' => '1.2 mi', 'desc' => 'Driving range, mini golf, and batting cages by the lagoon.'],
            ['name' => 'Bartow-Pell Mansion Museum', 'area' => 'Pelham Bay Park', 'dist' => '1.6 mi', 'desc' => '1840s mansion, gardens, and carriage house tours.'],
            ['name' => 'City Island Nautical Museum', 'area' => 'City Island', 'dist' => '1.7 mi', 'desc' => "The island's seafaring history in an old schoolhouse."],
            ['name' => 'Glen Island Park', 'area' => 'New Rochelle', 'dist' => '4.5 mi', 'desc' => 'Waterfront county park with a castle and picnic lawns.'],
            ['name' => 'Bronx Zoo', 'area' => 'Bronx Park', 'dist' => '7 mi', 'desc' => 'One of the world\'s great zoos, easy drive down the Pelham Parkway.'],
            ['name' => 'New York Botanical Garden', 'area' => 'Bronx Park', 'dist' => '7.5 mi', 'desc' => '250 acres of gardens and the landmark conservatory.'],
        ],
    ];
    $places = $curated[$type];
}

$payload = json_encode(['ok' => true, 'type' => $type, 'source' => $source, 'places' => $places]);
@file_put_contents($cacheFile, $payload);
header('Content-Type: application/json');
echo $payload;
