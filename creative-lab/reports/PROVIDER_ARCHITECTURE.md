# Replaceable media-provider architecture

The POC uses provider-neutral contracts in `creative-lab/providers/contracts.ts`. Credentials are injected at execution time and never stored in briefs, logs, or Git.

| Area | Recommended POC provider | API / automation | Cost model | Quality / latency | Commercial suitability and limits |
|---|---|---|---|---|---|
| Image | OpenAI built-in image generation | Available in Codex; automatable | Usage based; verify current account pricing before scaled generation | High-quality concepts in minutes | Suitable subject to OpenAI terms; final text/logo must be overlaid deterministically |
| Video | OpenAI video generation where account access exists; keep adapter replaceable | Availability depends on enabled product/API | Usage/seconds based; confirm before generation | Potentially high quality; slower than stills | Access and temporal consistency vary; no subscription purchased |
| Voice | OpenAI TTS first; ElevenLabs optional | Both API-oriented | Per character/token | Fast; ElevenLabs may offer broader voice styling | Obtain voice/commercial rights; no cloned identity without authorization |
| Render | FFmpeg | Local deterministic CLI | No usage fee | Fast and reproducible | Baseline compositor for logo, captions, CTA and audio |
| Template render | Creatomate or Shotstack optional | Strong API automation | Render/minute or subscription | Consistent templates | Adds vendor cost and dependency; unnecessary for initial POC |

Recommendation: OpenAI image generation + FFmpeg now. Select a video provider only after owner approval of storyboards; use OpenAI TTS only if narration is selected. Never ask for API credentials until a selected provider actually requires them.

## Current cost reference

- OpenAI publishes image generation as token-based pricing and video generation per second. At the reviewed rate, `sora-2` 720p is about USD 0.10/second and `sora-2-pro` 720p about USD 0.30/second. The four planned videos total about 74 seconds: roughly USD 7.40 or USD 22.20 before retries, respectively.
- ElevenLabs lists TTS around USD 0.05/1,000 characters for Flash/Turbo and USD 0.10/1,000 for Multilingual v2/v3. All four short narrations remain close to or below 1,000 characters in total.
- Shotstack defines one credit as one rendered video minute and provides 10 starter credits, but plan/overage pricing should be confirmed at purchase time.
- The six key visuals in this POC were generated through the built-in image tool; no subscription was purchased and no external API key was requested.

Pricing is time-sensitive. Reconfirm against the official provider pages before scaled generation.
