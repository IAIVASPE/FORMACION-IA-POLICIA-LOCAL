# -*- coding: utf-8 -*-
"""
GENERADOR DE DATOS FICTICIOS - Practica "Mapa de calor delincuencial"
Curso de IA aplicada a la funcion policial

Crea un registro SINTETICO de hechos delictivos dentro del termino municipal que
indique el archivo de limite oficial (GeoJSON). Sirve para CUALQUIER municipio.
Las "zonas calientes" se colocan automaticamente en puntos interiores del termino:
son ficticias y no se corresponden con calles concretas.
Solo usa la biblioteca estandar de Python (no hay que instalar nada).

Uso más sencillo: doble clic en "Generar datos.bat" (misma carpeta que este script) o
    python solo_profesor/generar_datos.py
sin nada más: pregunta el municipio, descarga su límite (IGN) y sus direcciones
(CartoCiudad) y deja los datos en Ejemplos/<Municipio>.

Uso avanzado (desde la carpeta de la practica):
    python solo_profesor/generar_datos.py
    python solo_profesor/generar_datos.py 3000 2025 limite_municipal.geojson
        argumentos: numero de registros, semilla, archivo de limite
    python solo_profesor/generar_datos.py 3000 2025 limite.geojson portales.csv CARPETA_SALIDA
        para otro municipio: limite, portales (CartoCiudad) y carpeta donde dejar los datos

Si existe solo_profesor/puntos_calle.csv (latitud,longitud de puntos a lo largo de
las calles, p. ej. extraidos de OpenStreetMap), cada hecho se coloca sobre una calle
real, como haria la geocodificacion de una direccion en un atestado.

Genera en la carpeta de la practica:
    incidentes_<municipio>_2025_direcciones.csv  calle y numero (lo que se entrega)
No crea ninguna otra carpeta ni archivo.
"""
import csv
import json
import math
import os
import random
import sys
import re
import unicodedata
from datetime import date, timedelta


# ==========================================================================
# ASISTENTE: si se ejecuta sin argumentos (doble clic o "python generar_datos.py"),
# pregunta el municipio, descarga su límite oficial (IGN) y sus portales
# (CartoCiudad) y deja los datos en Ejemplos/<Municipio>.
# ==========================================================================
import urllib.parse
import urllib.request

API_IGN = "https://api-features.ign.es/collections/administrativeunit/items"
API_CARTO = "https://api-features.idee.es/collections/address/items"
PROVINCIAS_INE = {"01": "Araba/Álava", "02": "Albacete", "03": "Alicante/Alacant", "04": "Almería", "05": "Ávila",
    "06": "Badajoz", "07": "Illes Balears", "08": "Barcelona", "09": "Burgos", "10": "Cáceres", "11": "Cádiz",
    "12": "Castellón/Castelló", "13": "Ciudad Real", "14": "Córdoba", "15": "A Coruña", "16": "Cuenca",
    "17": "Girona", "18": "Granada", "19": "Guadalajara", "20": "Gipuzkoa", "21": "Huelva", "22": "Huesca",
    "23": "Jaén", "24": "León", "25": "Lleida", "26": "La Rioja", "27": "Lugo", "28": "Madrid", "29": "Málaga",
    "30": "Murcia", "31": "Navarra", "32": "Ourense", "33": "Asturias", "34": "Palencia", "35": "Las Palmas",
    "36": "Pontevedra", "37": "Salamanca", "38": "Santa Cruz de Tenerife", "39": "Cantabria", "40": "Segovia",
    "41": "Sevilla", "42": "Soria", "43": "Tarragona", "44": "Teruel", "45": "Toledo", "46": "Valencia/València",
    "47": "Valladolid", "48": "Bizkaia", "49": "Zamora", "50": "Zaragoza", "51": "Ceuta", "52": "Melilla"}
MAX_PORTALES = 1500          # muestra de portales para generar (rápido y suficiente)


def _get_json(url, intentos=3):
    import time
    for k in range(1, intentos + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "practica-mapa-calor"})
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            if k == intentos:
                raise
            time.sleep(2 * k)


def _sin_tildes(t):
    return unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode().lower().strip()


def _preguntar(texto, defecto=None):
    r = input(f"{texto}{f' [{defecto}]' if defecto is not None else ''}: ").strip()
    return r or (str(defecto) if defecto is not None else "")


def _buscar_municipio(q):
    patron = re.sub(r"[aeiouáéíóúàèìòùäëïöü]", "_", q.replace("'", "''").replace("%", "").replace("_", ""), flags=re.I)
    filtros = [f"(nameunit ILIKE '{patron}%' OR nameunit ILIKE '%/{patron}%') AND nationallevelname = 'Municipio'",
               f"nameunit ILIKE '%{patron}%' AND nationallevelname = 'Municipio'"]
    vistos, lista = set(), []
    for f in filtros:
        url = (f"{API_IGN}?f=json&limit=60&skipGeometry=true&properties=nameunit,nationalcode"
               f"&filter-lang=cql-text&filter={urllib.parse.quote(f)}")
        for ft in _get_json(url).get("features", []):
            p = ft["properties"]
            if p["nationalcode"] not in vistos:
                vistos.add(p["nationalcode"])
                lista.append(p)
    nq = _sin_tildes(q)

    def nota(n):
        partes = [_sin_tildes(x) for x in [n] + n.split("/")]
        return 0 if nq in partes else 1 if any(x.startswith(nq) for x in partes) else 2 if any(nq in x for x in partes) else 3
    lista.sort(key=lambda p: (nota(p["nameunit"]), _sin_tildes(p["nameunit"])))
    if any(nota(p["nameunit"]) < 3 for p in lista):
        lista = [p for p in lista if nota(p["nameunit"]) < 3]
    return lista[:15]


