// Port de framework/text.py
export const to_upper = (text: string) => text.toUpperCase()
export const to_lower = (text: string) => text.toLowerCase()

/** 1234567 -> "1.234.567" (separador de miles con punto, como el original) */
export function format_number(number: number | string): string {
  let text = String(number)
  let decimal_separator = text.indexOf(',')
  if (decimal_separator === -1) decimal_separator = text.indexOf('.')
  let text_len = decimal_separator === -1 ? text.length : decimal_separator
  let k = 3
  while (k < text_len) {
    const i = text_len - k
    if (i === 0 && text[0] === '-') break
    text = text.slice(0, i) + '.' + text.slice(i)
    text_len += 1
    k += 4
  }
  return text
}
