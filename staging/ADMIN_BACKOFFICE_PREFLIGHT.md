# Admin/back-office review — four pre-build answers

2026-09-14. Owner's complete review in attachment `4413e688-fa47-45b7-90c3-8baa38ef5751/pasted-text.txt` supersedes earlier admin notes. Read-only source review against deployed revision `39dd933f8a43370e442adc733f2a3747cc1e174a`. No back-office implementation started. Wizard tasks 1–3 are recorded as verified; payment audit is still blocked awaiting remediation approval (NEXT4_PAYMENT_AUDIT.md).

## 1. File URLs

`api/lib/local-storage.ts:storageCreateSignedUrl` generates path-bound HMAC-SHA256 signatures with a 15-minute expiry. Its old comment saying no expiry is wrong; the implementation and `SIGNED_URL_EXPIRY` determine behavior. `api/boot.ts:/storage/*` checks the signature and expiry before reading bytes.

These are bearer links: anyone possessing the complete valid URL can fetch the file until expiry without a separate session check. They are not bound to the identity of the downloader. Worse, the file response currently sets `Cache-Control: public, max-age=3600`, allowing a cached response to remain usable beyond the 15-minute origin expiry. This is a sensitive-file cache flaw, not a claim that a shared cache was observed serving an actual passport. It needs private/no-store handling and an attributable authorized download flow. No change made yet.

## 2. Server-side admin validation

`api/context.ts:createContext` validates the signed admin session server-side via `verifyAdminSessionAsync`, and checks staff token/session plus active staff record. `api/middleware.ts:requireAdmin/requireStaffOrAdmin` runs before protected resolver data access. Examples: `document-router.ts:listByApplication/getById`, `staff-router.ts:list`, `chat-router.ts:listSessions/getConversation`. These are real server gates, not only React redirects.

This does not certify every route. A concrete adjacent exception is `api/chat-router.ts:466:getHistory`: it is public and returns chat rows for a supplied sessionId without owner/session validation. Holding a chat session ID therefore acts as access to the history. The storage bearer endpoint is another intentional sessionless surface, with the weakness in Q1. A full anonymous/role endpoint matrix is required before signing off the admin security boundary. This preflight did not induce or read another person's conversation.

## 3. Existing audit logs

There are several, not none: `api/lib/audit-log.ts` emits structured security events with time, outcome and generic actor class; `api/lib/application-timeline.ts` and document lifecycle persist application events; `api/lib/operations/mysql-controlled-write-executor.ts` inserts controlled-action/operations audit events with actor references.

Coverage is incomplete. Generic admin security events and the shared admin session cannot identify which person acted. `/storage/*` does not record an attributable document view/download. This does not meet “who viewed, downloaded or changed every order/document.” Preserve existing append-only records and extend coverage; do not replace them with a second unrelated audit mechanism.

## 4. Chat Inbox source

`src/pages/admin/AdminChat.tsx` polls `chat.listSessions` and `chat.getConversation`, and sends `chat.adminReply`. `api/chat-router.ts` stores/reads `chatMessages` through the older `chat.sendMessage` flow. Admin replies also write that table.

The currently mounted `src/components/shared/ChatBot.tsx` instead calls `wizard.startApplication`, `quoteApplication`, `updateApplication`, `submitApplication` and upload/progress endpoints. Source search found no current frontend caller of `chat.sendMessage` or `chat.getHistory`. Therefore the current wizard widget is not wired as a live-chat source for this inbox. No inbound WhatsApp/Instagram/Messenger webhook feeding the inbox was found. A CallMeBot WhatsApp helper is outbound notification, not incoming social-message ingestion. An empty inbox does not establish that visitors have made no enquiries.

## Recorded owner decisions and pending inputs

- Not VAT-registered: build the conditional invoice/VAT treatment switched off; preserve issued invoice tax/FX snapshots.
- Owner/accountant must confirm voluntary/mandatory thresholds; do not choose financial/legal settings from the report's examples without that confirmation.
- Follow the supplied order after wizard payment blockers are resolved: VAT display, numbering, money reconciliation, requirement binding/review, identity/auditing, work queue/status/test separation, then remaining items.
- Do not renumber/delete immutable issued records or disable append-only guards as an incidental cleanup. Previous staging cleanup is still blocked and needs an approved maintenance scope.
- Draft bilingual CMS content is a publishing opportunity, not authorization to publish. Owner and Arabic reviewer approval remain required.
