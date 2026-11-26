"""The rulebook .docx (as the repo writes it) -> HTML.
  python tools/docx-to-html.py <docx> <html out>     print HTML for headless Edge (the PDF)
  python tools/docx-to-html.py --web <docx> <folder> the art board's Rules tab: <folder>/rulebook.html (a fragment, no
                                                     page styles) and its pictures in <folder>/img/"""
import sys, os, zipfile, base64, html, re
import xml.etree.ElementTree as ET
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
WP = "{http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing}"
WEB = sys.argv[1] == "--web"
if WEB: sys.argv.pop(1)
z = zipfile.ZipFile(sys.argv[1])
rels = {m.group(1): m.group(2) for m in re.finditer(r'Id="([^"]+)"[^>]*Target="([^"]+)"', z.read("word/_rels/document.xml.rels").decode())}
title = re.search(r"<dc:title>([^<]*)</dc:title>", z.read("docProps/core.xml").decode())
title = title.group(1) if title else "Rulebook"
body = ET.fromstring(z.read("word/document.xml")).find(W + "body")
esc = html.escape

def runs(p):
    out = []
    for r in p.iter(W + "r"):
        rp = r.find(W + "rPr"); st = []
        if rp is not None:
            if rp.find(W + "b") is not None: st.append("b")
            if rp.find(W + "i") is not None: st.append("i")
            if rp.find(W + "strike") is not None: st.append("s")
            c = rp.find(W + "color")
        else: c = None
        txt = ""
        for el in r:
            if el.tag == W + "t": txt += esc(el.text or "")
            elif el.tag == W + "br": txt += "<br>"
            elif el.tag == W + "tab": txt += "&emsp;"
            elif el.tag == W + "drawing":
                blip = el.find(f".//{A}blip"); ext = el.find(f".//{WP}extent")
                src = "word/" + rels[blip.get(R + "embed")]
                mm = int(ext.get("cx")) / 36000 if ext is not None else None
                if WEB:   # a file next to the fragment, linked relatively
                    name = os.path.basename(src); os.makedirs(os.path.join(sys.argv[2], "img"), exist_ok=True)
                    open(os.path.join(sys.argv[2], "img", name), "wb").write(z.read(src)); url = "img/" + name
                else: url = "data:image/png;base64," + base64.b64encode(z.read(src)).decode()
                txt += f'<img src="{url}" alt=""' + (f' style="width:{mm:.1f}mm"' if mm else "") + ">"
        if not txt: continue
        for s in st: txt = f"<{s}>{txt}</{s}>"
        if c is not None and c.get(W + "val") not in (None, "auto"): txt = f'<span style="color:#{c.get(W + "val")}">{txt}</span>'
        out.append(txt)
    return "".join(out)

def pinfo(p):
    pp = p.find(W + "pPr"); style = num = None
    if pp is not None:
        s = pp.find(W + "pStyle"); style = s.get(W + "val") if s is not None else None
        n = pp.find(W + "numPr")
        if n is not None: num = n.find(W + "numId").get(W + "val")
    return style, num

TAG = {"Title": "h1", "Heading1": "h2", "Heading2": "h3"}
def table(t):
    grid = [int(g.get(W + "w")) for g in t.iter(W + "gridCol")]; tot = sum(grid) or 1
    rows = []
    for tr in t.findall(W + "tr"):
        head = tr.find(f"{W}trPr/{W}tblHeader") is not None; cells = []
        for tc in tr.findall(W + "tc"):
            pr = tc.find(W + "tcPr"); attrs = ""
            if pr is not None:
                sh = pr.find(W + "shd"); span = pr.find(W + "gridSpan")
                if sh is not None and sh.get(W + "fill") not in (None, "auto"): attrs += f' style="background:#{sh.get(W + "fill")}"'
                if span is not None: attrs += f' colspan="{span.get(W + "val")}"'
            inner = "".join(f"<p>{runs(p)}</p>" for p in tc.findall(W + "p"))
            cells.append(f"<{'th' if head else 'td'}{attrs}>{inner}</{'th' if head else 'td'}>")
        rows.append(("<thead>" if head else "") + "<tr>" + "".join(cells) + "</tr>" + ("</thead>" if head else ""))
    cols = "".join(f'<col style="width:{100 * g / tot:.2f}%">' for g in grid)
    return f"<table><colgroup>{cols}</colgroup>{''.join(rows)}</table>"

