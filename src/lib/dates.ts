const zone = "America/Sao_Paulo";
const isoDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: zone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const brDay = new Intl.DateTimeFormat("pt-BR", {
  timeZone: zone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Calendar day (YYYY-MM-DD) in São Paulo, the operation's reporting timezone. */
export function spDay(date = new Date()) {
  return isoDay.format(date);
}
/** Calendar day as dd/mm/aaaa in São Paulo. */
export function spDayBr(date = new Date()) {
  return brDay.format(date);
}
