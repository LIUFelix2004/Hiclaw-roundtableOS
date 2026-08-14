# -*- coding: utf-8 -*-
"""
Hermes AgentOS — hackathon deck, authored as PPT Master semantic SVG.

Canvas 1280x720 (ppt169). Dark cinematic field, aurora gradients, glass panels,
and one repeated motif: the roundtable ring.
"""
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "svg_output")

W, H = 1280, 720
M = 72                      # safe margin
CW = W - M * 2              # 1136

# ── palette ───────────────────────────────────────────────────────────
BG        = "#050A18"
PANEL     = "#0B1428"
LINE      = "#1E2C4A"
LINE_HI   = "#33507F"
TXT       = "#F1F5F9"
DIM       = "#9FB0CC"
MUTE      = "#5E7093"
BLUE      = "#4C6FFF"
VIOLET    = "#8B5CF6"
CYAN      = "#22D3EE"
GREEN     = "#10B981"
AMBER     = "#F59E0B"
RED       = "#EF4444"
INDIGO    = "#6366F1"

# agent colors mirror packages/hermes-studio/.../PixelRoundtable3D.vue
AGENTS = [
    ("moderator", "主持人", "Moderator", VIOLET),
    ("research",  "研究员", "Research",  INDIGO),
    ("analyst",   "分析师", "Analyst",   AMBER),
    ("writer",    "撰稿员", "Writer",    GREEN),
    ("data",      "数据员", "Data",      "#3B82F6"),
    ("validator", "验证员", "Validator", RED),
    ("rollback",  "回滚员", "Rollback",  "#64748B"),
]

F_SANS = "Arial, &quot;Microsoft YaHei&quot;, sans-serif"
F_BOLD = "&quot;Arial Black&quot;, &quot;Microsoft YaHei&quot;, sans-serif"
F_MONO = "Consolas, &quot;Courier New&quot;, monospace"


# ── text helpers ──────────────────────────────────────────────────────
# ── type scale ────────────────────────────────────────────────────────
# Every size on every page snaps to one of these named roles; the deck must
# not drift into a long tail of near-neighbour sizes.
SCALE = [9, 10.5, 12, 13, 14, 15, 17, 20, 24, 25, 34, 38, 40, 46, 62]


def snap(fs):
    return min(SCALE, key=lambda v: abs(v - fs))


def _w(ch, fs):
    """Approximate glyph advance: CJK is full-width, latin about half."""
    o = ord(ch)
    if o > 0x2E80:
        return fs * 1.0
    if ch in "iljI.,:;'!|":
        return fs * 0.28
    if ch in " ":
        return fs * 0.28
    if ch.isupper():
        return fs * 0.66
    return fs * 0.53


def measure(s, fs):
    return sum(_w(c, fs) for c in s)


def measure_num(s, fs):
    """Advance of a heavy display numeral run (Arial Black digits)."""
    total = 0.0
    for c in s:
        if c.isdigit():
            total += fs * 0.80
        elif c in ".,":
            total += fs * 0.36
        else:
            total += fs * 0.62
    return total


def wrap(s, max_w, fs):
    """Greedy wrap honouring CJK breaks and latin word boundaries."""
    lines, cur, cur_w = [], "", 0.0
    i = 0
    while i < len(s):
        ch = s[i]
        if ch == "\n":
            lines.append(cur)
            cur, cur_w = "", 0.0
            i += 1
            continue
        # keep a latin word together
        token = ch
        if ord(ch) < 0x2E80 and ch not in " ，。、；：（）":
            j = i
            while j < len(s) and ord(s[j]) < 0x2E80 and s[j] not in " ，。、；：（）":
                j += 1
            token = s[i:j]
        tw = measure(token, fs)
        if cur_w + tw > max_w and cur:
            lines.append(cur.rstrip())
            cur, cur_w = "", 0.0
            if token == " ":
                i += len(token)
                continue
        cur += token
        cur_w += tw
        i += len(token)
    if cur:
        lines.append(cur.rstrip())
    # A line must never open with closing punctuation; pull it back.
    closing = "。，、；：）」』】！？.,;:!?%"
    for k in range(1, len(lines)):
        while lines[k] and lines[k][0] in closing:
            lines[k - 1] += lines[k][0]
            lines[k] = lines[k][1:]
    return [ln for ln in lines if ln]


def text(s, x, y, fs=14, fill=DIM, font=F_SANS, weight=None, anchor=None,
         ls=None, opacity=None):
    fs = snap(fs)
    a = [f'x="{x}"', f'y="{y}"', f'font-family="{font}"', f'font-size="{fs}"',
         f'fill="{fill}"']
    if weight:
        a.append(f'font-weight="{weight}"')
    if anchor:
        a.append(f'text-anchor="{anchor}"')
    if ls is not None:
        a.append(f'letter-spacing="{ls}"')
    if opacity is not None:
        a.append(f'fill-opacity="{opacity}"')
    return f'<text {" ".join(a)}>{s}</text>'


def para(s, x, y, max_w, fs=14, lh=1.65, fill=DIM, font=F_SANS, weight=None,
         anchor=None, ls=None):
    """One <text> frame; continuation lines are <tspan dy> children."""
    fs = snap(fs)
    lines = wrap(s, max_w, fs)
    if not lines:
        return ""
    if len(lines) == 1:
        return text(lines[0], x, y, fs, fill, font, weight, anchor, ls)
    dy = round(fs * lh, 1)
    body = lines[0] + "".join(
        f'<tspan x="{x}" dy="{dy}">{ln}</tspan>' for ln in lines[1:])
    return text(body, x, y, fs, fill, font, weight, anchor, ls)


def para_h(s, max_w, fs=14, lh=1.65):
    """Rendered height of a wrapped paragraph."""
    fs = snap(fs)
    return len(wrap(s, max_w, fs)) * fs * lh


# ── shape helpers ─────────────────────────────────────────────────────
def panel(x, y, w, h, r=14, fill="url(#glass)", stroke=LINE, sw=1, extra=""):
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" ry="{r}" '
            f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{extra} />')


def edge_highlight(x, y, w):
    """Glass top-edge sheen. A gradient stroke on a zero-height line does not
    render, so the highlight is a thin filled rect."""
    return (f'<rect x="{x}" y="{y - 0.75}" width="{w}" height="1.5" '
            f'fill="url(#edgeTop)" />')


def hairline(x, y, w, stroke=LINE, sw=1, opacity=None):
    o = f' stroke-opacity="{opacity}"' if opacity is not None else ""
    return (f'<line x1="{x}" y1="{y}" x2="{x + w}" y2="{y}" stroke="{stroke}" '
            f'stroke-width="{sw}"{o} />')


def vline(x, y, h, stroke=LINE, sw=1, opacity=None):
    o = f' stroke-opacity="{opacity}"' if opacity is not None else ""
    return (f'<line x1="{x}" y1="{y}" x2="{x}" y2="{y + h}" stroke="{stroke}" '
            f'stroke-width="{sw}"{o} />')


def dot(x, y, r, fill):
    return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{fill}" />'


def chip(x, y, w, h, label, color, fs=13):
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{h/2}" ry="{h/2}" '
            f'fill="{color}" fill-opacity="0.10" stroke="{color}" '
            f'stroke-opacity="0.55" stroke-width="1" />\n    '
            + text(label, x + w / 2, y + h / 2 + fs * 0.36, fs, color,
                   anchor="middle"))


def arrow(x1, y1, x2, y2, color=LINE_HI, sw=1.4, marker="arrowHi"):
    return (f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" '
            f'stroke-width="{sw}" marker-end="url(#{marker})" />')