def _dentro_anillos(lat, lon, anillos):
    c = False
    for R in anillos:
        n = len(R)
        for i in range(n):
            x1, y1 = R[i][0], R[i][1]
            x2, y2 = R[(i + 1) % n][0], R[(i + 1) % n][1]
            if (y1 > lat) != (y2 > lat) and lon < (x2 - x1) * (lat - y1) / (y2 - y1) + x1:
                c = not c
    return c


def asistente():
    carpeta_practica = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    print("=" * 66)
    print(" GENERADOR DE DATOS FICTICIOS PARA LA PRÁCTICA DEL MAPA DE CALOR")
    print("=" * 66)
    print("Descarga el límite oficial (IGN) y las direcciones (CartoCiudad) del")
    print("municipio y crea 3.000 hechos FICTICIOS en direcciones reales.\n")
    while True:
        q = _preguntar("Municipio (p. ej. Paterna)")
        if len(q) < 3:
            print("  Escribe al menos 3 letras.")
            continue
        try:
            lista = _buscar_municipio(q)
        except Exception as e:
            sys.exit(f"\nNo se ha podido conectar con el IGN ({e}). Comprueba la conexión a internet.")
        if not lista:
            print("  No se ha encontrado ningún municipio con ese nombre. Prueba otra vez.")
            continue
        for i, p in enumerate(lista, 1):
            cod = p["nationalcode"]
            print(f"  {i:2d}. {p['nameunit']}  ({PROVINCIAS_INE.get(cod[4:6], '')}, INE {cod[-5:]})")
        el = _preguntar("Número del municipio (o Intro para buscar otro)", 1 if len(lista) == 1 else None)
        if el.isdigit() and 1 <= int(el) <= len(lista):
            mun = lista[int(el) - 1]
            break
    nombre, codigo = mun["nameunit"], mun["nationalcode"]
    corto = nombre.split("/")[-1].strip()
    salida = os.path.join(carpeta_practica, "Ejemplos", corto)
    if os.path.exists(salida):
        if _preguntar(f"Ya existe Ejemplos/{corto}. ¿Sustituir sus datos? (s/n)", "n").lower() != "s":
            sys.exit("Cancelado. No se ha cambiado nada.")
    n = _preguntar("¿Cuántos hechos generar?", 3000)
    semilla = _preguntar("Semilla (cámbiala para obtener otros datos distintos)", 2025)
    import tempfile                        # archivos auxiliares en una carpeta temporal que se borra al terminar
    prof = tempfile.mkdtemp(prefix="generar_datos_")
    import atexit, shutil
    atexit.register(shutil.rmtree, prof, True)

    print(f"\nDescargando el límite oficial de {nombre} (IGN)...")
    gj = _get_json(f"{API_IGN}?f=json&nationalcode={codigo}")
    ruta_lim = os.path.join(prof, "limite_municipal.geojson")
    with open(ruta_lim, "w", encoding="utf-8") as f:
        json.dump(gj, f, ensure_ascii=False)
    anillos = []
    for ft in gj["features"]:
        g = ft["geometry"]
        polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
        for poly in polys:
            anillos.extend(poly)

    print(f"Descargando las direcciones oficiales (CartoCiudad)...")
    portales = []
    for nom in dict.fromkeys([nombre] + [x.strip() for x in nombre.split("/")]):
        url = f"{API_CARTO}?f=json&limit=1000&component_AdminUnitName_4={urllib.parse.quote(nom)}"
        paginas = 0
        while url and paginas < 400:
            paginas += 1
            j = _get_json(url)
            F = j.get("features", [])
            for ft in F:
                p, g = ft.get("properties") or {}, ft.get("geometry")
                m = re.match(r"\d+", str(p.get("locator_designator_addressNumber") or ""))
                if not g or not m or not p.get("component_ThoroughfareName"):
                    continue
                lon, lat = g["coordinates"][:2]
                if _dentro_anillos(lat, lon, anillos):
                    ext = str(p.get("locator_designator_addressNumberExtension") or "").strip().upper()
                    portales.append((p["component_ThoroughfareName"].strip(), m.group(0) + ext, lat, lon))
            print(f"  {len(portales)} portales...", end="\r")
            nx = [l["href"] for l in j.get("links", []) if l.get("rel") == "next"]
            url = nx[0] if nx and F else None
        if portales:
            break
    print(f"  {len(portales)} portales dentro del término.      ")
    if not portales:
        sys.exit("No se han encontrado direcciones de este municipio en CartoCiudad.")
    portales.sort(key=lambda x: (x[0], int(re.match(r"\d+", x[1]).group(0))))
    if len(portales) > MAX_PORTALES:
        k = len(portales) / MAX_PORTALES
        portales = [portales[int(i * k)] for i in range(MAX_PORTALES)]
    ruta_port = os.path.join(prof, "portales.csv")
    with open(ruta_port, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["via", "numero", "latitud", "longitud"])
        for v, num, la, lo in portales:
            w.writerow([v, num, f"{la:.6f}", f"{lo:.6f}"])
    print("Generando los hechos ficticios...")
    sys.argv = [sys.argv[0], n, semilla, ruta_lim, ruta_port, salida]


MODO_ASISTENTE = len(sys.argv) == 1
if MODO_ASISTENTE:
    try:
        asistente()
    except SystemExit as e:
        if e.code not in (None, 0):
            print(e.code)
        input("\nPulsa Intro para cerrar.")
        raise SystemExit(0)
    except Exception as e:
        print(f"\nERROR: {e}")
        input("\nPulsa Intro para cerrar.")
        raise SystemExit(1)


