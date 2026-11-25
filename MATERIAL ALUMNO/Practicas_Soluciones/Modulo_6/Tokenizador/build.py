"""Une src/ en un único HTML autocontenido: TokenizadorIA_CSV.html (doble clic para abrir, sin internet).
Uso:  py build.py"""
import pathlib

BASE = pathlib.Path(__file__).resolve().parent
SRC = BASE / 'src'
SCRIPTS = ['municipios.js', 'direcciones.js', 'delitos.js', 'engine.js', 'csv.js', 'lectores.js', 'ui_comun.js', 'ui_texto.js', 'ui_csv.js']

def main():
    partes = [(SRC / 'head.html').read_text('utf-8')]
    for nombre in SCRIPTS:
        f = SRC / nombre
        if not f.exists():
            continue
        js = f.read_text('utf-8')
        if '</script' in js.lower():
            raise SystemExit(f'{nombre} contiene "</script": rompería el HTML')
        partes.append(f'<script>\n/* ===== {nombre} ===== */\n{js}\n</script>')
    partes.append('</body>\n</html>\n')
    out = BASE / 'TokenizadorIA_CSV.html'
    out.write_text('\n'.join(partes), 'utf-8')
    print(f'OK -> {out.name} ({out.stat().st_size // 1024} KB)')

if __name__ == '__main__':
    main()
