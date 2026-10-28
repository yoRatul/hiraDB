type YearSelectProps = {
  value: string
  onChange: (value: string) => void
  required?: boolean
  disabled?: boolean
  includeAny?: boolean
  id?: string
  className?: string
}

function yearOptions(value: string): string[] {
  const currentYear = new Date().getFullYear()
  const years = [
    ...Array.from({ length: 11 }, (_, index) => currentYear + index),
    ...Array.from({ length: currentYear - 2000 }, (_, index) => currentYear - index - 1),
  ]
  const options = years.map(String)
  if (value && !options.includes(value)) options.push(value)
  return options
}

export function YearSelect({
  value,
  onChange,
  required = false,
  disabled = false,
  includeAny = false,
  id,
  className,
}: YearSelectProps) {
  const options = yearOptions(value)
  return (
    <select id={id} className={className} value={value} required={required} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
      <option value="">{includeAny ? 'All academic years' : 'Choose a year'}</option>
      {options.map((year) => <option key={year} value={year}>{year}</option>)}
    </select>
  )
}