N_REGISTROS = int(sys.argv[1]) if len(sys.argv) > 1 else 3000
SEMILLA = int(sys.argv[2]) if len(sys.argv) > 2 else 2025
ANIO = 2025
PROFESOR = os.path.dirname(os.path.abspath(__file__))      # carpeta del generador
CARPETA = os.path.dirname(PROFESOR)                         # carpeta de la practica
RUTA_LIMITE = sys.argv[3] if len(sys.argv) > 3 else os.path.join(CARPETA, "limite_municipal.geojson")
RUTA_PORTALES = sys.argv[4] if len(sys.argv) > 4 else os.path.join(PROFESOR, "portales.csv")
if len(sys.argv) > 5:                       # carpeta de salida para otro municipio
    CARPETA = sys.argv[5]
os.makedirs(CARPETA, exist_ok=True)


# --------------------------------------------------------------------------
# Limite municipal oficial (GeoJSON en WGS84 / EPSG:4326)
# --------------------------------------------------------------------------
def leer_limite(ruta):
    with open(ruta, encoding="utf-8-sig") as f:
        obj = json.load(f)
    geoms, nombres = [], []

    def rec(o):
        t = o.get("type")
        if t == "FeatureCollection":
            for ft in o["features"]:
                rec(ft)
        elif t == "Feature" and o.get("geometry"):
            p = o.get("properties") or {}
            nombres.append(p.get("NAMEUNIT") or p.get("nameunit") or p.get("NOMBRE") or p.get("nombre")
                           or p.get("name") or p.get("NAME") or "")
            rec(o["geometry"])
        elif t == "GeometryCollection":
            for g in o["geometries"]:
                rec(g)
        elif t == "Polygon":
            geoms.append([o["coordinates"]])
        elif t == "MultiPolygon":
            geoms.append(o["coordinates"])

    rec(obj)
    if not geoms:
        sys.exit("ERROR: el archivo de limite no contiene poligonos.")
    if len(set(nombres)) > 1:
        sys.exit(f"ERROR: el archivo contiene {len(nombres)} recintos distintos. Exporta solo el municipio.")
    anillos = []
    for g in geoms:
        for poly in g:
            for ring in poly:
                if abs(ring[0][0]) > 180 or abs(ring[0][1]) > 90:
                    sys.exit("ERROR: coordenadas en metros (UTM). Reproyecta a WGS84 / EPSG:4326.")
                anillos.append([(c[1], c[0]) for c in ring])      # (lat, lon)
    return anillos, next((n for n in nombres if n), "municipio")


ANILLOS, NOMBRE_MUN = leer_limite(RUTA_LIMITE)


def dentro(lat, lon):
    """Punto en poligono, regla par-impar sobre todos los anillos (admite huecos y enclaves)."""
    c = False
    for R in ANILLOS:
        n = len(R)
        for i in range(n):
            y1, x1 = R[i]
            y2, x2 = R[(i + 1) % n]
            if (y1 > lat) != (y2 > lat) and lon < (x2 - x1) * (lat - y1) / (y2 - y1) + x1:
                c = not c
    return c


TODOS = [p for R in ANILLOS for p in R]
LAT_MIN = min(p[0] for p in TODOS); LAT_MAX = max(p[0] for p in TODOS)
LON_MIN = min(p[1] for p in TODOS); LON_MAX = max(p[1] for p in TODOS)
M_POR_GRADO_LAT = 111_130.0
M_POR_GRADO_LON = 111_320.0 * math.cos(math.radians((LAT_MIN + LAT_MAX) / 2))


def area_km2():
    a = 0.0
    for R in ANILLOS:                      # par-impar: los huecos restan si su orientacion es opuesta
        s = 0.0
        for i in range(len(R)):
            (y1, x1), (y2, x2) = R[i - 1], R[i]
            s += (x1 * M_POR_GRADO_LON) * (y2 * M_POR_GRADO_LAT) - (x2 * M_POR_GRADO_LON) * (y1 * M_POR_GRADO_LAT)
        a += s / 2
    return abs(a) / 1e6


def slug(texto):
    t = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode().lower()
    return "".join(ch if ch.isalnum() else "_" for ch in t).strip("_") or "municipio"


# --------------------------------------------------------------------------
# Red de calles (opcional): los hechos se ajustan a la calle mas cercana
# --------------------------------------------------------------------------
CALLES = []
_ruta_calles = os.path.join(PROFESOR, "puntos_calle.csv")
if os.path.exists(_ruta_calles):
    with open(_ruta_calles, encoding="utf-8-sig") as fh:
        for r in csv.DictReader(fh):
            la, lo = float(r["latitud"]), float(r["longitud"])
            if dentro(la, lo):
                CALLES.append((la, lo))
CALLES_M = [(la * M_POR_GRADO_LAT, lo * M_POR_GRADO_LON) for la, lo in CALLES]


def _cercanos(lat, lon, k=2):
    y, x = lat * M_POR_GRADO_LAT, lon * M_POR_GRADO_LON
    d = sorted(((yy - y) ** 2 + (xx - x) ** 2, i) for i, (yy, xx) in enumerate(CALLES_M))
    return [(math.sqrt(dd), i) for dd, i in d[:k]]


