import { SocialError } from "./types.ts";
export function localSchedule(local: string, zone: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))
    throw new SocialError(
      "validation_failed",
      "Choose a valid local date and time.",
      422,
    );
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    throw new SocialError(
      "validation_failed",
      "Choose a valid IANA timezone.",
      422,
    );
  }
  const center = Date.parse(local + "Z"),
    matches: number[] = [];
  for (let offset = -14 * 60; offset <= 14 * 60; offset += 15) {
    const candidate = center + offset * 60000;
    const pieces = Object.fromEntries(
      formatter.formatToParts(candidate).map((v) => [v.type, v.value]),
    );
    if (
      `${pieces.year}-${pieces.month}-${pieces.day}T${pieces.hour}:${pieces.minute}` ===
      local
    )
      matches.push(candidate);
  }
  if (matches.length !== 1)
    throw new SocialError(
      "validation_failed",
      matches.length
        ? "This time is ambiguous because clocks change. Choose another time."
        : "This local time does not exist. Choose another time.",
      422,
    );
  return new Date(matches[0]).toISOString();
}
