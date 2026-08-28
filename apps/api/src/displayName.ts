/** A blank name shows as an Untitled placeholder, never as an empty string. */
export function displayName(name: string | null | undefined) {
  return name && name.trim() ? name : "Untitled";
}

export function withDisplayName<T extends { name: string }>(row: T) {
  return { ...row, displayName: displayName(row.name) };
}
