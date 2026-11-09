"""
Convierte las ecuaciones LaTeX de un .docx exportado desde Claude Docs en ecuaciones nativas de Word (OMML).

Claude Docs exporta cada bloque de código LaTeX como un párrafo con estilo "Code" y un marcador
"bongo_lang_latex_N". Este script reemplaza cada uno por la ecuación equivalente, centrada,
generada con pandoc. El resto del documento (texto, tablas, imágenes, estilos) no se modifica.

Uso:  python convertir_ecuaciones.py entrada.docx salida.docx
Requiere pandoc instalado.
"""
import re
import subprocess
import sys
import tempfile
import zipfile
from html import unescape
from pathlib import Path

NS_M = 'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"'


def latex_a_omml(latex):
    with tempfile.TemporaryDirectory() as d:
        md, out = Path(d) / "e.md", Path(d) / "e.docx"
        md.write_text(f"$$\n{latex}\n$$\n", encoding="utf-8")
        subprocess.run(["pandoc", str(md), "-o", str(out)], check=True)
        xml = zipfile.ZipFile(out).read("word/document.xml").decode("utf-8")
    m = re.search(r"<m:oMathPara>.*</m:oMathPara>", xml, re.S)
    if not m:
        raise ValueError(f"pandoc no generó una ecuación para: {latex[:60]}")
    return m.group(0)


def texto_de(parrafo):
    partes = re.findall(r"<w:t(?:\s[^>]*)?>(.*?)</w:t>|(<w:br/>)", parrafo, re.S)
    return unescape("".join(t if t else "\n" for t, br in partes)).strip()


def main(entrada, salida):
    zin = zipfile.ZipFile(entrada)
    doc = zin.read("word/document.xml").decode("utf-8")
    patron = re.compile(r"<w:p>(?:(?!</w:p>).)*?bongo_lang_latex_\d+(?:(?!</w:p>).)*</w:p>", re.S)
    n, fallos = 0, []

    def reemplazar(m):
        nonlocal n
        latex = texto_de(m.group(0))
        try:
            omml = latex_a_omml(latex)
        except Exception as e:                       # se deja el párrafo original si falla
            fallos.append(str(e))
            return m.group(0)
        n += 1
        return f'<w:p><w:pPr><w:jc w:val="center"/></w:pPr>{omml}</w:p>'

    doc = patron.sub(reemplazar, doc)
    if "xmlns:m=" not in doc[:3000]:
        doc = doc.replace("<w:document ", f"<w:document {NS_M} ", 1)
    with zipfile.ZipFile(salida, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            datos = doc.encode("utf-8") if item.filename == "word/document.xml" else zin.read(item.filename)
            zout.writestr(item, datos)
    print(f"{n} ecuaciones convertidas -> {salida}")
    for f in fallos:
        print("  sin convertir:", f)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
