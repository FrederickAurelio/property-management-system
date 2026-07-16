#!/usr/bin/env python3
"""
scan-tells.py — mechanical gate for the product-ui-design skill.

Greps generated CSS/HTML for the machine-detectable AI tells. A passing scan is
NECESSARY, NOT SUFFICIENT: it catches the obvious signals, not taste. The
judgment tells (mono labels, four-equal stat strips, glowing dots as design,
generic hierarchy) still need a human/agent read of references/ai-tells.md.

Usage:
    python scan-tells.py <file-or-dir> [more paths...]

Exit codes:
    0 = clean (no tells)
    1 = at least one tell found
    2 = usage error or no scannable files

CSS-in-JS (.js/.ts) coverage is best-effort. No third-party dependencies.
"""

import os
import re
import sys
from collections.abc import Iterator
from typing import Optional

# Make output robust on legacy consoles (e.g. Windows cp932): scanned snippets
# and messages may contain non-ASCII (—, …, ⌘). Fall back silently if unsupported.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

EXTS = (
    ".html",
    ".htm",
    ".css",
    ".scss",
    ".less",
    ".jsx",
    ".tsx",
    ".vue",
    ".svelte",
    ".astro",
    ".js",
    ".ts",
    ".mjs",
    ".cjs",  # CSS-in-JS, best-effort
)

# --- Per-line rules: single-token patterns that live on one line. ---
# (id, compiled regex, human message)
LINE_RULES = [
    (
        "indigo-accent",
        re.compile(
            r"#(6366f1|818cf8|5b5bd6|6d28d9|7c3aed|4f46e5|a78bfa|8b5cf6)\b", re.I
        ),
        "purple/indigo AI accent — pick a brand accent from the product's world",
    ),
    (
        "indigo-tailwind",
        re.compile(
            r"\b(?:bg|text|from|via|to|border|ring|fill|stroke|outline|divide|"
            r"decoration|accent|caret|shadow)-(?:indigo|violet|purple|fuchsia)-\d{2,3}\b",
            re.I,
        ),
        "purple/indigo Tailwind utility — the default AI accent; use a brand color",
    ),
    (
        "pure-black-text-bg",
        # Left boundary so border-color/caret-color/outline-color do NOT match.
        # Covers #000, the `black` keyword, and rgb()/rgba() in both comma and
        # space (modern) syntax.
        re.compile(
            r"(?<![-\w])(?:color|background(?:-color)?)\s*:\s*"
            r"(?:#000(?:000)?\b|black\b|rgba?\(\s*0[\s,]+0[\s,]+0\b)",
            re.I,
        ),
        "pure black for text/bg — use near-black (#1a1a1a..#08090A)",
    ),
    (
        "token-pure-black",
        # The skill mandates tokens over inline hex, so generated pure-black lands
        # as `--foreground:#000`, which the property-scoped rule above never sees.
        # Scope to text/bg/surface-ish token names; a pure-black `--border` is a
        # different (weaker) tell and stays out, matching the shadow rule's logic.
        re.compile(
            r"--[\w-]*(?:foreground|background|surface|text|body|ink|fg|bg|heading|title|content)[\w-]*"
            r"\s*:\s*(?:#000(?:000)?\b|black\b|rgba?\(\s*0[\s,]+0[\s,]+0\b)",
            re.I,
        ),
        "pure-black color token — define text/bg tokens as near-black (#1a1a1a..#08090A)",
    ),
    (
        "transition-all",
        re.compile(r"transition\s*:\s*all\b", re.I),
        "transition: all — animate only transform/opacity",
    ),
    (
        "scale-zero",
        re.compile(r"\bscale\(\s*0\s*\)", re.I),
        "animating from scale(0) — start at scale(0.95) + opacity",
    ),
    (
        "disable-zoom",
        # =1 or =1.0 disables zoom; =1.5/=10/=1.25 permit it (must not match).
        re.compile(
            r"user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?:\.0+)?(?![.\d])", re.I
        ),
        "zoom disabled (WCAG 1.4.4 fail) — use 16px inputs to stop iOS auto-zoom instead",
    ),
    # --- Tailwind utility-class equivalents of the CSS tells above. Generated
    # product UI is overwhelmingly Tailwind, so the CSS-property rules alone miss
    # the most common shape of the same mistakes. ---
    (
        "transition-all-tw",
        re.compile(r"\btransition-all\b", re.I),
        "Tailwind transition-all — animate transform/opacity or a specific paint "
        "prop (transition-transform/-opacity/-colors), never all",
    ),
    (
        "scale-zero-tw",
        # scale-0 / scale-x-0 / scale-y-0 (enter from zero); scale-50 (=.5) must NOT match.
        re.compile(r"\bscale-(?:[xy]-)?0\b", re.I),
        "Tailwind scale-0 enter — start from scale-95 + opacity, not zero scale",
    ),
    (
        "pure-black-tw",
        # bg-black / text-black; bg-black/50 (alpha overlay, e.g. a backdrop) is allowed.
        re.compile(r"\b(?:bg|text)-black\b(?!/)", re.I),
        "Tailwind bg-black/text-black — use near-black (e.g. zinc-950, neutral-900)",
    ),
    (
        "arbitrary-black-tw",
        # Arbitrary-value escape hatch: bg-[#000] / text-[#000000]. The keyword
        # rule above only sees bg-black/text-black; indigo's hex literal is caught
        # by indigo-accent, so black is the asymmetric gap closed here. Alpha
        # overlays (bg-[#000]/50) are exempt, matching the bg-black/50 exemption.
        re.compile(r"\b(?:bg|text)-\[#000(?:000)?\](?!/)", re.I),
        "Tailwind arbitrary pure-black (bg-[#000]/text-[#000]) — use near-black",
    ),
]

