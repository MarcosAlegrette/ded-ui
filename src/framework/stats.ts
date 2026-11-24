// framework/stats.py: estadísticas de uso que se enviaban a un servidor remoto. Aquí sólo se
// guardan en memoria (nunca se envían).
export class Stats {
  private counts: Record<string, number> = {}
  start_time_event(_code: unknown) {}
  end_time_event(_code: unknown, _acc: unknown = null) {}
  increment_count_event(code: unknown) { const k = String(code); this.counts[k] = (this.counts[k] ?? 0) + 1 }
  get_data() { return this.counts }
  save_if_pending() {}
}
export function report_error(_type: unknown, value: unknown, _tb: unknown = null) { console.error(value) }
export function get_error_data(_size: unknown = null) { return null }
export function delete_error_data() {}
