export function notify(title: string, body: string, severity: 'info' | 'success' | 'warning' | 'critical' = 'info') {
  window.dispatchEvent(
    new CustomEvent('afyasasa-notification', {
      detail: { id: crypto.randomUUID(), title, body, severity },
    }),
  )
}
