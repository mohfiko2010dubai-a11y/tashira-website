# NEXT TASK 2 — iPhone document upload verification

## Finding and change

The current wizard already accepted HEIC/HEIF, allowed 20 MiB, converted HEIF server-side, compressed large images, and exposed upload progress and retry. The remaining defect was trusting the browser MIME before reading the content: an unexpected MIME could reject a valid iPhone file or select the wrong decoder.

The server now identifies PDF/JPEG/PNG/HEIF from bytes. HEIF identification parses ISO-BMFF file-type brands, rejecting unsupported AVIF and arbitrary embedded brand text. The complete image decoder still validates the payload. Browser MIME/extension are hints for actionable error wording only. The client accepts known filename extensions when the browser supplies an unknown MIME; the server remains authoritative.

No dependencies, business rules, required documents, or visual layout changed. Existing worker limits, ownership checks and storage isolation remain in place. Converted JPEG is stored; the HEIF original is not retained.

## Orientation and metadata

The existing HEIF decoder applies container orientation before producing raw pixels. Three generated fixtures exercise landscape and both portrait rotations. Tests check dimensions AND colored corners, then assert the converted JPEG has no EXIF, XMP or orientation tag. No extra rotation was added, which would risk double-rotating already oriented HEIF pixels. These are synthetic fixtures, not a physical iPhone camera test.

## Local quality

- TypeScript project build, ESLint, complete client/server/API build and asset/compliance checks pass.
- 1023 tests pass; 26 environment-gated skips unchanged.
- Real HEIF decodes with empty, octet-stream, unexpected and misleading MIME, even without a filename extension at the server boundary.
- A generated JPEG over 15 MiB compresses below 3 MiB.
- Unsupported, malformed, empty, oversize and mismatched payloads reject explicitly before storage.

## Manual browser checks

1. Open `/en/apply`, select a single Egyptian traveller resident in Oman, enter synthetic contact details, and continue.
2. Check the upload helper lists PDF, JPG, PNG, HEIC and HEIF, up to 20 MB per file.
3. Upload HEIC to passport and HEIF to personal photo. Check per-file upload/processing status followed by Uploaded.
4. Upload a 15–20 MB JPEG to the residence slot. It should upload successfully and store a compressed JPEG.
5. Select a DOCX or malformed HEIC. The slot shows explicit guidance; malformed HEIC gives the exact iPhone Most Compatible instructions.
6. Interrupt the upload connection and restore it. Retry upload sends the selected file again and completes.
7. Complete traveller details, save and continue. Review/payment link appears after the required uploads; reload retains them. Arabic helper uses the same formats and limit.

## Staging evidence

Deployed 4305032546f616f9ea92c9d23b9047664e73c99a. Guard check/lint/test/build PASS; 1023 tests pass, 26 gated skips; local/public health 200. Live synthetic EG/OM application TSH-MU088W26-D5A5A3: unexpected-MIME HEIC landscape and empty-MIME HEIF portrait stored as readable, correctly oriented JPEGs without EXIF or HEIF originals. JPEG input 18,147,254 bytes stored as 1,815,328 bytes. DOCX and corrupt HEIC show guidance; intentionally aborted upload recovers using Retry. Actual upload/processing states observed. Required uploads persist across reload and allow review/payment link; EN/AR helper matches. See NEXT2_IPHONE_UPLOAD_UAT.json.

The first deployment stopped before activation because the server disk was full. Removed only node_modules in three obsolete isolated staging build directories, freeing 2,420,817,920 bytes. Sources, active runtime, backups and documents retained. Retried the full guard successfully; no quality gate bypass. Production and the fifteen unrelated dirty files remain untouched.
