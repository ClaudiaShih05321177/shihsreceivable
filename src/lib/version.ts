// App version + build time, injected by vite.config.ts `define` at build/dev start.

declare const __APP_VERSION__: string;
declare const __APP_BUILD_TIME__: string;

export const APP_VERSION: string = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";

/** Last update time in ROC date + Taiwan time, e.g. 115/11/23 14:50. */
export function buildTimeLabel(): string {
  const iso = typeof __APP_BUILD_TIME__ === "string" ? __APP_BUILD_TIME__ : "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${Number(get("year")) - 1911}/${get("month")}/${get("day")} ${get("hour")}:${get("minute")}`;
}
