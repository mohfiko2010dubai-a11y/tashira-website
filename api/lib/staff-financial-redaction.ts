// Covers camelCase and SQL column names, including nested price snapshots.
const privateFinancialKey = /cost|margin|profit|markup|minimum_?selling_?price|supplier_?(vat|total|invoice|notes|paid|place)/i;
export function redactStaffFinancials(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactStaffFinancials);
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !privateFinancialKey.test(key)).map(([key, item]) => [key, redactStaffFinancials(item)]));
}
