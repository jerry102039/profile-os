"""把 profile 資料夾裡 public/certs/*.pdf 的第一頁轉成圖片：
  <id>.png / <id>.webp              大圖（1600px 寬），點開證照時顯示（瀏覽器優先用 WebP，小很多）
  <id>.thumb.jpg / <id>.thumb.webp  縮圖（480px 寬），證照視窗的小圖牆用
public/resume.pdf 則每一頁都轉成 public/resume/<n>.png、.webp、.sm.webp。

profile 資料夾跟網站 build 時用同一個：環境變數 PROFILE_DIR → profile/ → profile.example/

用法：python scripts/certs-to-png.py          # 只轉還沒有圖的
      python scripts/certs-to-png.py --force  # 全部重轉
需要：pip install pypdfium2
"""
import os
import sys
from pathlib import Path

import pypdfium2 as pdfium

REPO = Path(__file__).resolve().parent.parent


def env(name: str) -> str:
    """環境變數優先，沒有就讀 .env（跟網站 build 一樣）"""
    if os.environ.get(name):
        return os.environ[name]
    dotenv = REPO / ".env"
    if dotenv.exists():
        for line in dotenv.read_text(encoding="utf-8").splitlines():
            key, sep, value = line.partition("=")
            if sep and key.strip() == name and not line.lstrip().startswith("#"):
                return value.strip().strip("'\"")
    return ""


if env("PROFILE_DIR"):
    PROFILE = (REPO / env("PROFILE_DIR")).resolve()
elif (REPO / "profile").is_dir():
    PROFILE = REPO / "profile"
else:
    PROFILE = REPO / "profile.example"
PUBLIC = PROFILE / "public"
print(f"profile: {PROFILE}")
ROOT = PUBLIC / "certs"
FORCE = "--force" in sys.argv
WIDTH = 1600
SMALL = 800   # 履歷的小尺寸版本：手機與 1x 螢幕用這張就夠
THUMB = 480
WEBP = {"quality": 82, "method": 6}


def kb(p: Path) -> str:
    return f"{p.stat().st_size // 1024} KB"


# 履歷：public/resume.pdf 的每一頁 → public/resume/1.png、1.webp、1.sm.webp…（履歷視窗用圖片顯示，PDF 留給下載）
resume = PUBLIC / "resume.pdf"
if resume.exists():
    out = PUBLIC / "resume"
    out.mkdir(exist_ok=True)
    for old in list(out.glob("*.png")) + list(out.glob("*.webp")):
        old.unlink()
    doc = pdfium.PdfDocument(str(resume))
    for i in range(len(doc)):
        page = doc[i]
        w, _ = page.get_size()
        img = page.render(scale=WIDTH / w, draw_annots=True).to_pil().convert("RGB")
        png = out / f"{i + 1}.png"
        webp = out / f"{i + 1}.webp"
        small = out / f"{i + 1}.sm.webp"
        img.save(png, optimize=True)
        img.save(webp, "WEBP", **WEBP)
        sm = img.copy()
        sm.thumbnail((SMALL, SMALL * 3))
        sm.save(small, "WEBP", **WEBP)
        print(f"wrote resume/{png.name} {img.width}x{img.height} {kb(png)} · {webp.name} {kb(webp)} · {small.name} {kb(small)}")

for pdf in sorted(ROOT.glob("*.pdf")):
    png = pdf.with_suffix(".png")
    webp = pdf.with_suffix(".webp")
    thumb = pdf.with_name(pdf.stem + ".thumb.jpg")
    thumb_webp = pdf.with_name(pdf.stem + ".thumb.webp")
    if all(p.exists() for p in (png, webp, thumb, thumb_webp)) and not FORCE:
        print(f"skip  {pdf.stem}")
        continue
    page = pdfium.PdfDocument(str(pdf))[0]
    w, _ = page.get_size()
    image = page.render(scale=WIDTH / w, draw_annots=True).to_pil().convert("RGB")
    image.save(png, optimize=True)
    image.save(webp, "WEBP", **WEBP)
    small = image.copy()
    small.thumbnail((THUMB, THUMB * 3))
    small.save(thumb, quality=85, optimize=True)
    small.save(thumb_webp, "WEBP", **WEBP)
    print(f"wrote {png.name} {image.width}x{image.height} {kb(png)} · {webp.name} {kb(webp)} · {thumb.name} {kb(thumb)} · {thumb_webp.name} {kb(thumb_webp)}")
