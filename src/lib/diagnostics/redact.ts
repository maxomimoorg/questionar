// Normalization helpers: turn raw errors/values into safe, technical codes.

const SAFE_VALUE = /^[a-z0-9_.:-]{1,48}$/i;

/** snake_case code from an error, without its message, stack or payload. */
export function normalizeError(err: unknown): string {
  if (err && typeof err === "object") {
    const name = (err as { name?: unknown }).name;
    if (typeof name === "string") {
      const map: Record<string, string> = {
        QuotaExceededError: "quota_exceeded",
        NotAllowedError: "not_allowed",
        SecurityError: "security_error",
        NotSupportedError: "not_supported",
        InvalidStateError: "invalid_state",
        AbortError: "aborted",
        TimeoutError: "timeout",
        DataError: "data_error",
        OperationError: "operation_error",
        NotFoundError: "not_found",
        VersionError: "version_error",
        TypeError: "type_error",
        RangeError: "range_error",
        SyntaxError: "syntax_error",
        ReferenceError: "reference_error",
      };
      if (map[name]) return map[name];
      if (SAFE_VALUE.test(name)) return toSnake(name);
    }
  }
  return "unknown_error";
}

function toSnake(s: string): string {
  return s
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-z0-9_]/gi, "_")
    .toLowerCase()
    .slice(0, 48);
}

const KNOWN_PATHS = new Set(["/", "/rubrica", "/confronto", "/manifest.json", "/sw.js"]);

/** Keeps only a known pathname; drops origin, query string and fragment. */
export function sanitizePath(url: string): string {
  try {
    const p = new URL(url, "http://local").pathname;
    return KNOWN_PATHS.has(p) ? p : "/:other";
  } catch {
    return "/:invalid";
  }
}

/** Allow-list for event/fact values: short technical tokens, numbers and booleans only. */
export function sanitizeFacts(
  data: Record<string, unknown> | undefined,
): Record<string, string | number | boolean> | undefined {
  if (!data) return undefined;
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(data)) {
    if (!SAFE_VALUE.test(k)) continue;
    if (typeof v === "boolean") out[k] = v;
    else if (typeof v === "number" && Number.isFinite(v)) out[k] = Math.round(v * 100) / 100;
    else if (typeof v === "string" && SAFE_VALUE.test(v)) out[k] = v;
    else if (typeof v === "string") out[k] = "redacted";
  }
  return Object.keys(out).length ? out : undefined;
}

export const NOTE_MAX = 500;

/** Manual notes: length-limited, with obvious secrets/contacts masked. */
export function sanitizeNote(note: string): string {
  return note
    .slice(0, NOTE_MAX)
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/https?:\/\/\S+/g, "[url]")
    .replace(/@[\w\u00C0-\u024F]{2,}/g, "[handle]")
    .replace(/\+?\d[\d\s-]{7,}\d/g, "[numero]")
    .replace(/[A-Za-z0-9_\-+/=]{24,}/g, "[segreto]")
    .trim();
}

/** Coarse browser/OS description: family + major version only, no full user agent. */
export function coarsePlatform(ua: string): { browser: string; browserMajor: string; os: string } {
  const pick = (re: RegExp) => ua.match(re)?.[1] ?? "";
  let browser = "other";
  let major = "";
  if (/Edg\//.test(ua)) [browser, major] = ["edge", pick(/Edg\/(\d+)/)];
  else if (/Firefox\//.test(ua)) [browser, major] = ["firefox", pick(/Firefox\/(\d+)/)];
  else if (/Chrome\//.test(ua)) [browser, major] = ["chromium", pick(/Chrome\/(\d+)/)];
  else if (/Safari\//.test(ua)) [browser, major] = ["safari", pick(/Version\/(\d+)/)];
  let os = "other";
  if (/Android/.test(ua)) os = "android";
  else if (/iPhone|iPad|iPod/.test(ua)) os = "ios";
  else if (/Windows/.test(ua)) os = "windows";
  else if (/Mac OS X/.test(ua)) os = "macos";
  else if (/Linux/.test(ua)) os = "linux";
  return { browser, browserMajor: major || "unknown", os };
}