def a_calle(lat, lon, max_dist=120):
    """Lleva el punto a la acera de la calle más cercana (entre dos puntos de la calle, con
    un desplazamiento lateral de 4-8 m). Devuelve None si no hay calle a menos de max_dist."""
    if not CALLES:
        return lat, lon
    (d1, i1), (d2, i2) = _cercanos(lat, lon, 2)
    if d1 > max_dist:
        return None
    y1, x1 = CALLES_M[i1]
    y2, x2 = CALLES_M[i2]
    tramo = math.hypot(y2 - y1, x2 - x1)
    if 0 < tramo <= 45:                      # los dos puntos son de la misma calle
        u = random.random()
        y, x = y1 + u * (y2 - y1), x1 + u * (x2 - x1)
        lado = random.choice((-1, 1)) * random.uniform(4, 8)
        y += lado * (x2 - x1) / tramo
        x -= lado * (y2 - y1) / tramo
    else:
        ang = random.uniform(0, 2 * math.pi)
        y, x = y1 + 6 * math.sin(ang), x1 + 6 * math.cos(ang)
    return y / M_POR_GRADO_LAT, x / M_POR_GRADO_LON


# --------------------------------------------------------------------------
# Portales oficiales (opcional, CartoCiudad): si existe solo_profesor/portales.csv
# (via,numero,latitud,longitud), cada hecho se asigna a un portal real: tiene una
# dirección postal y las coordenadas oficiales de ese portal.
# --------------------------------------------------------------------------
PORTALES = []
_ruta_port = RUTA_PORTALES
if os.path.exists(_ruta_port):
    with open(_ruta_port, encoding="utf-8-sig") as fh:
        for r in csv.DictReader(fh):
            la, lo = float(r["latitud"]), float(r["longitud"])
            if dentro(la, lo) and r["numero"].strip():
                PORTALES.append((la, lo, r["via"].strip(), r["numero"].strip()))
PORT_M = [(p[0] * M_POR_GRADO_LAT, p[1] * M_POR_GRADO_LON) for p in PORTALES]


def a_portal(lat, lon, max_dist=150):
    """Portal oficial más cercano (o None si no hay ninguno a menos de max_dist metros)."""
    y, x = lat * M_POR_GRADO_LAT, lon * M_POR_GRADO_LON
    d, i = min(((yy - y) ** 2 + (xx - x) ** 2, i) for i, (yy, xx) in enumerate(PORT_M))
    return PORTALES[i] if math.sqrt(d) <= max_dist else None


BASE_M = PORT_M or CALLES_M          # puntos que definen la trama urbana


def densidad_calles(lat, lon, radio=150):
    y, x = lat * M_POR_GRADO_LAT, lon * M_POR_GRADO_LON
    return sum(1 for yy, xx in BASE_M if (yy - y) ** 2 + (xx - x) ** 2 <= radio * radio)


# --------------------------------------------------------------------------
# Zonas calientes FICTICIAS: forma (dispersion en metros, alargamiento, giro).
# Su centro se coloca automaticamente dentro del termino.
# --------------------------------------------------------------------------
ZONAS = {
    "A": dict(nombre="Eje comercial", sx=170, sy=45, giro=12),
    "B": dict(nombre="Entorno parada de transporte 1", sx=55, sy=55, giro=0),
    "G": dict(nombre="Entorno parada de transporte 2", sx=55, sy=55, giro=0),
    "C": dict(nombre="Zona de ocio nocturno", sx=70, sy=50, giro=-20),
    "D": dict(nombre="Aparcamientos y accesos", sx=130, sy=50, giro=10),
    "E": dict(nombre="Parque y zona deportiva", sx=90, sy=70, giro=0),
    "F": dict(nombre="Zona residencial", sx=140, sy=110, giro=30),
}


UMBRAL_URBANO = 0
if BASE_M:
    _dens = sorted(densidad_calles(y / M_POR_GRADO_LAT, x / M_POR_GRADO_LON) for y, x in BASE_M)
    UMBRAL_URBANO = _dens[int(0.6 * (len(_dens) - 1))]     # 40 % de puntos de calle con más densidad


NUCLEO = None                 # punto más denso del casco urbano (las zonas calientes se sitúan cerca)
RADIO_NUCLEO = 1500           # metros
if BASE_M:
    _dmax = max(BASE_M, key=lambda p: densidad_calles(p[0] / M_POR_GRADO_LAT, p[1] / M_POR_GRADO_LON))
    NUCLEO = _dmax


def cerca_nucleo(lat, lon):
    if NUCLEO is None:
        return True
    return math.hypot(lat * M_POR_GRADO_LAT - NUCLEO[0], lon * M_POR_GRADO_LON - NUCLEO[1]) <= RADIO_NUCLEO


def colocar_zonas():
    """Elige centros interiores, separados entre si y alejados del borde. Reproducible con la semilla."""
    rnd = random.Random(SEMILLA + 7)
    lado = math.sqrt(area_km2()) * 1000           # metros
    if BASE_M:                                    # mejor: extensión del casco urbano denso
        densos = [(y, x) for y, x in BASE_M if densidad_calles(y / M_POR_GRADO_LAT, x / M_POR_GRADO_LON) >= UMBRAL_URBANO
                  and cerca_nucleo(y / M_POR_GRADO_LAT, x / M_POR_GRADO_LON)]
        if len(densos) > 10:
            ys, xs = [p[0] for p in densos], [p[1] for p in densos]
            lado = min(lado, math.sqrt(max(1.0, (max(ys) - min(ys)) * (max(xs) - min(xs)))))
    separacion = max(200.0, 0.28 * lado)
    for intento in range(60):
        centros = {}
        for k, z in ZONAS.items():
            margen = 1.3 * max(z["sx"], z["sy"])
            for _ in range(4000):
                lat = rnd.uniform(LAT_MIN, LAT_MAX)
                lon = rnd.uniform(LON_MIN, LON_MAX)
                if not dentro(lat, lon):
                    continue
                anillo = [(lat + margen * math.sin(a) / M_POR_GRADO_LAT, lon + margen * math.cos(a) / M_POR_GRADO_LON)
                          for a in [i * math.pi / 4 for i in range(8)]]
                if not all(dentro(*p) for p in anillo):
                    continue
                if BASE_M and (densidad_calles(lat, lon) < UMBRAL_URBANO or not cerca_nucleo(lat, lon)):
                    continue                                       # en el casco urbano denso
                if all(math.hypot((lat - a) * M_POR_GRADO_LAT, (lon - b) * M_POR_GRADO_LON) >= separacion
                       for a, b in centros.values()):
                    centros[k] = (lat, lon)
                    break
            else:
                break
        if len(centros) == len(ZONAS):
            for k, (a, b) in centros.items():
                ZONAS[k]["lat"], ZONAS[k]["lon"] = a, b
            return
        separacion *= 0.9                          # municipio pequeno o irregular: se relaja
    sys.exit("ERROR: no caben las zonas en el termino. Revisa el archivo de limite.")