# ── shared defs ───────────────────────────────────────────────────────
def defs(extra=""):
    return f'''<defs>
    <linearGradient id="glass" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#22345C" stop-opacity="0.34" />
      <stop offset="100%" stop-color="#0A1navy" stop-opacity="0.10" />
    </linearGradient>
    <linearGradient id="glassSoft" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1B2C50" stop-opacity="0.22" />
      <stop offset="100%" stop-color="#080F22" stop-opacity="0.10" />
    </linearGradient>
    <linearGradient id="glassHot" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4C6FFF" stop-opacity="0.20" />
      <stop offset="100%" stop-color="#8B5CF6" stop-opacity="0.06" />
    </linearGradient>
    <linearGradient id="edgeTop" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0" />
      <stop offset="50%" stop-color="#FFFFFF" stop-opacity="0.28" />
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0" />
    </linearGradient>
    <linearGradient id="titleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#6E8CFF" />
      <stop offset="52%" stop-color="#A78BFA" />
      <stop offset="100%" stop-color="#22D3EE" />
    </linearGradient>
    <radialGradient id="aurora" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#3B5BFF" stop-opacity="0.40" />
      <stop offset="55%" stop-color="#2A2F8F" stop-opacity="0.14" />
      <stop offset="100%" stop-color="#050A18" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="auroraCyan" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#0E9BB0" stop-opacity="0.26" />
      <stop offset="100%" stop-color="#050A18" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="tableTop" cx="50%" cy="38%" r="62%">
      <stop offset="0%" stop-color="#2C4C9E" stop-opacity="0.62" />
      <stop offset="60%" stop-color="#16264C" stop-opacity="0.50" />
      <stop offset="100%" stop-color="#0A1densely" stop-opacity="0.34" />
    </radialGradient>
    <filter id="glowBlue" x="-60%" y="-60%" width="220%" height="220%">
      <feDropShadow dx="0" dy="0" stdDeviation="10" flood-color="#4C6FFF" flood-opacity="0.55" />
    </filter>
    <filter id="glowViolet" x="-60%" y="-60%" width="220%" height="220%">
      <feDropShadow dx="0" dy="0" stdDeviation="12" flood-color="#8B5CF6" flood-opacity="0.55" />
    </filter>
    <filter id="glowCyan" x="-60%" y="-60%" width="220%" height="220%">
      <feDropShadow dx="0" dy="0" stdDeviation="9" flood-color="#22D3EE" flood-opacity="0.50" />
    </filter>
    <filter id="softDrop" x="-30%" y="-30%" width="160%" height="180%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.38" />
    </filter>
    <marker id="arrowHi" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7"
            markerHeight="7" orient="auto">
      <polygon points="0,1 10,5 0,9" fill="{LINE_HI}" />
    </marker>
    <marker id="arrowBlue" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7"
            markerHeight="7" orient="auto">
      <polygon points="0,1 10,5 0,9" fill="{BLUE}" />
    </marker>
    <marker id="arrowGreen" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7"
            markerHeight="7" orient="auto">
      <polygon points="0,1 10,5 0,9" fill="{GREEN}" />
    </marker>
    <marker id="arrowRed" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7"
            markerHeight="7" orient="auto">
      <polygon points="0,1 10,5 0,9" fill="{RED}" />
    </marker>
    <marker id="arrowViolet" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7"
            markerHeight="7" orient="auto">
      <polygon points="0,1 10,5 0,9" fill="{VIOLET}" />
    </marker>{extra}
  </defs>'''.replace("#0A1navy", "#0A1024").replace("#0A1densely", "#0A1024")


def background(aurora=((980, 150, 620, 520), ), cyan=((140, 660, 520, 380), ),
               grid=True):
    parts = [f'<rect id="page-bg" width="{W}" height="{H}" fill="{BG}" />']
    if grid:
        g = []
        for x in range(0, W + 1, 64):
            g.append(f'<line x1="{x}" y1="0" x2="{x}" y2="{H}" stroke="#24406E" '
                     f'stroke-width="1" stroke-opacity="0.10" />')
        for y in range(0, H + 1, 64):
            g.append(f'<line x1="0" y1="{y}" x2="{W}" y2="{y}" stroke="#24406E" '
                     f'stroke-width="1" stroke-opacity="0.10" />')
        parts.append("\n    ".join(g))
    for (cx, cy, rx, ry) in aurora:
        parts.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" '
                     f'fill="url(#aurora)" />')
    for (cx, cy, rx, ry) in cyan:
        parts.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" '
                     f'fill="url(#auroraCyan)" />')
    return '<g id="bg">\n    ' + "\n    ".join(parts) + '\n  </g>'


# ── the roundtable motif ──────────────────────────────────────────────
def orbit_rings(cx, cy, radii, color="#4E7BFF", opacity=0.22, squash=0.42):
    out = []
    for r in radii:
        out.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{r}" ry="{round(r*squash,1)}" '
                   f'fill="none" stroke="{color}" stroke-width="1" '
                   f'stroke-opacity="{opacity}" />')
    return "\n    ".join(out)


def roundtable(cx, cy, rx, seats=None, labels=True, active=None, links=True,
               squash=0.44, seat_r=17, label_fs=12, center_label=None,
               rings=(1.34, 1.62), halo=1.42):
    """Perspective roundtable: elliptical table + seated agent nodes."""
    seats = seats or [a for a in AGENTS if a[0] != "rollback"]
    ry = rx * squash
    n = len(seats)
    out = []

    # halo + table
    out.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx*halo}" ry="{ry*1.7}" '
               f'fill="url(#aurora)" />')
    out.append(orbit_rings(cx, cy, [rx * k for k in rings], opacity=0.16,
                           squash=squash))
    out.append(f'<ellipse cx="{cx}" cy="{cy + ry*0.10}" rx="{rx}" ry="{ry}" '
               f'fill="#0A1struct" fill-opacity="0.55" />'.replace("#0A1struct", "#08122A"))
    out.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" '
               f'fill="url(#tableTop)" stroke="{LINE_HI}" stroke-width="1.4" '
               f'stroke-opacity="0.7" />')
    out.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx*0.62}" ry="{ry*0.62}" '
               f'fill="none" stroke="#5E86FF" stroke-width="1" '
               f'stroke-opacity="0.30" />')

    # seat coordinates: start at the far side, walk clockwise
    import math
    pos = []
    for i in range(n):
        ang = -math.pi / 2 + i * (2 * math.pi / n)
        pos.append((cx + rx * 1.16 * math.cos(ang),
                    cy + ry * 1.30 * math.sin(ang)))

    if links:
        for i in range(n):
            for j in range(i + 1, n):
                x1, y1 = pos[i]
                x2, y2 = pos[j]
                out.append(f'<line x1="{round(x1,1)}" y1="{round(y1,1)}" '
                           f'x2="{round(x2,1)}" y2="{round(y2,1)}" '
                           f'stroke="#5E86FF" stroke-width="1" stroke-opacity="0.13" />')

    if center_label:
        out.append(text(center_label[0], cx, cy - 2, center_label[2], TXT,
                        F_BOLD, "700", "middle"))
        out.append(text(center_label[1], cx, cy + 20, 11, MUTE, F_MONO,
                        anchor="middle", ls=2))

    for i, (key, cn, en, color) in enumerate(seats):
        x, y = pos[i]
        x, y = round(x, 1), round(y, 1)
        is_on = active == key
        r = seat_r * (1.16 if is_on else 1.0)
        if is_on:
            out.append(f'<circle cx="{x}" cy="{y}" r="{round(r*2.0,1)}" '
                       f'fill="{color}" fill-opacity="0.14" />')
            out.append(f'<circle cx="{x}" cy="{y}" r="{round(r*1.45,1)}" '
                       f'fill="none" stroke="{color}" stroke-width="1.2" '
                       f'stroke-opacity="0.55" />')
        out.append(f'<circle cx="{x}" cy="{y}" r="{round(r,1)}" fill="#0B1428" '
                   f'stroke="{color}" stroke-width="2" />')
        out.append(f'<circle cx="{x}" cy="{y}" r="{round(r*0.42,1)}" fill="{color}" />')
        if labels:
            below = y > cy
            ly = y + (r + 20) if below else y - (r + 12)
            out.append(text(cn, x, round(ly, 1), label_fs, TXT, F_SANS, "700",
                            "middle"))
            out.append(text(en.upper(), x, round(ly + 15, 1), 9, color, F_MONO,
                            anchor="middle", ls=1.2))
    return "\n    ".join(out)


# ── page chrome ───────────────────────────────────────────────────────
def header(eyebrow, title, sub=None, accent=BLUE, y=None):
    y = y or 78
    out = [text(eyebrow, M, y, 12, accent, F_MONO, "700", ls=3)]
    out.append(text(title, M, y + 52, 38, TXT, F_BOLD, "900"))
    if sub:
        out.append(para(sub, M, y + 84, CW - 40, 14, 1.5, MUTE))
    return '<g id="header">\n    ' + "\n    ".join(out) + '\n  </g>'


def footer(page, total, label):
    out = [hairline(M, 664, CW, LINE, 1, 0.7),
           text("HERMES  AGENTOS", M, 688, 10, MUTE, F_MONO, ls=2),
           text(label, M + 250, 688, 10, MUTE, F_MONO, ls=1.4),
           text(f"{page:02d} / {total:02d}", W - M, 688, 11, LINE_HI, F_MONO,
                "700", "end", ls=1.6)]
    return ('<g id="page-footer" data-pptx-role="footer">\n    '
            + "\n    ".join(out) + '\n  </g>')


import re

_NUM = r"-?\d+(?:\.\d+)?"


def _attr(tag, name):
    m = re.search(rf'\b{name}="({_NUM})"', tag)
    return float(m.group(1)) if m else None


def _str_attr(tag, name):
    m = re.search(rf'\b{name}="([^"]*)"', tag)
    return m.group(1) if m else None


