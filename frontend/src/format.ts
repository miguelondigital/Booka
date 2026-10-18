const dayFormat = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' })
const fullFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' })

export function formatDay(iso: string): string {
  return dayFormat.format(new Date(iso))
}

export function formatFull(iso: string): string {
  return fullFormat.format(new Date(iso))
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}
