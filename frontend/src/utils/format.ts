export function display(value: string | number | null | undefined): string {
  return value === null || value === undefined || value === '' ? '—' : String(value)
}
