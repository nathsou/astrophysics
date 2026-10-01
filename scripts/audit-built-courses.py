"""Audit static output. Hash-router destinations and widget behavior need a browser audit."""

import argparse
import json
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


class Page(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.ids = []
        self.links = []
        self.images = []
        self.math_errors = []
        self.feed(path.read_text(encoding="utf-8"))

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get("id"):
            self.ids.append(attrs["id"])
        if tag == "a" and attrs.get("href"):
            self.links.append(attrs["href"])
        if tag == "img" and attrs.get("src"):
            self.images.append(attrs["src"])
        if "katex-error" in attrs.get("class", "").split():
            self.math_errors.append(attrs.get("title", "Invalid equation"))


def resolve_target(root, page, url, prefix):
    path = unquote(url.path)
    if prefix and (path == prefix or path.startswith(prefix + "/")):
        path = path[len(prefix):]
    target = root / path.lstrip("/") if path.startswith("/") else page.parent / path
    if not path:
        target = page
    target = target.resolve()
    return target / "index.html" if target.is_dir() else target


def audit(root, prefix):
    pages = {
        path: Page(path)
        for path in sorted(root.rglob("*.html"))
        if path.name != "404.html"
    }
    issues = []
    for path, page in pages.items():
        relative = path.relative_to(root)
        # Compatibility redirects have no content or fragment targets of their own.
        if relative.parts[0] == "ch":
            continue

        def record(kind, detail):
            issues.append({"page": str(relative), "kind": kind, "detail": detail})

        for identifier, count in Counter(page.ids).items():
            if count > 1:
                record("duplicate-id", identifier)
        for error in page.math_errors:
            record("math-error", error)
        for src in page.images:
            url = urlsplit(src)
            if not url.scheme and not url.netloc:
                if not resolve_target(root, path, url, prefix).exists():
                    record("missing-image", src)
        for href in page.links:
            url = urlsplit(href)
            if url.scheme or url.netloc:
                continue
            target = resolve_target(root, path, url, prefix)
            if not target.exists():
                record("missing-link", href)
            elif url.fragment and not url.fragment.startswith("/") and "=" not in url.fragment and target in pages:
                if unquote(url.fragment) not in pages[target].ids:
                    record("missing-fragment", href)
    return {"pages": len(pages), "issues": issues}


def main():
    parser = argparse.ArgumentParser(description="Audit built course links, images, equations and ids.")
    parser.add_argument("--directory", type=Path, default=Path(__file__).resolve().parents[1] / "dist")
    parser.add_argument("--base-path", default="", help="Deployment prefix, for example /courses")
    args = parser.parse_args()
    root = args.directory.resolve()
    if not (root / "index.html").exists():
        parser.error("Build the collection first with npm run build")
    result = audit(root, args.base_path.rstrip("/"))
    print(json.dumps(result, indent=2))
    return 1 if result["issues"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
