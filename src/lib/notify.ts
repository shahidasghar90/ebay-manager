/**
 * Sends a push notification to every other member of the current workspace.
 * Fire-and-forget: a failed notification never blocks or fails a save.
 */
export function notifyTeam(title: string, body?: string, url?: string) {
  fetch('/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, body, url }),
    keepalive: true
  }).catch(() => {
    // Ignore: notifications are best-effort.
  });
}
