// framework/external.py (Sugar/XO): no aplica en la web.
export const is_sugar = false
export const data_path = ''
export function open_browser(uri: string) { window.open(uri, '_blank', 'noopener') }
export function execute_package(_p: string) {}
export function other_activities_running() { return false }
