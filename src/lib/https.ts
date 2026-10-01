export function productionHttpsRedirect(
  request: Request,
): Response | undefined {
  const url = new URL(request.url);
  if (url.protocol !== "http:" || url.hostname !== "mddex.net") return;
  url.protocol = "https:";
  return Response.redirect(url.href, 308);
}
