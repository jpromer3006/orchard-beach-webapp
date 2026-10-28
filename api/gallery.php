<?php
/** PUBLIC GALLERY FEED (v2.2).
 *  Returns the staff-approved visitor photos for the "Share Your
 *  Experience" gallery, grouped into the five tile slots:
 *    slot 1 = the large feature tile, slots 2-5 = the small tiles.
 *  A slot may hold up to 5 images; the front end cycles multiples as a
 *  slideshow. Only images (never PDFs) and only status='approved' rows
 *  are ever exposed — visitors' emails are NOT included.
 *  No session required: this is read-only, curated-by-staff content.
 */
require_once __DIR__ . '/db.php';

$pdo = db_staff();
if (!$pdo) json_out(['ok' => false, 'error' => 'unavailable'], 503);

try {
    $rows = $pdo->query(
        "SELECT slot, display_title, file_path, caption
         FROM submissions
         WHERE status = 'approved'
           AND slot BETWEEN 1 AND 5
           AND mime_type LIKE 'image/%'
         ORDER BY slot ASC, reviewed_at DESC, id DESC"
    )->fetchAll();

    $slots = [];
    foreach ($rows as $r) {
        $slot = (int)$r['slot'];
        if (!isset($slots[$slot])) {
            $slots[$slot] = ['title' => $r['display_title'] ?: ($r['caption'] ?: 'Visitor photo'),
                             'images' => []];
        }
        if (count($slots[$slot]['images']) < 5) {          // slideshow cap: 5 per slot
            $slots[$slot]['images'][] = $r['file_path'];
        }
        // newest approval's title wins if staff renamed the slot later
        if ($r['display_title'] && count($slots[$slot]['images']) === 1) {
            $slots[$slot]['title'] = $r['display_title'];
        }
    }
    json_out(['ok' => true, 'slots' => $slots]);
} catch (Throwable $e) {
    json_out(['ok' => false, 'error' => 'gallery query failed'], 500);
}