def element_box(el):
    """Bounding box of one SVG element string, or None."""
    head = el[:el.index(">") + 1] if ">" in el else el
    if el.startswith("<rect"):
        x, y = _attr(head, "x"), _attr(head, "y")
        w, h = _attr(head, "width"), _attr(head, "height")
        if None not in (x, y, w, h):
            return (x, y, x + w, y + h)
    elif el.startswith("<circle"):
        cx, cy, r = _attr(head, "cx"), _attr(head, "cy"), _attr(head, "r")
        if None not in (cx, cy, r):
            return (cx - r, cy - r, cx + r, cy + r)
    elif el.startswith("<ellipse"):
        cx, cy = _attr(head, "cx"), _attr(head, "cy")
        rx, ry = _attr(head, "rx"), _attr(head, "ry")
        if None not in (cx, cy, rx, ry):
            return (cx - rx, cy - ry, cx + rx, cy + ry)
    elif el.startswith("<line"):
        x1, y1 = _attr(head, "x1"), _attr(head, "y1")
        x2, y2 = _attr(head, "x2"), _attr(head, "y2")
        if None not in (x1, y1, x2, y2):
            return (min(x1, x2), min(y1, y2), max(x1, x2), max(y1, y2))
    elif el.startswith("<path"):
        d = _str_attr(head, "d") or ""
        nums = [float(n) for n in re.findall(_NUM, d)]
        xs, ys = nums[0::2], nums[1::2]
        if xs and ys:
            return (min(xs), min(ys), max(xs), max(ys))
    elif el.startswith("<text"):
        x, y = _attr(head, "x"), _attr(head, "y")
        fs = _attr(head, "font-size") or 14
        if x is None or y is None:
            return None
        inner = el[el.index(">") + 1: el.rindex("</text>")]
        segments = re.split(r"<tspan[^>]*>|</tspan>", inner)
        segments = [s for s in segments if s]
        # Bounds use a conservative advance so the declared subcanvas stays
        # wider than any renderer's own glyph metrics.
        widest = max((measure(s, fs) * 1.22 + 10 for s in segments), default=0)
        ls = _attr(head, "letter-spacing") or 0
        widest += ls * max((len(s) for s in segments), default=0)
        dys = [float(v) for v in re.findall(rf'dy="({_NUM})"', inner)]
        anchor = _str_attr(head, "text-anchor") or "start"
        if anchor == "middle":
            x0, x1 = x - widest / 2, x + widest / 2
        elif anchor == "end":
            x0, x1 = x - widest, x
        else:
            x0, x1 = x, x + widest
        return (x0, y - fs * 0.92, x1, y + sum(dys) + fs * 0.28)
    return None


def group_bounds(inner):
    """Layout subcanvas of a root <g>, derived from its drawn elements."""
    els = re.findall(r"<(?:rect|circle|ellipse|line|path|polygon)\b[^>]*/>"
                     r"|<text\b[^>]*>.*?</text>", inner, re.S)
    boxes = [b for b in (element_box(e) for e in els) if b]
    if not boxes:
        return (0, 0, W, H)
    x0 = max(0.0, min(b[0] for b in boxes))
    y0 = max(0.0, min(b[1] for b in boxes))
    x1 = min(float(W), max(b[2] for b in boxes))
    y1 = min(float(H), max(b[3] for b in boxes))
    w = max(1.0, x1 - x0)
    h = max(1.0, y1 - y0)
    return (round(x0, 1), round(y0, 1), round(w, 1), round(h, 1))


def inject_bounds(body):
    """Every root <g> declares its root-coordinate layout subcanvas."""
    def repl(m):
        head, inner = m.group(1), m.group(2)
        if "data-pptx-bounds" in head:
            return m.group(0)
        x, y, w, h = group_bounds(inner)
        head = head.rstrip()[:-1].rstrip() + \
            f' data-pptx-bounds="{x} {y} {w} {h}">'
        return head + inner + "</g>"

    return re.sub(r"(<g\b[^>]*>)(.*?)</g>", repl, body, flags=re.S)


def svg_page(role, body, extra_defs=""):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
            f'width="{W}" height="{H}" data-pptx-page-role="{role}">\n  '
            + defs(extra_defs) + "\n\n  " + inject_bounds(body) + "\n</svg>\n")


def write(name, content):
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
        f.write(content)
    print("wrote", name)


TOTAL = 16
pages = []


# ══ 01 · COVER ════════════════════════════════════════════════════════
def p01():
    b = [background(aurora=((930, 330, 560, 470),), cyan=((120, 700, 480, 340),))]
    b.append('<g id="stage">\n    ' + roundtable(
        912, 372, 232, active="moderator",
        center_label=("AI 圆桌", "ROUNDTABLE", 20)) + '\n  </g>')

    left = [text("HACKATHON  2026    ·    MULTI-AGENT  OPERATING  SYSTEM",
                 M, 96, 12, BLUE, F_MONO, "700", ls=2.6),
            hairline(M, 116, 300, LINE_HI, 2),
            text("Hermes AgentOS", M, 216, 62, TXT, F_BOLD, "900"),
            text("让 AI 开一场圆桌会议", M, 278, 34, "url(#titleGrad)", F_BOLD, "900"),
            para("多个智能体带着不同立场同台辩论，由主持人收敛成一份"
                 "经过质检的可执行方案 —— 而不是让单个模型独自给答案。",
                 M, 336, 470, 15, 1.7, DIM)]
    stats = [("7", "个智能体同席"), ("3", "轮辩论收敛"), ("4", "维出口质检"),
             ("0", "人工介入")]
    for i, (n, l) in enumerate(stats):
        x = M + i * 118
        left.append(text(n, x, 470, 40, TXT, F_BOLD, "900"))
        left.append(text(l, x, 494, 11.5, MUTE))
    left.append(hairline(M, 520, 458, LINE, 1))
    tags = ["圆桌辩论", "输出防火墙", "四级自愈", "经验记忆", "全链路 Trace"]
    tx = M
    for i, t in enumerate(tags):
        tw = measure(t, 12) + 30
        left.append(chip(tx, 544, tw, 30, t, BLUE if i == 0 else MUTE, 12))
        tx += tw + 9
    b.append('<g id="cover-copy">\n    ' + "\n    ".join(left) + '\n  </g>')

    b.append('<g id="page-footer" data-pptx-role="footer">\n    '
             + hairline(M, 664, CW, LINE, 1, 0.7) + "\n    "
             + text("liufelix2004 / hermes-agentos", M, 688, 10, MUTE, F_MONO, ls=1.4)
             + "\n    "
             + text("PITCH  DECK", W - M, 688, 10, MUTE, F_MONO, anchor="end", ls=2)
             + '\n  </g>')
    return svg_page("cover", "\n\n  ".join(b))


# ══ 02 · THE GAP ══════════════════════════════════════════════════════
def p02():
    b = [background(aurora=((1120, 90, 520, 400),), cyan=((90, 690, 420, 300),))]
    b.append(header("01 / THE GAP", "一个 Agent 的答案，没人敢直接用",
                    "模型能力已经够用，缺的是一套让结论「可被质疑、可被推翻、可被验证」的机制"))
    cards = [
        ("01", "单点视角", RED,
         "一个模型一次推理就给结论，缺少对立面。它的盲区就是整个系统的盲区，"
         "没有任何环节会提出反对意见。"),
        ("02", "无从追责", AMBER,
         "答案是怎么来的、哪一步的判断出了问题、依据是什么，全都藏在一次调用里，"
         "出错后无法定位到具体环节。"),
        ("03", "不敢落地", VIOLET,
         "没有质检闸门，输出好坏只能靠人肉复核。最后一公里始终卡在「要不要相信它」，"
         "规模化无从谈起。"),
    ]
    cw = (CW - 32 * 2) / 3
    g = []
    for i, (idx, title, color, desc) in enumerate(cards):
        x = M + i * (cw + 32)
        g.append(panel(x, 232, cw, 240, 16, "url(#glass)", LINE))
        g.append(edge_highlight(x + 24, 233, cw - 48))
        g.append(f'<circle cx="{x+58}" cy="284" r="21" fill="none" '
                 f'stroke="{color}" stroke-width="1.4" />')
        g.append(text(idx, x + 58, 289, 13, color, F_MONO, "700", "middle"))
        g.append(text(title, x + 96, 292, 21, TXT, F_BOLD, "900"))
        g.append(hairline(x + 34, 326, 40, color, 2))
        g.append(para(desc, x + 34, 358, cw - 68, 13.5, 1.72, DIM))
    b.append('<g id="pain-cards">\n    ' + "\n    ".join(g) + '\n  </g>')

    concl = [panel(M, 512, CW, 96, 16, "url(#glassHot)", LINE_HI),
             text("真正缺的，是让多个智能体先把问题「吵清楚」的场",
                  M + 36, 552, 22, TXT, F_BOLD, "900"),
             text("对抗产生盲区覆盖，收敛产生可执行结论，质检产生可信度。",
                  M + 36, 582, 14, DIM)]
    b.append('<g id="conclusion">\n    ' + "\n    ".join(concl) + '\n  </g>')
    b.append(footer(2, TOTAL, "为什么需要圆桌"))
    return svg_page("content", "\n\n  ".join(b))


