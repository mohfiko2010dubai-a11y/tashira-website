export function policyModules(root?: string): string[];
export function environmentReads(text: string): string[];
export function moduleFindings(): { file: string; reads: string[] }[];
