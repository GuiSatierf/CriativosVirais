/** JSON.stringify replacer that keeps bigint cents exact as decimal strings. */
export function bigintReplacer(_key: string, value: unknown) {
  return typeof value === "bigint" ? value.toString() : value;
}
