/** Only repository-owned policy markup is accepted; no DOM globals during SSR. */
export function validatedLegalHtml(html: string): string {
  for (const tag of html.match(/<[^>]*>/g) ?? []) {
    if (/^<\/?(?:p|h2|strong|ul|li|a)>$/.test(tag)) continue;
    if (/^<a href=['"](?:\/(?!\/)[a-z0-9/-]*|mailto:[a-z0-9@._+-]+)['"]>$/.test(tag)) continue;
    throw new Error("Unsupported policy HTML; review the policy source before publication");
  }
  if (html.replace(/<[^>]*>/g, "").includes("<")) throw new Error("Malformed policy markup");
  return html;
}
