const schemePattern = /^[a-z][a-z0-9+.-]*:/i;
const controlOrWhitespacePattern = /[\u0000-\u001f\u007f-\u009f\s]/u;

function isSafePath(value: string): boolean {
  return (
    value.startsWith("/") &&
    value.length > 1 &&
    value[1] !== "/" &&
    value[1] !== "\\" &&
    !value.includes("\\") &&
    !controlOrWhitespacePattern.test(value) &&
    !schemePattern.test(value)
  );
}

export function safeRedirectPath(input: unknown, fallback = "/"): string {
  if (typeof input !== "string" || !isSafePath(input)) return fallback;

  try {
    const decoded = decodeURIComponent(input);
    return isSafePath(decoded) ? input : fallback;
  } catch {
    return fallback;
  }
}