# ══ 03 · THE ANSWER (hero) ════════════════════════════════════════════
def p03():
    b = [background(aurora=((420, 380, 560, 480),), cyan=((1180, 640, 420, 320),),
                    grid=False)]
    b.append('<g id="hero-stage">\n    ' + roundtable(
        398, 386, 240, active="analyst", rings=(1.30,), halo=1.30,
        center_label=("议题", "TOPIC", 19)) + '\n  </g>')

    right = [text("02 / THE ANSWER", 728, 130, 12, VIOLET, F_MONO, "700", ls=3),
             text("AI 圆桌", 728, 202, 54, TXT, F_BOLD, "900"),
             text("让分歧先发生在系统内部", 728, 250, 25, "url(#titleGrad)",
                  F_BOLD, "900"),
             hairline(728, 282, 88, VIOLET, 2)]
    pts = [
        ("同席不同责", "七个智能体各自带着专业视角入场，数据、调研、分析、撰写、"
                       "质检互相独立，天然形成交叉验证。"),
        ("有立场地发言", "每次发言都带明确立场标签：提案、质疑、补充、收敛 —— "
                        "系统鼓励反对，而不是附和。"),
        ("主持人负责收口", "Moderator 控制议程与轮次，强制在三轮内产出结论，"
                         "杜绝多智能体讨论常见的发散不收尾。"),
    ]
    y = 322
    for i, (t, d) in enumerate(pts):
        right.append(dot(736, y - 5, 4, VIOLET))
        right.append(text(t, 756, y, 17, TXT, F_SANS, "700"))
        right.append(para(d, 756, y + 26, 400, 13, 1.65, MUTE))
        y += 26 + para_h(d, 400, 13, 1.65) + 22
    b.append('<g id="answer-copy">\n    ' + "\n    ".join(right) + '\n  </g>')
    b.append(footer(3, TOTAL, "核心主张 · AI 圆桌"))
    return svg_page("content", "\n\n  ".join(b))


# ══ 04 · ROUNDTABLE MECHANISM ═════════════════════════════════════════
def p04():
    b = [background(aurora=((1140, 110, 500, 400),), cyan=((110, 680, 400, 300),))]
    b.append(header("圆桌 01 / MECHANISM", "四个阶段，把一场讨论变成一次交付",
                    "Moderator 全程掌舵：先定标准，再收集观点，然后合成方案，最后交给质检"))
    phases = [
        ("01", "目标确认", "GOAL", VIOLET,
         "主持人开场即锁定议题、成功标准与轮次上限，讨论有边界才收得住。"),
        ("02", "多轮发言", "DEBATE", INDIGO,
         "参与者按序表态，第二轮起被指派质疑或补充，强制产生对立面。"),
        ("03", "共识合成", "SYNTHESIS", CYAN,
         "主持人汇总共识与分歧，产出最终方案、执行任务与风险清单。"),
        ("04", "出口质检", "FIREWALL", GREEN,
         "共识必须通过 Validator 四维评分，不合格则回炉重修而非直接发布。"),
    ]
    pw = (CW - 26 * 3) / 4
    g = []
    for i, (idx, cn, en, color, desc) in enumerate(phases):
        x = M + i * (pw + 26)
        g.append(panel(x, 236, pw, 250, 16, "url(#glass)", LINE))
        g.append(edge_highlight(x + 22, 237, pw - 44))
        g.append(f'<rect x="{x+28}" y="266" width="46" height="26" rx="6" ry="6" '
                 f'fill="{color}" fill-opacity="0.14" stroke="{color}" '
                 f'stroke-opacity="0.5" stroke-width="1" />')
        g.append(text(idx, x + 51, 284, 12, color, F_MONO, "700", "middle"))
        g.append(text(en, x + 86, 284, 10, MUTE, F_MONO, ls=2))
        g.append(text(cn, x + 28, 336, 24, TXT, F_BOLD, "900"))
        g.append(hairline(x + 28, 362, 36, color, 2))
        g.append(para(desc, x + 28, 394, pw - 56, 13, 1.7, DIM))
        if i < 3:
            g.append(arrow(x + pw + 4, 361, x + pw + 20, 361))
    b.append('<g id="phases">\n    ' + "\n    ".join(g) + '\n  </g>')

    note = [panel(M, 516, CW, 92, 16, "url(#glassSoft)", LINE),
            text("收敛保证", M + 34, 552, 17, TXT, F_SANS, "700"),
            vline(M + 132, 532, 46, LINE, 1),
            para("轮次上限硬编码为 3 —— 讨论可以激烈，但必须在第三轮结束前交出结论。"
                 "主持人不是参与者，它只负责让会议开出结果。",
                 M + 158, 546, CW - 210, 13.5, 1.6, DIM)]
    b.append('<g id="convergence-note">\n    ' + "\n    ".join(note) + '\n  </g>')
    b.append(footer(4, TOTAL, "圆桌机制 · 四阶段"))
    return svg_page("content", "\n\n  ".join(b))


# ══ 05 · SEATS AND STANCES ════════════════════════════════════════════
def p05():
    b = [background(aurora=((1150, 620, 460, 380),), cyan=((110, 120, 400, 300),))]
    b.append(header("圆桌 02 / SEATS", "谁上桌，以及他们被允许说什么",
                    "角色决定视角，立场标签决定发言的性质 —— 两者共同保证讨论不会变成附和"))
    duties = {
        "moderator": "定标准、控轮次、做最终合成",
        "research":  "行业动态、政策与供需研判",
        "analyst":   "指标解读、洞察与分阶段建议",
        "writer":    "结构化表达与成稿输出",
        "data":      "数据采集、口径与置信度标注",
        "validator": "出口质检，四维评分一票否决",
        "rollback":  "失败接管，决策恢复策略",
    }
    g = []
    for i, (key, cn, en, color) in enumerate(AGENTS):
        y = 232 + i * 60
        g.append(panel(M, y, 636, 50, 12, "url(#glassSoft)", LINE))
        g.append(f'<circle cx="{M+34}" cy="{y+25}" r="13" fill="#0B1428" '
                 f'stroke="{color}" stroke-width="2" />')
        g.append(dot(M + 34, y + 25, 5, color))
        g.append(text(cn, M + 60, y + 30, 16, TXT, F_SANS, "700"))
        g.append(text(en.upper(), M + 132, y + 30, 10, color, F_MONO, ls=1.6))
        g.append(vline(M + 224, y + 13, 24, LINE, 1))
        g.append(text(duties[key], M + 248, y + 30, 13.5, DIM))
    b.append('<g id="seat-roster">\n    ' + "\n    ".join(g) + '\n  </g>')

    rx = M + 668
    rw = CW - 668
    st = [panel(rx, 232, rw, 236, 16, "url(#glassHot)", LINE_HI),
          text("STANCE  TAGS", rx + 30, 266, 10.5, CYAN, F_MONO, "700", ls=2.4),
          text("发言必须表态", rx + 30, 302, 24, TXT, F_BOLD, "900")]
    stances = [("propose", "提案", INDIGO), ("challenge", "质疑", RED),
               ("supplement", "补充", CYAN), ("moderate", "主持", VIOLET),
               ("synthesize", "收敛", GREEN)]
    sy = 328
    for en, cn, color in stances:
        st.append(f'<rect x="{rx+30}" y="{sy}" width="9" height="9" rx="2" ry="2" '
                  f'fill="{color}" />')
        st.append(text(en, rx + 50, sy + 9, 12, color, F_MONO, "700"))
        st.append(text(cn, rx + 148, sy + 9, 13, DIM))
        sy += 26
    b.append('<g id="stance-panel">\n    ' + "\n    ".join(st) + '\n  </g>')

    note = [panel(rx, 490, rw, 118, 16, "url(#glassSoft)", LINE),
            text("第二轮起强制分派对立立场", rx + 30, 524, 15, TXT, F_SANS, "700"),
            para("同一批智能体在第二轮被轮流指派为质疑方与补充方，"
                 "确保每个提案都至少被正面挑战过一次。",
                 rx + 30, 550, rw - 60, 12.5, 1.65, MUTE)]
    b.append('<g id="stance-note">\n    ' + "\n    ".join(note) + '\n  </g>')
    b.append(footer(5, TOTAL, "圆桌角色与立场"))
    return svg_page("content", "\n\n  ".join(b))