# --------------------------------------------------------------------------
# Tipologias: peso, reparto espacial y patron temporal
#   zonas: {zona: probabilidad}; el resto -> fondo (todo el municipio)
#   horas: lista de (hora_central, desviacion, peso)
#   dias: peso lunes..domingo   meses: peso ene..dic
# --------------------------------------------------------------------------
TIPOS = {
    "Hurto": dict(peso=33, zonas={"A": .40, "B": .15, "G": .10},
                  horas=[(12, 2, 1), (19, 2, 1.2)], dias=[1, 1, 1, 1, 1.2, 1.5, .7],
                  meses=[1, .9, 1, 1, 1, 1, 1.1, .9, 1, 1, 1.1, 1.4]),
    "Robo con violencia o intimidacion": dict(peso=7, zonas={"B": .20, "G": .15, "C": .25},
                  horas=[(22, 2.5, 1), (2, 1.5, .6)], dias=[.8, .8, .9, 1, 1.3, 1.5, 1.2],
                  meses=[1] * 12),
    "Robo con fuerza en domicilio": dict(peso=8, zonas={"F": .55},
                  horas=[(11, 2, 1), (18, 1.5, .7)], dias=[1.1, 1.1, 1, 1, 1, .8, .7],
                  meses=[.8, .8, .9, .9, .9, 1, 1.6, 2.0, 1, .9, .9, 1.3]),
    "Robo con fuerza en establecimiento": dict(peso=5, zonas={"A": .60},
                  horas=[(4, 1.5, 1)], dias=[1.1, 1, 1, 1, 1, 1, 1.2],
                  meses=[1] * 12),
    "Robo en interior de vehiculo": dict(peso=10, zonas={"D": .45, "E": .15},
                  horas=[(2, 2.5, 1)], dias=[1, 1, 1, 1, 1.1, 1.3, 1.2],
                  meses=[1, 1, 1, 1, 1, 1.1, 1.3, 1.3, 1, 1, 1, 1]),
    "Sustraccion de vehiculo": dict(peso=4, zonas={"D": .55},
                  horas=[(3, 2, 1)], dias=[1] * 7, meses=[1] * 12),
    "Danos": dict(peso=14, zonas={"C": .25, "E": .20},
                  horas=[(1, 2.5, 1), (22, 2, .5)], dias=[.7, .7, .8, .9, 1.3, 1.7, 1.3],
                  meses=[1, 1, 1, 1, 1, 1.2, 1.2, 1, 1, 1, 1, 1]),
    "Lesiones": dict(peso=6, zonas={"C": .55},
                  horas=[(3, 1.5, 1), (23, 1.5, .5)], dias=[.4, .4, .5, .7, 1.4, 2.5, 1.8],
                  meses=[.9, .9, 1, 1, 1, 1.3, 1.4, 1.3, 1, 1, .9, 1.1]),
    "Trafico de drogas (menudeo)": dict(peso=4, zonas={"E": .60},
                  horas=[(20, 2.5, 1)], dias=[1] * 7, meses=[1] * 12),
    "Amenazas": dict(peso=4, zonas={}, horas=[(14, 5, 1)], dias=[1] * 7, meses=[1] * 12),
    "Desordenes publicos": dict(peso=5, zonas={"C": .50, "A": .10},
                  horas=[(1, 2, 1)], dias=[.4, .4, .5, .7, 1.5, 2.5, 1.5],
                  meses=[1, 1, 1, 1, 1, 1.3, 1.4, 1.2, 1, 1, 1, 1.2]),
}
# Denominación legal (Código Penal, LO 10/1995) y artículo de referencia
NOMBRE_TIPO = {
    "Hurto": ("Hurto", "234"),
    "Robo con violencia o intimidacion": ("Robo con violencia o intimidación en las personas", "242"),
    "Robo con fuerza en domicilio": ("Robo con fuerza en las cosas en casa habitada", "241"),
    "Robo con fuerza en establecimiento": ("Robo con fuerza en las cosas en establecimiento abierto al público", "241"),
    "Robo en interior de vehiculo": ("Robo con fuerza en las cosas (interior de vehículo)", "237-238"),
    "Sustraccion de vehiculo": ("Hurto o robo de uso de vehículo a motor", "244"),
    "Danos": ("Daños", "263"),
    "Lesiones": ("Lesiones", "147"),
    "Trafico de drogas (menudeo)": ("Contra la salud pública (tráfico de drogas)", "368"),
    "Amenazas": ("Amenazas", "169"),
    "Desordenes publicos": ("Desórdenes públicos", "557"),
}
DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]


