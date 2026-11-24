// framework/web.py enviaba estadísticas, errores y puntajes a ws.trojanchicken.com y buscaba
// actualizaciones. En la versión web NUNCA se contactan esos servidores: todo es un no-op.
export class TaskResult { constructor(public data: unknown = null, public error = false) {} }
export function send_data(_to: string, _data: unknown, _key: unknown = null, _callback: ((r: TaskResult) => void) | null = null) {}
export function query(_to: string, _params: unknown = null, _key: unknown = null, _callback: ((r: TaskResult) => void) | null = null) {}
export function download_file(_to: string, _path: string, _params: unknown = null, _key: unknown = null, _callback: ((r: TaskResult) => void) | null = null) {}
export function get_result_and_delete(_key: unknown): TaskResult | null { return null }
