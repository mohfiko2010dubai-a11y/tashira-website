/** Arabic has six plural categories; keep customer counters consistent. */
export function customerFileCount(count: number, ar: boolean) {
  if (!ar) return `${count} ${count === 1 ? "file" : "files"}`;
  const number = count.toLocaleString("ar", { numberingSystem: "arab" });
  switch (new Intl.PluralRules("ar").select(count)) {
    case "zero": return "لا توجد ملفات";
    case "one": return "ملف واحد";
    case "two": return "ملفان";
    case "few": return `${number} ملفات`;
    case "many": return `${number} ملفًا`;
    default: return `${number} ملف`;
  }
}