def franja(h):
    if 6 <= h < 14:
        return "mañana"
    if 14 <= h < 22:
        return "tarde"
    if h >= 22 or h < 2:
        return "noche"
    return "madrugada"


def punto_en_zona(z):
    """Punto gaussiano elíptico alrededor del centro de la zona, dentro del término."""
    g = math.radians(z["giro"])
    for _ in range(200):
        dx, dy = random.gauss(0, z["sx"]), random.gauss(0, z["sy"])
        ex = dx * math.cos(g) - dy * math.sin(g)
        ny = dx * math.sin(g) + dy * math.cos(g)
        lat = z["lat"] + ny / M_POR_GRADO_LAT
        lon = z["lon"] + ex / M_POR_GRADO_LON
        if dentro(lat, lon):
            return lat, lon
    return z["lat"], z["lon"]


def punto_fondo():
    """Punto aleatorio en todo el término (portal o calle si están disponibles)."""
    if PORTALES:
        return random.choice(PORTALES)[:2]
    if CALLES:
        return random.choice(CALLES)
    while True:
        lat = random.uniform(LAT_MIN, LAT_MAX)
        lon = random.uniform(LON_MIN, LON_MAX)
        if dentro(lat, lon):
            return lat, lon


DIAS_ANIO = [date(ANIO, 1, 1) + timedelta(d) for d in range(365)]


def fecha_aleatoria(meses, dias):
    pesos = [meses[f.month - 1] * dias[f.weekday()] for f in DIAS_ANIO]
    return random.choices(DIAS_ANIO, weights=pesos)[0]


def hora_aleatoria(picos):
    h0, sd, _ = random.choices(picos, weights=[p[2] for p in picos])[0]
    t = (random.gauss(h0, sd) * 60) % (24 * 60)
    m = int(t) // 5 * 5           # horas "redondas" a 5 minutos, como en un atestado
    return m // 60, m % 60


def generar(prefijo):
    random.seed(SEMILLA)
    tipos = list(TIPOS)
    registros, vistos = [], set()
    while len(registros) < N_REGISTROS:
        t = random.choices(tipos, weights=[TIPOS[k]["peso"] for k in tipos])[0]
        cfg = TIPOS[t]
        z = None
        r, acum = random.random(), 0
        for zona, p in cfg["zonas"].items():
            acum += p
            if r < acum:
                z = zona
                break
        lat, lon = punto_en_zona(ZONAS[z]) if z else punto_fondo()
        via = num = ""
        if PORTALES:
            p = a_portal(lat, lon)
            if p is None:
                continue
            lat, lon, via, num = p
        else:
            p = a_calle(lat, lon)
            if p is None:
                continue
            lat, lon = p
        lat, lon = round(lat, 6), round(lon, 6)
        if not dentro(lat, lon):      # el redondeo puede sacar un punto del borde
            continue
        f = fecha_aleatoria(cfg["meses"], cfg["dias"])
        h, m = hora_aleatoria(cfg["horas"])
        clave = (f, h, m, round(lat, 5), round(lon, 5))
        if clave in vistos:
            continue
        vistos.add(clave)
        registros.append(dict(fecha=f, h=h, m=m, tipo=NOMBRE_TIPO[t][0], art=NOMBRE_TIPO[t][1], lat=lat, lon=lon, via=via, num=num, zona=z or "-"))
    registros.sort(key=lambda x: (x["fecha"], x["h"], x["m"]))
    return [{
        "id": f"{prefijo}-{ANIO}-{i:05d}",
        "fecha": x["fecha"].isoformat(),
        "hora": f"{x['h']:02d}:{x['m']:02d}",
        "dia_semana": DIAS[x["fecha"].weekday()],
        "franja_horaria": franja(x["h"]),
        "tipo_hecho": x["tipo"],
        "articulo_cp": x["art"],
        "latitud": f"{x['lat']:.6f}",
        "longitud": f"{x['lon']:.6f}",
        "_zona": x["zona"],
        "_via": x["via"],
        "_num": x["num"],
    } for i, x in enumerate(registros, 1)]


def ensuciar(filas):
    """Copia con ~1,5 % de errores típicos para la fase de depuración."""
    sucias = [dict(f) for f in filas]
    rnd = random.Random(SEMILLA + 1)
    for f in rnd.sample(filas, 15):                       # 15 duplicados exactos
        sucias.insert(rnd.randrange(len(sucias)), dict(f))
    for f in rnd.sample(sucias, 6):                       # 6 con latitud y longitud intercambiadas
        f["latitud"], f["longitud"] = f["longitud"], f["latitud"]
    fuera = []                                            # 10 fuera del término (hasta ~1,5 km del límite)
    while len(fuera) < 10:
        a = rnd.uniform(LAT_MIN - 0.013, LAT_MAX + 0.013)
        b = rnd.uniform(LON_MIN - 0.017, LON_MAX + 0.017)
        if not dentro(a, b):
            fuera.append((a, b))
    for f, (a, b) in zip(rnd.sample(sucias, 10), fuera):
        f["latitud"], f["longitud"] = f"{a:.6f}", f"{b:.6f}"
    for f in rnd.sample(sucias, 8):                       # 8 sin coordenadas
        f["latitud"] = f["longitud"] = ""
    for f in rnd.sample(sucias, 6):                       # 6 sin tipo
        f["tipo_hecho"] = ""
    for f in rnd.sample(sucias, 5):                       # 5 con hora vacía
        f["hora"] = ""
    for f in rnd.sample(sucias, 5):                       # 5 con fecha dd/mm/aaaa
        a, m, d = f["fecha"].split("-")
        f["fecha"] = f"{d}/{m}/{a}"
    for f in rnd.sample(sucias, 4):                       # 4 con coma decimal
        if f["latitud"]:
            f["latitud"] = f["latitud"].replace(".", ",")
    return sucias


