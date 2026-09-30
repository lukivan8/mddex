// Keep the complete catalog query (search, category, type, applicability, sort).
export const CATALOG_URL = "https://mddex.net/collection";
const STORAGE_KEY = "mddex:item-page:catalog-return";
export function catalogReturnUrl(
  value: string | null,
  origin: string,
): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, origin);
    if (url.origin !== origin && url.origin !== "https://mddex.net")
      return null;
    if (url.pathname !== "/collection") return null;
    return url.href;
  } catch {
    return null;
  }
}
export function rememberCatalogReturn(): string {
  const origin = window.location.origin;
  const explicit = catalogReturnUrl(
    new URLSearchParams(window.location.search).get("returnTo"),
    origin,
  );
  const referrer = catalogReturnUrl(document.referrer, origin);
  let saved: string | null = null;
  try {
    saved = catalogReturnUrl(sessionStorage.getItem(STORAGE_KEY), origin);
  } catch {
    /* Storage can be disabled. */
  }
  const result = explicit ?? referrer ?? saved ?? CATALOG_URL;
  try {
    sessionStorage.setItem(STORAGE_KEY, result);
  } catch {
    /* The back link still works without storage. */
  }
  return result;
}
