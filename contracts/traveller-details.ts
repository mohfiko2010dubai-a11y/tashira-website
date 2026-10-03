/** Latin passport names allow spaces and common name punctuation, not other scripts. */
export function validPassportName(name: string): boolean {
  return /\p{Script=Latin}/u.test(name) && /^[\p{Script=Latin}\p{M} .'’-]+$/u.test(name.trim());
}