# --------------------------------------------------------------------------
# Versión con DIRECCIÓN (como en un atestado) en lugar de coordenadas
# --------------------------------------------------------------------------
TIPOS_VIA = {
    "CALLE": ["C/", "C/", "Calle", "c/", "CL", "calle"],
    "AVENIDA": ["Avda.", "Av.", "Avenida", "AVDA", "avda."],
    "PLAZA": ["Pza.", "Plaza", "Pl.", "plaza"],
    "PASEO": ["Paseo", "Pso."],
    "CAMINO": ["Camino", "Cno."],
    "CARRETERA": ["Ctra.", "Carretera"],
    "TRAVESIA": ["Trav.", "Travesía"],
    "CUESTA": ["Cuesta"],
    "PARTIDA": ["Partida"],
    "PASAJE, PASADIZO": ["Pasaje"],
}
TILDES = {"MARAÑON": "Marañón", "TOMAS": "Tomás", "IBAÑEZ": "Ibáñez", "HERNANDEZ": "Hernández",
          "CONSTITUCION": "Constitución", "ESTACION": "Estación", "ANDALUCIA": "Andalucía",
          "CASTELLON": "Castellón", "LLIRIA": "Llíria", "MARQUES": "Marqués", "PRINCIPE": "Príncipe",
          "SANTISIMO": "Santísimo", "CATOLICA": "Católica", "GARCIA": "García", "CORTES": "Cortés",
          "AZORIN": "Azorín", "MEDIODIA": "Mediodía", "MUSICO": "Músico", "JOSE": "José", "MIRO": "Miró",
          "MATIAS": "Matías", "PIROTECNICO": "Pirotécnico", "ANGELES": "Ángeles", "VINALOPO": "Vinalopó",
          "SEQUIA": "Séquia", "ALAQUAS": "Alaquàs", "MARIA": "María", "PIO": "Pío"}
PARTICULAS = {"VIRGEN DESAMPARADOS": "Virgen de los Desamparados",
              "NUESTRA SEÑORA ANGELES": "Nuestra Señora de los Ángeles",
              "PRINCIPE ASTURIAS": "Príncipe de Asturias", "MARQUES VILLORES": "Marqués de Villores",
              "MAESTRO PALAU": "Maestro Palau", "PADRE LLANSOL": "Padre Llansol"}
MINUS = {"DE", "DEL", "LA", "LAS", "LOS", "EL", "Y", "I"}
NO_EXISTEN = ["Calle Colón", "C/ Xàtiva", "Gran Vía Marqués del Turia", "Estación de metro",
              "Parque de la Canaleta", "C/ Ruzafa", "Avda. del Puerto", "Centro comercial",
              "Mercado municipal", "Calle Sin Nombre", "Polígono industrial", "Estación de tren",
              "Parque municipal", "Zona de ocio", "Descampado junto a la carretera"]


def partir_via(via):
    for t in sorted(TIPOS_VIA, key=len, reverse=True):
        if via.startswith(t + " "):
            return t, via[len(t) + 1:]
    return "", via


ARTICULO_FINAL = re.compile(r"^(.*?),\s*([^,]+)$")
PARENTESIS_FINAL = re.compile(r"^(.*?)\s*\(([^)]+)\)$")
APOSTROFO_FINAL = re.compile(r"^(.*?)\s+(L'|D')$")


def ordenar_nombre(cuerpo):
    """'SOL, DEL' -> 'DEL SOL'; 'NEGRE (EL)' -> 'EL NEGRE'; 'ARBRE L'' -> 'L'ARBRE' (como lo escribiría una persona)."""
    for patron in (ARTICULO_FINAL, PARENTESIS_FINAL):
        m = patron.match(cuerpo)
        if m and m.group(2).strip():
            return f"{m.group(2).strip()} {m.group(1).strip()}"
    m = APOSTROFO_FINAL.match(cuerpo)
    if m:
        return f"{m.group(2)}{m.group(1).strip()}"
    return cuerpo


def escribir_via(via, rnd):
    tipo, cuerpo = partir_via(via)
    if rnd.random() < 0.85:
        cuerpo = ordenar_nombre(cuerpo)
    if cuerpo in PARTICULAS and rnd.random() < 0.6:
        texto = PARTICULAS[cuerpo]
    else:
        palabras = []
        for w in cuerpo.split():
            if w in MINUS:
                palabras.append(w.lower())
            elif w in TILDES and rnd.random() < 0.7:
                palabras.append(TILDES[w])
            else:
                palabras.append(w.capitalize())
        texto = " ".join(palabras)
    r = rnd.random()
    if r < 0.25:
        texto = texto.upper()
    elif r < 0.33:
        texto = texto.lower()
    pref = rnd.choice(TIPOS_VIA[tipo]) if tipo else ""
    return f"{pref} {texto}".strip()


def escribir_numero(num, rnd):
    n = "".join(ch for ch in num if ch.isdigit())
    ext = "".join(ch for ch in num if ch.isalpha())
    if ext:
        n = rnd.choice([f"{n}{ext}", f"{n} {ext}", f"{n}-{ext}"])
    return rnd.choice([n, n, n, n, f"nº {n}"])