# ══ 06 · THREE ROUNDS ═════════════════════════════════════════════════
def p06():
    b = [background(aurora=((640, 90, 620, 380),), cyan=((1160, 660, 420, 320),))]
    b.append(header("圆桌 03 / DEBATE", "三轮辩论：从各说各话到互相咬合",
                    "同一个议题在三轮里被反复挤压，观点的质量在对抗中提升"))
    rounds = [
        ("ROUND 1", "各自提案", INDIGO, "propose",
         [("数据员", "#3B82F6", "给出装机、渗透率与价格口径，标注每项置信度"),
          ("研究员", INDIGO, "梳理政策与供需变化，指出三条主线的驱动差异"),
          ("分析师", AMBER, "基于数据提出优先级判断与分阶段建议"),
          ("撰稿员", GREEN, "将初步结论组织为可读的方案骨架")]),
        ("ROUND 2", "交叉质疑", RED, "challenge",
         [("质疑方", RED, "指出增速口径与基数效应混淆，要求重新界定"),
          ("补充方", CYAN, "补上政策退坡的时间窗，修正节奏判断"),
          ("质疑方", RED, "挑战「优先储能」的前提，要求给出反例条件"),
          ("补充方", CYAN, "追加风险项与触发式调整条件")]),
        ("ROUND 3", "收束补强", CYAN, "supplement",
         [("全体", MUTE, "围绕存活下来的方案补齐执行细节"),
          ("分析师", AMBER, "把判断转成可执行的阶段划分与观察指标"),
          ("数据员", "#3B82F6", "确认每条结论都有据可查、来源可标注"),
          ("主持人", VIOLET, "宣布进入合成阶段，停止新增议题")]),
    ]
    cw = (CW - 30 * 2) / 3
    g = []
    for i, (rnd, cn, color, stance, speeches) in enumerate(rounds):
        x = M + i * (cw + 30)
        g.append(panel(x, 232, cw, 366, 16, "url(#glass)", LINE))
        g.append(edge_highlight(x + 24, 233, cw - 48))
        g.append(text(rnd, x + 28, 266, 11, color, F_MONO, "700", ls=2.4))
        g.append(text(cn, x + 28, 302, 23, TXT, F_BOLD, "900"))
        g.append(chip(x + cw - 132, 278, 104, 26, stance, color, 11))
        g.append(hairline(x + 28, 322, cw - 56, LINE, 1))
        sy = 350
        for who, wc, what in speeches:
            g.append(dot(x + 33, sy - 4, 3.5, wc))
            g.append(text(who, x + 46, sy, 13, wc, F_SANS, "700"))
            lines = wrap(what, cw - 76, 12)
            for k, ln in enumerate(lines):
                g.append(text(ln, x + 46, sy + 20 + k * 19, 12, MUTE))
            sy += 20 + len(lines) * 19 + 14
        if i < 2:
            g.append(arrow(x + cw + 4, 414, x + cw + 22, 414))
    b.append('<g id="rounds">\n    ' + "\n    ".join(g) + '\n  </g>')
    b.append(footer(6, TOTAL, "三轮辩论"))
    return svg_page("content", "\n\n  ".join(b))


