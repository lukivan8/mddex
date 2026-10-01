"""Audit every sitemap page's initial HTML; no browser JavaScript is executed.

Usage: python3 scripts/seo-audit.py https://mddex.net --report /tmp/mddex-seo.json
"""

import argparse
import concurrent.futures
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from collections import Counter
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.titles = []
        self.headings = []
        self.metas = []
        self.canonicals = []
        self.links = []
        self.schemas = []
        self.capture = None
        self.schema = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "title" or tag in ("h1", "h2"):
            self.capture = {"tag": tag, "id": attrs.get("id"), "text": ""}
            (self.titles if tag == "title" else self.headings).append(self.capture)
        if tag == "meta":
            self.metas.append(attrs)
        if tag == "link" and attrs.get("rel") == "canonical":
            self.canonicals.append(attrs.get("href"))
        if tag == "a" and attrs.get("href"):
            self.links.append(attrs["href"])
        if tag == "script" and attrs.get("type") == "application/ld+json":
            self.schema = ""

    def handle_endtag(self, tag):
        if self.capture and tag == self.capture["tag"]:
            self.capture = None
        if tag == "script" and self.schema is not None:
            try:
                self.schemas.append(json.loads(self.schema))
            except ValueError:
                self.schemas.append({"error": "invalid JSON-LD"})
            self.schema = None

    def handle_data(self, data):
        if self.capture:
            self.capture["text"] += data
        if self.schema is not None:
            self.schema += data


def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": "MDDEX-SEO-Audit/1.0 Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=40) as response:
        return response.status, response.url, dict(response.headers), response.read().decode()


def audit(canonical, base):
    path = urllib.parse.urlsplit(canonical).path
    problems = []
    try:
        status, final_url, headers, html = fetch(base + path)
    except (urllib.error.URLError, TimeoutError) as error:
        return {"url": canonical, "errors": [str(error)], "links": []}
    page = Page()
    page.feed(html)
    headers = {name.lower(): value for name, value in headers.items()}
    title = page.titles[0]["text"] if page.titles else ""
    description = [meta.get("content", "") for meta in page.metas if meta.get("name") == "description"]
    robots = [meta.get("content", "") for meta in page.metas if meta.get("name") == "robots"]
    target = next((heading["text"] for heading in page.headings if heading["id"] == "about-item"), None)
    if path == "/build":
        target = "Minecraft Dungeons 2 build maker"
        if not any(heading["tag"] == "h1" and heading["text"] == target for heading in page.headings):
            problems.append("build target is missing from the server-rendered H1")
        if not any(schema.get("@type") == "WebApplication" for schema in page.schemas):
            problems.append("WebApplication schema is missing")
    elif path == "/collection":
        target = "Minecraft Dungeons 2 equipment catalog"
    elif path == "/mobs":
        target = "Minecraft Dungeons 2 mobs"
    if target and target.lower() not in title.lower():
        problems.append("target phrase is missing from the title")
    if status != 200 or urllib.parse.urlsplit(final_url).path != path:
        problems.append("sitemap URL does not return its own 200 page")
    if len(page.titles) != 1 or not title:
        problems.append("expected one non-empty title")
    if len(description) != 1 or not description[0]:
        problems.append("expected one non-empty description")
    if page.canonicals != [canonical]:
        problems.append("canonical is missing, duplicated, or disagrees with the sitemap")
    if len(robots) != 1 or "noindex" in robots[0].lower() or "noindex" in headers.get("x-robots-tag", "").lower():
        problems.append("indexing metadata is missing, duplicated, or blocks indexing")
    if len([heading for heading in page.headings if heading["tag"] == "h1"]) != 1:
        problems.append("expected one server-rendered H1")
    if path.startswith("/catalog/"):
        if not target or target.lower() not in title.lower():
            problems.append("catalog target heading is missing or disagrees with the title")
        if not any(schema.get("@type") == "BreadcrumbList" for schema in page.schemas):
            problems.append("BreadcrumbList schema is missing")
        if not any(urllib.parse.urlsplit(link).path == "/build" for link in page.links):
            problems.append("build maker link is missing")
    if any("error" in schema for schema in page.schemas):
        problems.append("invalid JSON-LD")
    return {
        "url": canonical,
        "title": title,
        "target": target,
        "description": description[0] if description else None,
        "errors": problems,
        "links": page.links,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("base", nargs="?", default="https://mddex.net")
    parser.add_argument("--report", default="/tmp/mddex-seo-audit.json")
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()
    base = args.base.rstrip("/")
    _, _, _, sitemap = fetch(base + "/sitemap.xml")
    urls = [entry.text for entry in ET.fromstring(sitemap).findall(".//{*}loc")]
    if not urls or len(urls) != len(set(urls)):
        raise ValueError("sitemap must contain unique, non-empty URLs")
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        pending = {pool.submit(audit, url, base): url for url in urls}
        for future in concurrent.futures.as_completed(pending):
            results.append(future.result())
            if len(results) % 50 == 0 or len(results) == len(urls):
                print(f"Audited {len(results)}/{len(urls)} pages", flush=True)
    titles = Counter(result.get("title") for result in results if result.get("title"))
    paths = {urllib.parse.urlsplit(url).path for url in urls}
    incoming = set()
    for result in results:
        for link in result.pop("links"):
            absolute = urllib.parse.urljoin(result["url"], link)
            parsed = urllib.parse.urlsplit(absolute)
            if parsed.netloc == "mddex.net" and absolute.split("?")[0].split("#")[0] != result["url"]:
                incoming.add(parsed.path)
    for result in results:
        if titles.get(result.get("title"), 0) > 1:
            result["errors"].append("duplicate page title")
        if urllib.parse.urlsplit(result["url"]).path not in incoming:
            result["errors"].append("no incoming HTML link from another sitemap page")
    failures = [result for result in results if result["errors"]]
    report = {
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "base": base,
        "pages": len(urls),
        "failures": len(failures),
        "linked_paths": len(paths & incoming),
        "results": sorted(results, key=lambda result: result["url"]),
    }
    Path(args.report).write_text(json.dumps(report, indent=2) + "\n")
    print(f"{len(urls)} pages; {len(failures)} failures. Report: {args.report}")
    for failure in failures[:20]:
        print(f"{failure['url']}: {'; '.join(failure['errors'])}")
    return bool(failures)


if __name__ == "__main__":
    sys.exit(main())