def errata(texto, rnd):
    """Introduce un error de tecleo en la palabra más larga (letra omitida, cambiada o intercambiada)."""
    pal = texto.split()
    if any(ch.isdigit() for ch in texto) or pal[0].lower().strip(".") in ("diseminados", "urbanizacion", "partida", "lugar", "masias"):
        return None
    if len("".join(pal[1:])) < 10:          # nombres cortos: una errata los haría ambiguos
        return None
    i = max(range(len(pal)), key=lambda k: len(pal[k]))
    w = pal[i]
    if len(w) < 6:
        return None
    k = rnd.randrange(1, len(w) - 1)
    op = rnd.choice(["omitir", "cambiar", "intercambiar"])
    if op == "omitir":
        w2 = w[:k] + w[k + 1:]
    elif op == "cambiar":
        c = rnd.choice("aeiourstn")
        w2 = w[:k] + (c.upper() if w[k].isupper() else c) + w[k + 1:]
    else:
        w2 = w[:k - 1] + w[k] + w[k - 1] + w[k + 1:]
    if w.isupper():
        w2 = w2.upper()
    elif w[0].isupper():
        w2 = w2.capitalize()
    else:
        w2 = w2.lower()
    if w2 == w:
        return None
    pal[i] = w2
    return " ".join(pal)


def _nucleo(texto):
    t = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode().lower()
    t = re.sub(r"[^a-z0-9]+", " ", t).split()
    while len(t) > 1 and t[0] in ("c", "calle", "avda", "av", "avenida", "pza", "plaza", "pl", "carrer"):
        t.pop(0)
    return " ".join(w for w in t if w not in ("de", "del", "la", "las", "los", "el", "l", "d", "les", "dels"))


def direcciones(filas):
    """Copia de los hechos con vía y número en lugar de coordenadas, escritos con variantes
    reales (C/, Avda., tildes, mayúsculas...) y con errores típicos para la geocodificación."""
    rnd = random.Random(SEMILLA + 2)
    salida, sol = [], []
    nucleos = {_nucleo(v) for _, _, v, _ in PORTALES}
    no_existen = [n for n in NO_EXISTEN if _nucleo(n) not in nucleos and not any(_nucleo(n) in k.split() for k in nucleos)]
    max_num = {}
    for la, lo, via, num in PORTALES:
        d = int("".join(ch for ch in num if ch.isdigit()) or 0)
        max_num[via] = max(max_num.get(via, 0), d)
    ids = list(range(len(filas)))
    rnd.shuffle(ids)
    errores = {}
    cupos = [("numero_inexistente", 120), ("errata_en_la_calle", 90), ("sin_numero", 60), ("lugar_no_localizable", 50)]
    pos = 0
    for nombre, n in cupos:
        for k in ids[pos:pos + n]:
            errores[k] = nombre
        pos += n
    for k, f in enumerate(filas):
        g = {c: f[c] for c in ("id", "fecha", "hora", "dia_semana", "franja_horaria", "tipo_hecho", "articulo_cp")}
        via_txt = escribir_via(f["_via"], rnd)
        num_txt = escribir_numero(f["_num"], rnd)
        e = errores.get(k, "")
        if e == "numero_inexistente":
            num_txt = str(max_num.get(f["_via"], 50) + rnd.randint(150, 400))
        elif e == "errata_en_la_calle":
            t = errata(via_txt, rnd)
            if t:
                via_txt = t
            else:
                e = ""
        elif e == "sin_numero":
            num_txt = rnd.choice(["s/n", "", "S/N"])
        elif e == "lugar_no_localizable":
            via_txt = rnd.choice(no_existen)
            num_txt = rnd.choice(["", "", str(rnd.randint(1, 60))])
        g["via"], g["numero"] = via_txt, num_txt
        salida.append(g)
        if e:
            sol.append({"id": f["id"], "error_introducido": e, "via_escrita": via_txt, "numero_escrito": num_txt,
                        "via_oficial": f["_via"], "numero_oficial": f["_num"],
                        "latitud_correcta": f["latitud"], "longitud_correcta": f["longitud"]})
    return salida, sol


def guardar(ruta, filas, campos):
    with open(ruta, "w", newline="", encoding="utf-8-sig") as fh:   # utf-8-sig: Excel lo abre bien
        w = csv.DictWriter(fh, fieldnames=campos, extrasaction="ignore", quoting=csv.QUOTE_MINIMAL)
        w.writeheader()
        w.writerows(filas)


if __name__ == "__main__":
    colocar_zonas()
    s = slug(NOMBRE_MUN.split("/")[-1])
    filas = generar(s[:3].upper())
    campos = ["id", "fecha", "hora", "dia_semana", "franja_horaria", "tipo_hecho", "articulo_cp", "latitud", "longitud"]
    if not PORTALES:                       # sin direcciones reales solo se puede dar el CSV con coordenadas
        guardar(os.path.join(CARPETA, f"incidentes_{s}_{ANIO}.csv"), filas, campos)
    if PORTALES:                           # se entrega UN solo archivo: el de direcciones
        dirs, sol_dirs = direcciones(filas)
        guardar(os.path.join(CARPETA, f"incidentes_{s}_{ANIO}_direcciones.csv"), dirs,
                ["id", "fecha", "hora", "dia_semana", "franja_horaria", "tipo_hecho", "articulo_cp", "via", "numero"])

    print(f"{NOMBRE_MUN}: superficie calculada {area_km2():.2f} km2. "
          f"Portales: {len(PORTALES)}. Generados {len(filas)} registros ficticios (semilla {SEMILLA}) -> "
          f"incidentes_{s}_{ANIO}{'_direcciones' if PORTALES else ''}.csv")
    if MODO_ASISTENTE:
        print(f"\nListo. Los archivos están en: {CARPETA}")
        print("Para usarlos: abre mapa_calor.html, busca el municipio y arrastra el CSV.")
        input("\nPulsa Intro para cerrar.")
