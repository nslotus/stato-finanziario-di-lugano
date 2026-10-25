"""A second, independent PDF reader for npm run verify (check 15).

The build reads the City's PDFs with pdf.js. To make sure a fault in that reader cannot hide itself, check 15 reads the
same pages again with pypdf, a separate implementation written in Python, and compares. This script prints, for each
requested page, the page's text and its text runs with their position, as JSON:

    python src/pdftext.py sources/<file>.pdf 221,222,223
    -> {"221": {"text": "...", "runs": [[x, y, "text"], ...]}, ...}

y grows upwards, as in PDF user space. Requires pypdf (pinned in requirements-verify.txt).
"""

import json
import sys

from pypdf import PdfReader


def page_data(page):
    runs = []

    def visit(text, cm, tm, font, size):
        t = text.strip()
        if not t:
            return
        # position of the run in user space: the text matrix, then the current transformation matrix
        x = tm[4] * cm[0] + tm[5] * cm[2] + cm[4]
        y = tm[4] * cm[1] + tm[5] * cm[3] + cm[5]
        runs.append([round(x, 1), round(y, 1), t])

    text = page.extract_text(visitor_text=visit)
    return {"text": text, "runs": runs}


def main():
    file, pages = sys.argv[1], [int(p) for p in sys.argv[2].split(",") if p]
    reader = PdfReader(file)
    if not pages:
        pages = list(range(1, len(reader.pages) + 1))
    out = {str(p): page_data(reader.pages[p - 1]) for p in pages if 1 <= p <= len(reader.pages)}
    sys.stdout.write(json.dumps(out))  # ASCII with escapes: safe whatever the console encoding


if __name__ == "__main__":
    main()