# ══ 07 · CONSENSUS OUTPUT ═════════════════════════════════════════════
def p07():
    b = [background(aurora=((1130, 110, 500, 400),), cyan=((120, 660, 420, 320),))]
    b.append(header("圆桌 04 / SYNTHESIS", "收敛：一份四段式的结构化交付",
                    "主持人不复述讨论，而是把讨论压缩成能直接派工的结果"))
    # left: funnel
    fn = [panel(M, 232, 470, 288, 16, "url(#glassSoft)", LINE),
          text("SYNTHESIS  FUNNEL", M + 28, 266, 10.5, CYAN, F_MONO, "700", ls=2.4)]
    steps = [("全部发言记录", "12 段观点", MUTE),
             ("识别共识与分歧", "谁反对什么", INDIGO),
             ("压缩为最终方案", "只留可辩护的", VIOLET),
             ("拆解为执行任务", "可直接派工", GREEN)]
    sy = 302
    for i, (t, d, c) in enumerate(steps):
        wdt = 300 - i * 40
        bx = M + 26 + i * 20
        fn.append(f'<rect x="{bx}" y="{sy}" width="{wdt}" height="38" '
                  f'rx="8" ry="8" fill="{c}" fill-opacity="0.12" stroke="{c}" '
                  f'stroke-opacity="0.45" stroke-width="1" />')
        fn.append(text(t, bx + 18, sy + 24, 14, TXT, F_SANS, "700"))
        fn.append(text(d, M + 440, sy + 24, 12, MUTE, anchor="end"))
        if i < 3:
            fn.append(f'<line x1="{bx + wdt/2}" y1="{sy+40}" '
                      f'x2="{bx + 20 + (wdt-40)/2}" y2="{sy+54}" '
                      f'stroke="{LINE_HI}" stroke-width="1.2" '
                      f'marker-end="url(#arrowHi)" />')
        sy += 56
    b.append('<g id="funnel">\n    ' + "\n    ".join(fn) + '\n  </g>')

    # right: 2x2 output cards
    outs = [("共识 AGREEMENTS", GREEN, "各智能体确认的判断，附贡献归属"),
            ("分歧 DISAGREEMENTS", AMBER, "保留未解决的争议，不假装一致"),
            ("执行任务 TASKS", INDIGO, "负责人 / 输入 / 期望产出 / 时限"),
            ("风险项 RISKS", RED, "触发条件与需要盯住的指标")]
    ox, ow = M + 498, (CW - 498 - 28) / 2
    g = []
    for i, (title, color, desc) in enumerate(outs):
        x = ox + (i % 2) * (ow + 28)
        y = 232 + (i // 2) * 152
        g.append(panel(x, y, ow, 134, 14, "url(#glass)", LINE))
        g.append(f'<rect x="{x+24}" y="{y+26}" width="8" height="8" rx="2" ry="2" '
                 f'fill="{color}" />')
        cn, en = title.split(" ", 1)
        g.append(text(cn, x + 42, y + 35, 20, TXT, F_BOLD, "900"))
        g.append(text(en, x + 24, y + 62, 9, color, F_MONO, ls=1.8))
        g.append(para(desc, x + 24, y + 90, ow - 48, 12, 1.6, DIM))
    b.append('<g id="outputs">\n    ' + "\n    ".join(g) + '\n  </g>')

    kv = [panel(M, 540, CW, 68, 14, "url(#glassHot)", LINE_HI),
          text("讨论的价值不在于热闹，而在于最后能派工。",
               M + 34, 574, 17, TXT, F_SANS, "700"),
          text("执行任务清单可以直接喂回任务流水线，由 DAG 调度器接着跑。",
               M + 448, 574, 13.5, DIM)]
    b.append('<g id="handoff">\n    ' + "\n    ".join(kv) + '\n  </g>')
    b.append(footer(7, TOTAL, "共识合成与交付"))
    return svg_page("content", "\n\n  ".join(b))


# ══ 08 · OUTPUT FIREWALL ══════════════════════════════════════════════
def p08():
    b = [background(aurora=((300, 120, 520, 400),), cyan=((1140, 640, 440, 320),))]
    b.append(header("圆桌 05 / FIREWALL", "共识也要过闸：出口防火墙",
                    "圆桌讨论出的最终方案没有豁免权 —— 不过质检，就不允许发布",
                    accent=GREEN))
    # flow
    fl = []
    nodes = [("圆桌共识", 130, VIOLET), ("Validator 四维评分", 220, CYAN)]
    fl.append(panel(M, 244, 200, 74, 12, "url(#glassSoft)", VIOLET))
    fl.append(text("圆桌共识", M + 100, 280, 17, TXT, F_SANS, "700", "middle"))
    fl.append(text("CONSENSUS", M + 100, 300, 9.5, MUTE, F_MONO, anchor="middle", ls=1.6))
    fl.append(arrow(M + 208, 281, M + 248, 281))

    fl.append(panel(M + 256, 232, 268, 98, 12, "url(#glassHot)", CYAN))
    fl.append(text("Validator", M + 390, 268, 19, TXT, F_BOLD, "900", "middle"))
    fl.append(text("四维评分 · 一票否决", M + 390, 292, 13, DIM, anchor="middle"))
    fl.append(text("OUTPUT  FIREWALL", M + 390, 314, 9.5, CYAN, F_MONO,
                   anchor="middle", ls=2))

    fl.append(f'<line x1="{M+532}" y1="281" x2="{M+562}" y2="281" '
              f'stroke="{LINE}" stroke-width="1.2" />')
    fl.append(f'<line x1="{M+562}" y1="252" x2="{M+562}" y2="310" '
              f'stroke="{LINE}" stroke-width="1.2" />')
    fl.append(f'<line x1="{M+562}" y1="252" x2="{M+594}" y2="252" '
              f'stroke="{GREEN}" stroke-width="1.4" marker-end="url(#arrowGreen)" />')
    fl.append(f'<line x1="{M+562}" y1="310" x2="{M+594}" y2="310" '
              f'stroke="{RED}" stroke-width="1.4" marker-end="url(#arrowRed)" />')

    fl.append(f'<rect x="{M+604}" y="232" width="{CW-604}" height="42" rx="21" '
              f'ry="21" fill="{GREEN}" fill-opacity="0.10" stroke="{GREEN}" '
              f'stroke-opacity="0.6" stroke-width="1" />')
    fl.append(text("pass  →  共识发布，执行任务进入流水线", M + 628, 259, 14, GREEN))
    fl.append(f'<rect x="{M+604}" y="290" width="{CW-604}" height="42" rx="21" '
              f'ry="21" fill="{RED}" fill-opacity="0.10" stroke="{RED}" '
              f'stroke-opacity="0.6" stroke-width="1" />')
    fl.append(text("fail  →  failCodes 驱动回滚，主持人重新合成", M + 628, 317, 14, RED))
    b.append('<g id="firewall-flow">\n    ' + "\n    ".join(fl) + '\n  </g>')

    dims = [("accuracy", "准确性", "事实与数据是否站得住", INDIGO),
            ("completeness", "完整性", "议题要求是否全部覆盖", CYAN),
            ("safety", "安全性", "是否越界或含有害内容", RED),
            ("format", "格式", "是否符合下游可消费的结构", GREEN)]
    dw = (CW - 24 * 3) / 4
    g = []
    for i, (en, cn, desc, color) in enumerate(dims):
        x = M + i * (dw + 24)
        g.append(panel(x, 372, dw, 150, 14, "url(#glass)", LINE))
        g.append(text(en.upper(), x + 26, 404, 9.5, color, F_MONO, ls=1.8))
        g.append(text(cn, x + 26, 442, 25, TXT, F_BOLD, "900"))
        g.append(hairline(x + 26, 462, 34, color, 2))
        g.append(para(desc, x + 26, 490, dw - 52, 12.5, 1.55, MUTE))
    b.append('<g id="dimensions">\n    ' + "\n    ".join(g) + '\n  </g>')

    b.append('<g id="loop-note">\n    '
             + text("拦截不是终点：每次不通过都会触发一轮恢复，最多五轮仍不过才升级为人工工单。",
                    M, 566, 14, DIM) + "\n    "
             + text("这条闸门同样作用于每一个 Agent 的中间产出，圆桌只是它守住的最后一道。",
                    M, 592, 14, MUTE) + '\n  </g>')
    b.append(footer(8, TOTAL, "出口防火墙"))
    return svg_page("content", "\n\n  ".join(b))


# ══ 09 · 3D VISUALIZATION ═════════════════════════════════════════════
def p09():
    b = [background(aurora=((880, 400, 560, 460),), cyan=((110, 130, 400, 300),),
                    grid=False)]
    b.append(header("圆桌 06 / STAGE", "看得见的圆桌：3D 实时舞台",
                    "讨论过程不是日志，而是一个可以现场旋转观看的三维场景",
                    accent=CYAN))
    b.append('<g id="stage-3d">\n    ' + roundtable(
        876, 424, 232, active="research", labels=True,
        center_label=("ROUND 2", "DEBATING", 17)) + '\n  </g>')
    # speech bubble on the active seat
    bub = [f'<rect x="948" y="228" width="252" height="76" rx="12" ry="12" '
           f'fill="{INDIGO}" fill-opacity="0.14" stroke="{INDIGO}" '
           f'stroke-opacity="0.55" stroke-width="1" />',
           text("研究员 · challenge", 968, 254, 11.5, INDIGO, F_MONO, ls=1.2),
           para("增速口径与基数效应混淆了，建议按新增装机重新界定。",
                968, 276, 216, 12.5, 1.5, TXT)]
    b.append('<g id="speech-bubble">\n    ' + "\n    ".join(bub) + '\n  </g>')

    feats = [("Three.js + CSS2D", "七个席位环绕圆桌，可自由旋转与缩放视角"),
             ("思考态动画", "头部摆动与光环脉冲，实时反映谁正在推理"),
             ("持久发言气泡", "每位智能体的观点摘要停留在座位上方"),
             ("结论定格", "共识达成后场景统一切换为最终方案展示")]
    g = [panel(M, 232, 470, 376, 16, "url(#glassSoft)", LINE),
         text("为什么值得做成 3D", M + 32, 274, 20, TXT, F_BOLD, "900"),
         para("多智能体最难被感知的是「同时性」—— 谁在等、谁在想、谁在反对。"
              "平铺的聊天流表达不了这件事，一张桌子可以。",
              M + 32, 306, 406, 13.5, 1.7, DIM)]
    y = 380
    for t, d in feats:
        g.append(dot(M + 38, y - 5, 4, CYAN))
        g.append(text(t, M + 56, y, 15, TXT, F_SANS, "700"))
        g.append(para(d, M + 56, y + 22, 372, 12.5, 1.5, MUTE))
        y += 22 + para_h(d, 372, 12.5, 1.5) + 16
    b.append('<g id="viz-features">\n    ' + "\n    ".join(g) + '\n  </g>')
    b.append(footer(9, TOTAL, "3D 圆桌舞台"))
    return svg_page("content", "\n\n  ".join(b))


# ══ 10 · SUPPORTING SYSTEM ════════════════════════════════════════════
def p10():
    b = [background(aurora=((1140, 620, 480, 380),), cyan=((110, 110, 400, 300),))]
    b.append(header("03 / THE BASE", "圆桌敢用，是因为下面有一整套底座",
                    "一场会议开得好不好，取决于参会者靠不靠谱、失败能不能兜住、过程能不能查"))
    layers = [
        ("执行层", "EXECUTION", BLUE,
         "Planner 任务拆解 · DAG 并行调度 · 7 个声明式 Skill Agent"),
        ("治理层", "GOVERNANCE", GREEN,
         "Validator 输出防火墙 · Rollback 四级自愈 · Experience Memory"),
        ("协作层", "COLLABORATION", VIOLET,
         "Moderator 主持的 AI 圆桌 · 立场化多轮辩论 · 共识合成"),
        ("观测层", "OBSERVABILITY", CYAN,
         "Trace 8 阶段全链路 · Snapshot 快照 · Token / Cost 实时归集"),
    ]
    g = []
    for i, (cn, en, color, desc) in enumerate(layers):
        y = 234 + i * 90
        hot = (cn == "协作层")
        g.append(panel(M, y, CW, 76, 14,
                       "url(#glassHot)" if hot else "url(#glassSoft)",
                       LINE_HI if hot else LINE))
        g.append(f'<rect x="{M+1}" y="{y+18}" width="4" height="40" rx="2" ry="2" '
                 f'fill="{color}" />')
        g.append(text(cn, M + 32, y + 38, 20, TXT, F_BOLD, "900"))
        g.append(text(en, M + 32, y + 60, 9.5, color, F_MONO, ls=2))
        g.append(vline(M + 190, y + 20, 36, LINE, 1))
        g.append(text(desc, M + 218, y + 45, 15, DIM))
        if hot:
            g.append(text("← 本次重点", W - M - 30, y + 45, 12, VIOLET, F_MONO,
                          "700", "end", ls=1.2))
    b.append('<g id="layers">\n    ' + "\n    ".join(g) + '\n  </g>')
    b.append('<g id="base-note">\n    '
             + text("接下来三页快速交代底座：能力怎么装、失败怎么救、过程怎么查。",
                    M, 622, 13.5, MUTE) + '\n  </g>')
    b.append(footer(10, TOTAL, "支撑体系总览"))
    return svg_page("content", "\n\n  ".join(b))


# ══ 11 · SKILL + DAG ══════════════════════════════════════════════════
def p11():
    b = [background(aurora=((1120, 120, 480, 380),), cyan=((120, 660, 400, 300),))]
    b.append(header("底座 01 / CAPABILITY", "能力怎么装：声明式 Skill + DAG 调度",
                    "Agent 只声明「它会什么」，调度、重试、观测由运行时统一托管"))
    # left: skill files
    files = [("skill.json", "能力声明 / 版本 / 复杂度"),
             ("prompt.ts", "结构化 Prompt 构建"),
             ("schema.ts", "输出数据结构定义"),
             ("validator.ts", "输出 Schema 校验"),
             ("tools.ts", "工具与数据源绑定")]
    g = [panel(M, 232, 540, 296, 16, "url(#glassSoft)", LINE),
         text("agents/analyst/", M + 30, 268, 12, BLUE, F_MONO, ls=1.2),
         hairline(M + 30, 284, 480, LINE, 1)]
    for i, (n, d) in enumerate(files):
        y = 316 + i * 40
        g.append(text(("└─ " if i == 4 else "├─ ") + n, M + 30, y, 13, TXT, F_MONO))
        g.append(text(d, M + 220, y, 12.5, MUTE))
    g.append(text("新增一个 Agent = 5 个声明式文件 + 0 行调度代码",
                  M + 30, 500, 14, CYAN, F_SANS, "700"))
    b.append('<g id="skill-files">\n    ' + "\n    ".join(g) + '\n  </g>')

    # right: DAG
    rx = M + 568
    rw = CW - 568
    d = [panel(rx, 232, rw, 296, 16, "url(#glass)", LINE),
         text("DAG  SCHEDULER", rx + 30, 266, 10.5, BLUE, F_MONO, "700", ls=2.4),
         text("拓扑分层，能并行的绝不串行", rx + 30, 300, 20, TXT, F_BOLD, "900")]
    nodes = [("数据", "#3B82F6"), ("调研", INDIGO), ("分析", AMBER), ("成稿", GREEN)]
    nw = (rw - 60 - 3 * 18) / 4
    for i, (cn, c) in enumerate(nodes):
        x = rx + 30 + i * (nw + 18)
        d.append(f'<rect x="{x}" y="330" width="{nw}" height="54" rx="10" ry="10" '
                 f'fill="{c}" fill-opacity="0.12" stroke="{c}" '
                 f'stroke-opacity="0.55" stroke-width="1" />')
        d.append(text(cn, x + nw / 2, 356, 15, TXT, F_SANS, "700", "middle"))
        d.append(text(f"LEVEL {i+1}", x + nw / 2, 374, 8.5, c, F_MONO,
                      anchor="middle", ls=1))
        if i < 3:
            d.append(arrow(x + nw + 2, 357, x + nw + 14, 357))
    pts = ["Kahn 拓扑排序自动分层，无需手写编排顺序",
           "同层任务并行执行，上游产出自动注入下游上下文",
           "环依赖立即上报，安全阀防止无限循环"]
    for i, p in enumerate(pts):
        d.append(dot(rx + 36, 418 + i * 30 - 4, 3.5, BLUE))
        d.append(text(p, rx + 50, 418 + i * 30, 13, DIM))
    b.append('<g id="dag">\n    ' + "\n    ".join(d) + '\n  </g>')

    b.append('<g id="cap-note">\n    '
             + panel(M, 548, CW, 60, 14, "url(#glassHot)", LINE_HI) + "\n    "
             + text("调度器不理解业务，只理解依赖 —— 换场景只需换一份任务图，不改调度代码。",
                    M + 34, 586, 15, TXT, F_SANS, "700") + '\n  </g>')
    b.append(footer(11, TOTAL, "Skill 架构与 DAG 调度"))
    return svg_page("content", "\n\n  ".join(b))


# ══ 12 · ROLLBACK + MEMORY ════════════════════════════════════════════
def p12():
    b = [background(aurora=((300, 640, 500, 380),), cyan=((1150, 120, 420, 320),))]
    b.append(header("底座 02 / RESILIENCE", "失败怎么救：四级自愈 + 经验记忆",
                    "失败不是终点，而是恢复流程的入口；每一次成败都会改变下一次的选择",
                    accent=GREEN))
    ladder = [("L1", "快照回滚", "snapshot_restore", GREEN,
               "复用最近一次通过校验的输出，瞬时恢复，零 Token 成本"),
              ("L2", "模型切换", "model_switch", BLUE,
               "按经验记忆的历史成功率排序，依次更换模型重跑"),
              ("L3", "原模型重跑", "rerun", AMBER,
               "无可用备选时以原模型重试，覆盖瞬时抖动类故障"),
              ("L4", "人工升级", "human_escalation", RED,
               "生成含失败原因与操作建议的工单，推送到前端等待介入")]
    g = []
    for i, (lv, cn, en, color, desc) in enumerate(ladder):
        y = 232 + i * 78
        g.append(panel(M, y, 700, 66, 12, "url(#glassSoft)", LINE))
        g.append(f'<rect x="{M+22}" y="{y+18}" width="42" height="30" rx="7" ry="7" '
                 f'fill="{color}" fill-opacity="0.14" stroke="{color}" '
                 f'stroke-opacity="0.55" stroke-width="1" />')
        g.append(text(lv, M + 43, y + 38, 13, color, F_MONO, "700", "middle"))
        g.append(text(cn, M + 80, y + 32, 16, TXT, F_SANS, "700"))
        g.append(text(en, M + 80, y + 52, 9.5, MUTE, F_MONO, ls=0.8))
        g.append(vline(M + 232, y + 16, 34, LINE, 1))
        g.append(text(desc, M + 256, y + 41, 13, DIM))
        if i < 3:
            g.append(f'<line x1="{M+43}" y1="{y+66}" x2="{M+43}" y2="{y+78}" '
                     f'stroke="{LINE}" stroke-width="1" />')
    b.append('<g id="ladder">\n    ' + "\n    ".join(g) + '\n  </g>')

    rx = M + 732
    rw = CW - 732
    mem = [panel(rx, 232, rw, 312, 16, "url(#glassHot)", LINE_HI),
           text("EXPERIENCE  MEMORY", rx + 28, 266, 10.5, CYAN, F_MONO, "700", ls=2.2),
           text("越跑越准", rx + 28, 306, 26, TXT, F_BOLD, "900"),
           para("每次执行都按角色 × 模型 × 任务类型记录成败并落盘，"
                "反过来决定下次选哪个模型、回滚时先试哪个。",
                rx + 28, 336, rw - 56, 13, 1.65, DIM)]
    cyc = [("执行", BLUE), ("沉淀", CYAN), ("决策", GREEN)]
    for i, (t, c) in enumerate(cyc):
        y = 420 + i * 42
        mem.append(f'<circle cx="{rx+42}" cy="{y}" r="9" fill="none" '
                   f'stroke="{c}" stroke-width="1.6" />')
        mem.append(dot(rx + 42, y, 3.2, c))
        mem.append(text(t, rx + 62, y + 5, 15, TXT, F_SANS, "700"))
        if i < 2:
            mem.append(f'<line x1="{rx+42}" y1="{y+11}" x2="{rx+42}" y2="{y+31}" '
                       f'stroke="{LINE_HI}" stroke-width="1.2" '
                       f'marker-end="url(#arrowHi)" />')
    mem.append(f'<path d="M{rx+118} {y+2} L{rx+150} {y+2} L{rx+150} 418 L{rx+118} 418" '
               f'fill="none" stroke="{LINE_HI}" stroke-width="1.2" '
               f'stroke-opacity="0.7" marker-end="url(#arrowHi)" />')
    mem.append(text("闭环", rx + 158, (418 + y) / 2 + 4, 11, MUTE, F_MONO, ls=1))
    b.append('<g id="memory">\n    ' + "\n    ".join(mem) + '\n  </g>')

    b.append('<g id="err-note">\n    '
             + text("错误分类覆盖 DATA / MODEL / TOOL / POLICY 四类，不同错误走不同恢复路径。",
                    M, 578, 13.5, MUTE) + '\n  </g>')
    b.append(footer(12, TOTAL, "自愈与经验记忆"))
    return svg_page("content", "\n\n  ".join(b))


# ══ 13 · OBSERVABILITY ════════════════════════════════════════════════
def p13():
    b = [background(aurora=((640, 100, 600, 380),), cyan=((1160, 650, 420, 320),))]
    b.append(header("底座 03 / OBSERVABILITY", "过程怎么查：8 阶段全链路留痕",
                    "从上下文构建到模型调用再到输出校验，每一步都带模型、Token、成本与耗时",
                    accent=CYAN))
    phases = [("START", MUTE), ("CONTEXT", BLUE), ("MODEL", BLUE),
              ("LLM CALL", CYAN), ("VALIDATE", AMBER), ("SNAPSHOT", VIOLET),
              ("SUCCESS", GREEN), ("FAIL", RED)]
    tw = (CW - 12 * 7) / 8
    g = [hairline(M + tw / 2, 268, CW - tw, LINE, 1)]
    for i, (p, c) in enumerate(phases):
        x = M + i * (tw + 12)
        g.append(dot(x + tw / 2, 268, 5, c))
        g.append(panel(x, 292, tw, 56, 10, "url(#glassSoft)", LINE))
        g.append(text(p, x + tw / 2, 325, 10.5, c, F_MONO, "700", "middle", ls=0.8))
    b.append('<g id="trace-timeline">\n    ' + "\n    ".join(g) + '\n  </g>')

    cards = [("SNAPSHOT", "快照留痕", VIOLET,
              "每次执行的输入与输出双向落盘，既是回放素材，也是快照回滚的恢复源。"),
             ("TOKEN / COST", "成本透明", AMBER,
              "Token 按智能体归集、成本按模型归集，实时汇总到统计接口。"),
             ("DASHBOARD", "运行看板", CYAN,
              "总运行数、成功率、Token 分布与智能体表现对比，一屏掌握全局。")]
    cw = (CW - 30 * 2) / 3
    g2 = []
    for i, (en, cn, color, desc) in enumerate(cards):
        x = M + i * (cw + 30)
        g2.append(panel(x, 384, cw, 176, 16, "url(#glass)", LINE))
        g2.append(edge_highlight(x + 24, 385, cw - 48))
        g2.append(text(en, x + 28, 418, 9.5, color, F_MONO, ls=1.8))
        g2.append(text(cn, x + 28, 456, 24, TXT, F_BOLD, "900"))
        g2.append(hairline(x + 28, 476, 34, color, 2))
        g2.append(para(desc, x + 28, 504, cw - 56, 13, 1.6, DIM))
    b.append('<g id="obs-cards">\n    ' + "\n    ".join(g2) + '\n  </g>')

    b.append('<g id="obs-note">\n    '
             + text("可观测不是事后补的日志 —— 它是回滚决策的输入。没有 Trace 与 Snapshot，就没有自动恢复。",
                    M, 604, 14, DIM) + '\n  </g>')
    b.append(footer(13, TOTAL, "全链路可观测"))
    return svg_page("content", "\n\n  ".join(b))


# ══ 14 · DEMO ═════════════════════════════════════════════════════════
def p14():
    b = [background(aurora=((1120, 640, 480, 380),), cyan=((120, 120, 420, 320),))]
    b.append(header("04 / LIVE DEMO", "现场演示：新能源主线之争",
                    "一个真实会有分歧的议题 —— 储能、光伏、新能源车，哪条最值得优先配置"))
    kpis = [("42.6", "GWh", "储能上半年新增装机"), ("+58.3", "%", "储能装机同比"),
            ("128", "GW", "光伏上半年新增装机"), ("54.7", "%", "新能源车渗透率")]
    kw = (CW - 24 * 3) / 4
    g = []
    for i, (n, u, l) in enumerate(kpis):
        x = M + i * (kw + 24)
        g.append(panel(x, 228, kw, 124, 14, "url(#glass)", LINE))
        g.append(text(n, x + 26, 292, 40, TXT, F_BOLD, "900"))
        g.append(text(u, x + 26 + measure_num(n, 40) + 10, 292, 14, BLUE, F_SANS, "700"))
        g.append(hairline(x + 26, 308, 32, BLUE, 2))
        g.append(text(l, x + 26, 334, 12, MUTE))
    b.append('<g id="kpis">\n    ' + "\n    ".join(g) + '\n  </g>')

    d = [panel(M, 376, 700, 172, 16, "url(#glassHot)", LINE_HI),
         text("ROUNDTABLE  TOPIC", M + 30, 410, 10.5, VIOLET, F_MONO, "700", ls=2.2),
         para("储能、光伏、新能源车三条主线中，当前哪条最值得优先配置？"
              "要求数据员给出装机与渗透率、研究员分析供需与政策、"
              "分析师给出分阶段建议、撰稿员汇总为可执行方案，最后必须通过质检。",
              M + 30, 442, 640, 14, 1.7, TXT)]
    b.append('<g id="topic">\n    ' + "\n    ".join(d) + '\n  </g>')

    rx = M + 732
    rw = CW - 732
    m = [panel(rx, 376, rw, 172, 16, "url(#glassSoft)", GREEN),
         text("MOCK_LLM = 1", rx + 28, 410, 11, GREEN, F_MONO, "700", ls=1.4),
         text("零依赖演示", rx + 28, 448, 24, TXT, F_BOLD, "900"),
         para("没有 API Key 也能跑通整场圆桌：辩论、收敛、质检、回滚与 Trace "
              "全部真实执行，只有模型响应来自内置数据集。",
              rx + 28, 476, rw - 56, 12.5, 1.6, DIM)]
    b.append('<g id="mock">\n    ' + "\n    ".join(m) + '\n  </g>')

    b.append('<g id="demo-note">\n    '
             + text("演示数据为仓库内置模拟数据集，字段结构与真实数据源一致。",
                    M, 590, 13, MUTE) + '\n  </g>')
    b.append(footer(14, TOTAL, "演示场景"))
    return svg_page("content", "\n\n  ".join(b))


# ══ 15 · DIFFERENTIATION ══════════════════════════════════════════════
def p15():
    b = [background(aurora=((300, 110, 520, 400),), cyan=((1150, 650, 420, 320),))]
    b.append(header("05 / WHY US", "和常见多智能体方案的关键差别",
                    "差别不在能不能跑通，而在结论从哪来、跑不通时会发生什么"))
    rows = [("协作形态", "链式调用或主从分发，角色之间不交锋",
             "有主持人、有立场、能收敛的圆桌辩论"),
            ("结论来源", "单个模型一次推理的输出", "多视角对抗后被保留下来的部分"),
            ("输出质量", "依赖 Prompt 约束与人工复核", "四维评分防火墙，不合格直接拦截"),
            ("失败处理", "重试若干次，失败即抛错", "四级自愈阶梯，最终降级为带建议的工单"),
            ("模型选择", "静态配置，改模型要改代码", "经验记忆按历史成功率动态选型")]
    c1, c2 = 168, 396
    c3 = CW - c1 - c2 - 36
    g = [text("维度", M, 246, 10.5, MUTE, F_MONO, ls=2),
         text("常见做法", M + c1, 246, 10.5, MUTE, F_MONO, ls=2),
         text("HERMES  AGENTOS", M + c1 + c2 + 36, 246, 10.5, VIOLET, F_MONO,
              "700", ls=2),
         hairline(M, 264, CW, LINE_HI, 1.4)]
    for i, (dim, other, ours) in enumerate(rows):
        y = 290 + i * 66
        hot = (i == 0)
        g.append(text(dim, M, y + 30, 16, TXT, F_SANS, "700"))
        g.append(para(other, M + c1, y + 26, c2 - 24, 13, 1.5, MUTE))
        g.append(f'<rect x="{M+c1+c2+16}" y="{y+2}" width="{c3+20}" height="52" '
                 f'rx="10" ry="10" fill="url(#glassHot)" stroke="'
                 f'{VIOLET if hot else LINE}" stroke-opacity="'
                 f'{0.6 if hot else 1}" stroke-width="1" />')
        g.append(para(ours, M + c1 + c2 + 36, y + 26, c3, 13, 1.5, TXT))
        if i < 4:
            g.append(hairline(M, y + 60, CW, LINE, 1, 0.55))
    b.append('<g id="compare">\n    ' + "\n    ".join(g) + '\n  </g>')
    b.append('<g id="cmp-note">\n    '
             + text("我们不打算取代编排框架 —— 我们补的是它们普遍留白的那两层：对抗与治理。",
                    M, 624, 13.5, MUTE) + '\n  </g>')
    b.append(footer(15, TOTAL, "差异化定位"))
    return svg_page("content", "\n\n  ".join(b))


# ══ 16 · CLOSING ══════════════════════════════════════════════════════
def p16():
    b = [background(aurora=((980, 400, 560, 460),), cyan=((140, 130, 420, 320),),
                    grid=False)]
    b.append('<g id="closing-stage">\n    ' + roundtable(
        946, 400, 200, labels=False, active="moderator",
        center_label=("共识达成", "CONSENSUS", 17)) + '\n  </g>')
    left = [text("06 / WHAT’S NEXT", M, 112, 12, BLUE, F_MONO, "700", ls=3),
            text("从一场会议，到一套会议制度", M, 168, 34, TXT, F_BOLD, "900")]
    road = [("NEXT", "动态议程", BLUE, "主持人根据议题复杂度自行决定轮次与参会角色"),
            ("THEN", "Skill 市场", CYAN, "基于版本做能力灰度与自动回滚，圆桌可自由组队"),
            ("LATER", "成本护栏", VIOLET, "预算上限与配额隔离，让长辩论也花得可控")]
    y = 224
    for tag, t, c, d in road:
        left.append(f'<rect x="{M}" y="{y-16}" width="58" height="22" rx="5" ry="5" '
                    f'fill="{c}" fill-opacity="0.14" stroke="{c}" '
                    f'stroke-opacity="0.5" stroke-width="1" />')
        left.append(text(tag, M + 29, y, 9.5, c, F_MONO, "700", "middle", ls=1))
        left.append(text(t, M + 74, y, 17, TXT, F_SANS, "700"))
        left.append(para(d, M + 74, y + 24, 452, 12.5, 1.5, MUTE))
        y += 24 + para_h(d, 452, 12.5, 1.5) + 22
    left.append(hairline(M, 424, 528, LINE, 1))
    left.append(text("Hermes AgentOS", M, 496, 46, TXT, F_BOLD, "900"))
    left.append(text("让 AI 开一场圆桌会议", M, 542, 25, "url(#titleGrad)",
                     F_BOLD, "900"))
    left.append(text("感谢观看 — 欢迎现场提问与实机演示", M, 578, 13.5, MUTE))
    b.append('<g id="closing-copy">\n    ' + "\n    ".join(left) + '\n  </g>')
    b.append('<g id="page-footer" data-pptx-role="footer">\n    '
             + hairline(M, 664, CW, LINE, 1, 0.7) + "\n    "
             + text("liufelix2004 / hermes-agentos", M, 688, 10, MUTE, F_MONO, ls=1.4)
             + "\n    "
             + text("THANK  YOU", W - M, 688, 10, LINE_HI, F_MONO, "700",
                    "end", ls=3) + '\n  </g>')
    return svg_page("ending", "\n\n  ".join(b))


PAGES = [
    ("01_cover.svg", p01), ("02_the_gap.svg", p02), ("03_the_answer.svg", p03),
    ("04_mechanism.svg", p04), ("05_seats_stances.svg", p05),
    ("06_three_rounds.svg", p06), ("07_synthesis.svg", p07),
    ("08_firewall.svg", p08), ("09_stage_3d.svg", p09),
    ("10_the_base.svg", p10), ("11_skill_dag.svg", p11),
    ("12_resilience.svg", p12), ("13_observability.svg", p13),
    ("14_demo.svg", p14), ("15_why_us.svg", p15), ("16_closing.svg", p16),
]

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for name, fn in PAGES:
        write(name, fn())
    print("done:", len(PAGES), "pages")
