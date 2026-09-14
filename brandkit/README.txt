TASHIRA — BRAND ASSET PACK
==========================
Generated 13 September 2026. The mark is "The Gateway" / بوابة الإمارات — three
nested pointed arches in the UAE flag colours, a red T crossing the gateway, a
gold star at the apex and a gold seal dot at the base.

WHY THIS PACK EXISTS
The website header currently shows a serif "T" mark. Instagram, LinkedIn, the
Facebook page and the invoice template all use the Gateway. Two marks means no
brand: a customer who checks the Instagram profile and then opens the site sees
two different companies. Everything here replaces the "T".


WHAT IS IN THE BOX
------------------
svg/
  logo-mark-light.svg     full colour — for white / cream backgrounds
  logo-mark-dark.svg      full colour — for navy / dark backgrounds
  logo-mark-gold.svg      single-hue gold — dark grounds, small sizes
  logo-mark-white.svg     knockout white — photos, coloured grounds
  logo-mark-navy.svg      single-hue navy — print, watermarks, faxes, stamps
  logo-mark-favicon.svg   thicker strokes, star and dot removed — survives 16px

icons/
  icon-16 / 32 / 48 / 64 / 180 / 192 / 512 .png   navy rounded tile, gold mark
  icon-maskable-512.png                            full-bleed, Android safe-zone
  mark-1024-transparent.png                        transparent, for decks & print

og/en/*.jpg  and  og/ar/*.jpg
  32 Open Graph images, 1200x630, one per route per language. These are what
  render when someone shares a link on WhatsApp — the single most important
  surface for this business, because that is where the marketing happens.

site.webmanifest      PWA manifest, navy theme
head-snippet.html     the <head> tags, ready to paste
logo-lockup.html      the header component: vector mark + live-text wordmark


HOW TO USE THE LOCKUP
---------------------
The MARK is vector. The WORDMARK is live text, not baked into the SVG. That is
deliberate: text stays crisp at any size, recolours with one CSS variable, is
readable by search engines and screen readers, and needs no font embedded in an
SVG. See logo-lockup.html — resize the whole lockup by changing one font-size.

One trap: the SVG gradient id must be unique per instance. Header + footer on
the same page with the same id makes the second mark lose its gold in some
browsers. In React use useId().


CLEAR SPACE AND MINIMUM SIZE
----------------------------
Clear space on all four sides = the width of the gold seal dot x 4.
Minimum size, full mark:     24px on screen, 8mm in print.
Below that, use logo-mark-favicon.svg — the star and seal dot disappear at small
sizes and turn into dirt on the arch, which is why that variant exists.


COLOURS
-------
Gold        #C9A04C -> #DDBB7A   (gradient, top-left to bottom-right)
Navy        #0A1628              ground, theme-color, icon tiles
Ink         #131B27              body text
UAE red     #EF3340
UAE green   #00843D
Silver      #D4D4D4              the middle arch on light backgrounds
Cream       #FAFAF7

The four-colour bar (red / green / silver / gold) always runs left to right in
that order, including on Arabic pages. It is a flag reference; it does not mirror.


NEVER
-----
- Never place the mark beside the UAE state emblem, the falcon, or any wording
  that implies TASHIRA is a government body. This is the one rule with legal
  weight behind it — the company is a licensed private provider, not an
  authority, and the site says so explicitly.
- Never recolour, rotate, outline, add a shadow to, or stretch the mark.
- Never rebuild the wordmark in a serif face. That is the old mark.
- Never crop the arch or use the red T on its own as a standalone logo.
- SERVICES stays in the horizontal lockup wherever the lockup is used at 26px or
  larger. It is the word that signals "service provider", not "authority".


WHERE THE MARK SHOULD APPEAR
----------------------------
Header, every page                lockup, linked to home
Footer                            lockup on navy, with licence number
Browser tab and bookmarks         favicon set
Phone home screen                 apple-touch-icon + manifest icons
WhatsApp / social link previews   the OG images in og/
Invoices and receipts             already wired in the invoice template
Email signature and templates     mark-1024-transparent.png, sized down
Empty states and loading screens  mark alone, 15% opacity, navy variant
Uploaded-document confirmations   small mark beside "Received"
Slide decks and PDFs              mark-1024-transparent.png
