export type RehearsalTarget = { host: "127.0.0.1" | "localhost"; port: 33306; database: string };

export function validateRehearsalTarget(rawUrl: string): RehearsalTarget {
  const target = new URL(rawUrl);
  if (target.protocol !== "mysql:") throw new Error("OPS_REHEARSAL_PROTOCOL_INVALID");
  if (target.hostname !== "127.0.0.1" && target.hostname !== "localhost") throw new Error("OPS_REHEARSAL_HOST_NOT_LOCAL");
  if (target.port !== "33306") throw new Error("OPS_REHEARSAL_PORT_INVALID");
  const database = decodeURIComponent(target.pathname.slice(1));
  if (!/^tashira_ops_rehearsal_[a-z0-9_]+$/.test(database)) throw new Error("OPS_REHEARSAL_DATABASE_INVALID");
  return { host: target.hostname, port: 33306, database };
}

export function parseMysqlClientScript(source: string): readonly string[] {
  const statements: string[] = [];
  let delimiter = ";";
  let buffer = "";
  for (const line of source.replaceAll("\r\n", "\n").split("\n")) {
    const directive = /^\s*DELIMITER\s+(\S+)\s*$/i.exec(line);
    if (directive) {
      if (buffer.trim() && !commentsOnly(buffer)) throw new Error("OPS_REHEARSAL_DELIMITER_MID_STATEMENT");
      buffer = "";
      delimiter = directive[1];
      continue;
    }
    buffer += `${line}\n`;
    const trimmed = buffer.trimEnd();
    if (!trimmed.endsWith(delimiter)) continue;
    const statement = trimmed.slice(0, -delimiter.length).trim();
    if (statement) statements.push(statement);
    buffer = "";
  }
  if (buffer.trim() && !commentsOnly(buffer)) throw new Error("OPS_REHEARSAL_SQL_INCOMPLETE");
  return statements;
}

function commentsOnly(value: string): boolean {
  return value.split("\n").every((line) => !line.trim() || line.trimStart().startsWith("--"));
}