# Tailwind outline-none without a focus-visible ring replacement — the utility
# analogue of the CSS :focus{outline:none} check. Flag only when no ring /
# focus-visible / shadow utility sits in the SAME class context (those signal a
# real focus replacement). The context, not the line, because Prettier splits a
# long className across lines via cn()/clsx(), separating outline-none from its
# ring — a line-scoped check false-flags that idiomatic clean code.
TW_OUTLINE_NONE = re.compile(r"\boutline-none\b", re.I)
TW_RING_OK = re.compile(r"\b(?:ring|focus-visible:|shadow-)", re.I)
# Start of a class attribute / helper call: class="...", className={cn(...)}, etc.
CLASS_ATTR = re.compile(r"class(?:Name)?\s*=\s*")


def class_context(text: str, pos: int) -> Optional[str]:
    """Return the class string/expression enclosing *pos*, or None.

    Bounds the nearest `class(Name)=` value: a quoted string ends at its quote;
    a `{…}` expression (cn/clsx/template literal) ends at the balanced brace, so
    a multi-line cn() call is treated as one context. None when *pos* is not
    inside such a value (caller falls back to the single line).
    """
    last = None
    for m in CLASS_ATTR.finditer(text, 0, pos + 1):
        last = m
    if last is None:
        return None
    i = last.end()
    if i >= len(text):
        return None
    ch = text[i]
    if ch in "\"'`":
        end = text.find(ch, i + 1)
        if end == -1 or pos > end:
            return None
        return text[i + 1 : end]
    if ch == "{":
        depth = 0
        j = i
        while j < len(text):
            if text[j] == "{":
                depth += 1
            elif text[j] == "}":
                depth -= 1
                if depth == 0:
                    break
            j += 1
        if pos > j:
            return None
        return text[i + 1 : j]
    return None


# Directories never worth scanning (third-party code, build output, VCS).
EXCLUDED_DIRS = {
    ".git",
    "node_modules",
    "dist",
    "build",
    "out",
    ".next",
    ".nuxt",
    ".svelte-kit",
    ".turbo",
    "vendor",
    "coverage",
    "__pycache__",
    ".venv",
    "venv",
}

# --- Whole-text rules: patterns whose tokens routinely wrap across lines. ---
# box-shadow values and :focus{} blocks are commonly multi-line in hand-written CSS.
# Start at box-shadow OR a CSS-variable shadow token (--shadow-1, --card-shadow,
# …) — the skill itself recommends defining shadows as tokens, so the property
# form alone would miss its own primary pattern. Black detection covers comma
# and space (modern) rgb()/rgba() syntax plus #000.
BLACK_SHADOW = re.compile(
    r"(?:box-shadow|--[\w-]*shadow[\w-]*)\s*:[^;{}]*"
    r"(?:rgba?\(\s*0[\s,]+0[\s,]+0\b|#000(?:000)?\b)",
    re.I,
)
FOCUS_BLOCK = re.compile(r":focus\b(?!-visible|-within)[^{}]*\{[^{}]*\}", re.I | re.S)
OUTLINE_NONE = re.compile(r"outline\s*:\s*(?:none|0)\b", re.I)

# Comments are stripped before matching so a tell mentioned in a comment
# (e.g. "/* scale(0) not allowed */") is not a false positive.
COMMENT = re.compile(r"/\*.*?\*/|<!--.*?-->", re.S)

# Heuristic (review, not a hard fail): small font-size that MIGHT be on an input.
SMALL_FONT = re.compile(r"font-size\s*:\s*(\d{1,2})(?:\.\d+)?px", re.I)


