# Publishing real customer testimonials

The website reads `src/data/testimonials.json`. It intentionally starts as an empty array. The component remains mounted in Home but renders no section, heading, stars or empty placeholder until published records exist.

Each record has `id`, `name`, `country`, `textEn`, optional `textAr`, optional integer `rating` from 1 to 5, and `status` (`draft` or `published`). Draft and malformed records are hidden. A record without a rating has no stars; no rating is assumed. Arabic displays the provided Arabic text, with the original English text as fallback.

Add only authentic reviews whose wording and publication permission can be substantiated. Keep private source evidence and customer identifiers outside this public file: its contents are bundled into the website. Review a record as draft, then change its status to published in a reviewed release. Do not add placeholder reviews to production data.

The current source is file-backed; adding records requires a build and deployment. It is not connected to the existing article CMS, whose content types do not include reviews.
