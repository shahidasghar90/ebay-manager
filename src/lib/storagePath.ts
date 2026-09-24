/**
 * Makes one segment of a Supabase Storage path safe. Storage rejects keys with
 * characters like "ä" or "ß" ("Invalid key"), so accents are stripped, ß becomes
 * ss, and anything else outside letters, digits, dot, dash and underscore becomes a dash.
 */
export function storageSafe(segment: string, fallback = 'Uncategorized') {
  const safe = segment
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|-+$/g, '')
    .slice(0, 80);
  return safe || fallback;
}