out, lst = [], None   # lst = (numId, tag) of the list being built
def close():
    global lst
    if lst: out.append(f"</{lst[1]}>"); lst = None
for el in body:
    if el.tag == W + "p":
        style, num = pinfo(el); content = runs(el)
        if num:
            tag = "ul" if num == "1" else "ol"
            if not lst or lst[0] != num: close(); out.append(f"<{tag}>"); lst = (num, tag)
            out.append(f"<li>{content}</li>"); continue
        close()
        if not content: continue
        if style in TAG: out.append(f"<{TAG[style]}>{content}</{TAG[style]}>")
        else: out.append(f'<p class="{(style or "Normal").lower()}">{content}</p>')
    elif el.tag == W + "tbl":
        close(); out.append(table(el))
close()
if WEB:   # the art board styles it; data-pdf names the PDF next to the docx
    pdf = os.path.basename(sys.argv[1]).replace(" (editable).docx", ".pdf")
    open(os.path.join(sys.argv[2], "rulebook.html"), "w", encoding="utf-8", newline="\n").write(
        f'<div class="rb" data-title="{esc(title)}" data-pdf="{esc(pdf)}">{"".join(out)}</div>\n')
    print("blocks:", len(out)); sys.exit()
CSS = f"""@page {{ size: A4; margin: 20mm 20mm 18mm; @bottom-center {{ content: "{esc(title)}  ·  Page " counter(page); font: 8.5pt Arial, sans-serif; color: #888; }} }}
html, body {{ margin: 0; background: #fff; }}
body {{ font: 10.5pt/1.38 Arial, sans-serif; color: #1a1a1a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
h1 {{ text-align: center; color: #5B2A86; font-size: 26pt; margin: 0 0 4mm; }}
p.tagline {{ text-align: center; font-weight: bold; font-size: 16pt; margin: 2mm 0 3mm; }}
h2 {{ color: #5B2A86; font-size: 17pt; margin: 7mm 0 2.5mm; padding-bottom: 1mm; border-bottom: 0.4mm solid #B79BDB; break-after: avoid; }}
h3 {{ color: #333; font-size: 13pt; margin: 5mm 0 1.5mm; break-after: avoid; }}
p {{ margin: 0 0 2.2mm; }}
ul, ol {{ margin: 0 0 2.5mm; padding-left: 7mm; }} li {{ margin: 0 0 1mm; }}
p.example {{ background: #F3EEFA; border-left: 1.2mm solid #B79BDB; padding: 2mm 3mm; margin: 1mm 5mm 3mm; font-style: italic; }}
p.figure {{ text-align: center; margin: 2mm 0 1mm; break-after: avoid; }} p.figure img {{ max-width: 100%; }}
p.caption {{ text-align: center; font-style: italic; color: #666; font-size: 9pt; margin-bottom: 4mm; }}
table {{ width: 100%; border-collapse: collapse; margin: 1.5mm 0 4mm; table-layout: fixed; }}
th, td {{ border: 0.25mm solid #BFBFBF; padding: 1mm 1.8mm; vertical-align: top; text-align: left; font-size: 9.5pt; line-height: 1.3; }}
th p, td p {{ margin: 0; }} tr {{ break-inside: avoid; }} thead {{ display: table-header-group; }}
img {{ vertical-align: middle; }} td img, li img, p.normal img {{ max-height: 6mm; width: auto !important; }}"""
open(sys.argv[2], "w", encoding="utf-8", newline="\n").write(
    f'<!doctype html><html lang="en"><head><meta charset="utf-8"><title>{esc(title)}</title><style>{CSS}</style></head><body>{"".join(out)}</body></html>')
print("blocks:", len(out))
