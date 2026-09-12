export async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-nomadjarvis': '1' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 401) window.dispatchEvent(new Event('nomad-session-expired'))
  if (!res.ok) throw new Error((data as any).error || `Request failed (${res.status})`)
  return data as T
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
