/**
 * Privacy-safe content analytics. Only non-PII funnel parameters are allowed:
 * content type, language, slug and CTA target. Never pass names, emails,
 * reference numbers or any free-text user input here.
 */
type ContentEvent =
  | 'landing_page_view'
  | 'landing_cta_click'
  | 'visa_precheck_start'
  | 'application_start'
  | 'guide_view'
  | 'related_content_click';

interface ContentEventParams {
  content_type: 'LANDING' | 'GUIDE' | 'NEWS';
  language: string;
  slug?: string;
  cta_target?: string;
}

export function trackContentEvent(event: ContentEvent, params: ContentEventParams): void {
  if (typeof window === 'undefined') return;
  const gtag = (window as { gtag?: (cmd: 'event', name: string, params: Record<string, string>) => void }).gtag;
  if (!gtag) return;
  const clean: Record<string, string> = {
    content_type: params.content_type,
    language: params.language,
  };
  if (params.slug) clean.slug = params.slug;
  if (params.cta_target) clean.cta_target = params.cta_target;
  gtag('event', event, clean);
}
