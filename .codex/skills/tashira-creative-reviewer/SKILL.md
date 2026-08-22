---
name: tashira-creative-reviewer
description: Score and gate TASHIRA marketing creatives for brand consistency, visual quality, readability, hook, clarity, CTA, policy safety, factual accuracy, AI artifacts, and publication readiness.
---

# TASHIRA Creative Reviewer

Review the final rendered asset and its copy, not only its brief. Score each dimension from 0–100: brand consistency, visual quality, mobile readability, hook strength, message clarity, CTA strength, policy safety, factual accuracy, AI-artifact control, and publication readiness. Overall score is the unweighted mean unless a safety rejection applies.

Automatically classify `REJECTED` for distorted text, a broken/generated logo, fake UI or visa documents, misleading visa claims, government impersonation, unreadable subtitles/disclosure, inconsistent branding, obvious low-quality AI artifacts, or unsupported facts.

Otherwise classify:

- `READY`: overall 85+, policy and factual accuracy 95+, no critical defect.
- `NEEDS REVISION`: overall 70–84 or a correctable presentation defect.
- `REJECTED`: below 70 or any automatic-rejection condition.

Return a scorecard, concise evidence for each deduction, exact revision instructions, and a final recommendation. Do not approve placeholders or ungenerated media as publication-ready.
