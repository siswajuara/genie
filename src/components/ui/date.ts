export const dateISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const parseDate = (s?: string) => {
  if (!s) return undefined;
  const date = new Date(`${s}T12:00:00`);
  return Number.isFinite(date.getTime()) ? date : undefined;
};
