import * as pgFormat from 'pg-format';

/**
 * This template string function creates a different interface for using pg-format.
 * To identify a variable for injection, precede it with the colon ":". When used in this way, the
 * data type of the variable is interrogated to determine whether to inject is as a literal or
 * string.
 * To specify exactly how injection should function use ":I" for identifiers, ":s" for strings, and
 * ":L" for literals.
 *
 * @example
 * sql`SELECT *, :L${someString} FROM :I${someIdentifier} LIMIT :s${someNumber} OFFSET :${100}`
 */
export function sql(
  fragments: TemplateStringsArray,
  ...args: (string | number | boolean | object | any[] | Date | null | undefined)[]
): string {
  let statement: string = '';
  const leftIndent: number = (fragments[0]?.length ?? 0) - (fragments[0]?.trimStart().length ?? 0);
  for (const [i, fragment] of fragments.entries()) {
    switch (true) {
      case fragment.endsWith(':'):
        switch (typeof args[i]) {
          case 'boolean':
          case 'number':
            statement += `${fragment.slice(0, -1)}${pgFormat.string(args[i])}`;
            continue;
          case 'string':
          case 'object':
          case 'undefined':
            statement += `${fragment.slice(0, -1)}${pgFormat.literal(args[i])}`;
            continue;
          default:
            statement += fragment.slice(0, -1);
            continue;
        }
      case fragment.endsWith(':s') || fragment.endsWith(':S'):
        statement += `${fragment.slice(0, -2)}${pgFormat.string(args[i])}`;
        continue;
      case fragment.endsWith(':l') || fragment.endsWith(':L'):
        statement += `${fragment.slice(0, -2)}${pgFormat.literal(args[i])}`;
        continue;
      case fragment.endsWith(':i') || fragment.endsWith(':I'):
        statement += `${fragment.slice(0, -2)}${pgFormat.ident(`${args[i] ?? ''}`)}`;
        continue;
      default:
        statement += `${fragment}${pgFormat.string(args[i])}`;
    }
  }
  if (!leftIndent) return statement;
  const lines: string[] = [];
  for (const [i, line] of statement.trim().split('\n').entries())
    lines.push(i === 0 ? line.trimEnd() : line.slice(leftIndent - 1).trimEnd());
  return lines.join('\n');
}
