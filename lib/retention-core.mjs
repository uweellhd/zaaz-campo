export const PHOTO_RETENTION_MS = 15 * 24 * 60 * 60 * 1000;

export function parseBrazilDate(value) {
  const parts = String(value || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!parts) return null;
  const [, day, month, year, hour, minute, second] = parts;
  // Registros antigos usavam a hora local de São Paulo, sem fuso no texto.
  const date = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${minute}:${String(second || 0).padStart(2, '0')}-03:00`);
  const check = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  return check.getUTCFullYear() === Number(year) && check.getUTCMonth() + 1 === Number(month)
    && check.getUTCDate() === Number(day) && check.getUTCHours() === Number(hour)
    && check.getUTCMinutes() === Number(minute) ? date : null;
}

export function pruneLegacyPhotos(timeline, nowMs, fallbackMs) {
  let removed = 0;
  const next = (Array.isArray(timeline) ? timeline : []).map(entry => {
    if (!Array.isArray(entry.fotos) || entry.fotos.length === 0) return entry;
    const capturedMs = parseBrazilDate(entry.dataHora)?.getTime() ?? fallbackMs ?? 0;
    if (nowMs - capturedMs < PHOTO_RETENTION_MS && capturedMs <= nowMs) return entry;
    removed += entry.fotos.length;
    const { fotos, ...rest } = entry;
    return { ...rest, fotosRemovidas: (Number(rest.fotosRemovidas) || 0) + fotos.length };
  });
  return { timeline: next, removed };
}