def strip_comments(text: str) -> str:
    """Blank out /* */ and <!-- --> comment bodies, preserving newlines."""
    return COMMENT.sub(lambda m: re.sub(r"[^\n]", " ", m.group(0)), text)


def line_of(text: str, pos: int) -> int:
    return text.count("\n", 0, pos) + 1


def snippet_at(text: str, pos: int) -> str:
    start = text.rfind("\n", 0, pos) + 1
    end = text.find("\n", pos)
    if end == -1:
        end = len(text)
    return text[start:end].strip()[:120]


def iter_files(paths: list[str]) -> Iterator[str]:
    for p in paths:
        if os.path.isfile(p):
            # Only scan CSS/HTML-family files, even when passed directly, so
            # documentation/prose (e.g. .md that mentions tells as examples) is
            # not false-flagged.
            if p.lower().endswith(EXTS):
                yield p
            else:
                print(f"skipped: {p} (not a scannable type)", file=sys.stderr)
        elif os.path.isdir(p):
            for root, dirs, files in os.walk(p):
                dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS]
                for f in files:
                    if f.lower().endswith(EXTS):
                        yield os.path.join(root, f)
        else:
            print(f"skipped: {p} (not found)", file=sys.stderr)


def scan(paths: list[str]) -> tuple[list[str], list[tuple], list[tuple]]:
    hits: list[tuple] = []  # hard tells
    reviews: list[tuple] = []  # heuristic, needs eyeballing
    files = list(iter_files(paths))
    for fp in files:
        try:
            with open(fp, "r", encoding="utf-8", errors="replace") as fh:
                raw = fh.read()
        except OSError:
            continue
        text = strip_comments(raw)  # newline-preserving

        # Per-line single-token rules + small-font review.
        for i, line in enumerate(text.splitlines(), 1):
            snippet = line.strip()[:120]
            for rid, rx, msg in LINE_RULES:
                if rx.search(line):
                    hits.append((fp, i, rid, msg, snippet))
            m = SMALL_FONT.search(line)
            if m and int(m.group(1)) < 16 and "input" in line.lower():
                reviews.append(
                    (
                        fp,
                        i,
                        "small-input-font",
                        "font-size < 16px near 'input' — confirm it's not an input (iOS auto-zoom)",
                        snippet,
                    )
                )

        # Whole-text rules (tokens / class lists may wrap across lines).
        for m in TW_OUTLINE_NONE.finditer(text):
            region = class_context(text, m.start())
            if region is None:
                region = snippet_at(text, m.start())  # not in a class attr → line
            if not TW_RING_OK.search(region):
                hits.append(
                    (
                        fp,
                        line_of(text, m.start()),
                        "tw-outline-none",
                        "Tailwind outline-none without a focus-visible ring — pair with focus-visible:ring-*",
                        snippet_at(text, m.start()),
                    )
                )
        for m in BLACK_SHADOW.finditer(text):
            hits.append(
                (
                    fp,
                    line_of(text, m.start()),
                    "black-shadow",
                    "pure-black box-shadow — tint toward the background hue, 2 layers",
                    snippet_at(text, m.start()),
                )
            )
        for m in FOCUS_BLOCK.finditer(text):
            block = m.group(0)
            low = block.lower()
            if (
                OUTLINE_NONE.search(block)
                and "box-shadow" not in low
                and "focus-visible" not in low
            ):
                hits.append(
                    (
                        fp,
                        line_of(text, m.start()),
                        "focus-outline-none",
                        "outline:none on :focus with no ring — add :focus-visible/box-shadow ring",
                        snippet_at(text, m.start()),
                    )
                )
    return files, hits, reviews


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    if not args:
        print("usage: python scan-tells.py <file-or-dir> [more paths...]")
        return 2
    files, hits, reviews = scan(args)
    if not files:
        print("no scannable files found (looked for: " + " ".join(EXTS) + ")")
        return 2

    hits.sort(key=lambda h: (h[0], h[1]))
    for fp, ln, rid, msg, snippet in hits:
        print(f"TELL   {fp}:{ln}  [{rid}] {msg}\n        {snippet}")
    for fp, ln, rid, msg, snippet in reviews:
        print(f"REVIEW {fp}:{ln}  [{rid}] {msg}\n        {snippet}")

    print(
        f"\nscanned {len(files)} file(s): {len(hits)} tell(s), {len(reviews)} review item(s)"
    )
    if hits:
        print(
            "FAIL — fix the tells above, then re-scan. (Reminder: a clean scan is "
            "necessary, not sufficient — also read references/ai-tells.md for the judgment tells.)"
        )
        return 1
    print(
        "PASS — no machine-detectable tells. Still do the manual read of references/ai-tells.md."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
