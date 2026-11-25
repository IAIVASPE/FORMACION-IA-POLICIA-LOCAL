# Práctica: crea tu propio croquis de accidente con IA

**Objetivo:** construir, con ayuda de un asistente de IA (Claude, ChatGPT, Copilot…), una pequeña aplicación web para dibujar el croquis de un accidente sobre un mapa real. Después la iréis mejorando poco a poco.

**Cómo trabajar**
1. Copia el **prompt 1** en el asistente de IA.
2. Guarda la respuesta en un archivo llamado `croquis.html` (con el Bloc de notas: *Guardar como → Tipo: Todos los archivos*).
3. Ábrelo con doble clic en Chrome o Edge y pruébalo.
4. Si algo falla, pulsa **F12 → Consola**, copia el error en rojo y pégaselo a la IA: *«Me da este error: …, corrígelo»*.
5. Cada vez que funcione, **guarda una copia** (`croquis_v1.html`, `croquis_v2.html`…) antes de pedir el siguiente cambio.

---

## Prompt 1 · La aplicación básica

```
Actúa como programador web. Crea UN ÚNICO archivo HTML (con el CSS y el JavaScript dentro)
para dibujar el croquis de un accidente de tráfico sobre un mapa real. Requisitos:

1. Usa la librería Leaflet 1.9.4 desde unpkg.com.
2. Mapa de fondo: ortofoto PNOA del Instituto Geográfico Nacional con esta URL de teselas:
   https://www.ign.es/wmts/pnoa-ma?request=GetTile&service=WMTS&version=1.0.0&layer=OI.OrthoimageCoverage&style=default&tilematrixset=GoogleMapsCompatible&tilematrix={z}&tilerow={y}&tilecol={x}&format=image/jpeg
   (maxNativeZoom 19, maxZoom 21). Centra el mapa en mi localidad con zoom 19.
3. Una barra de botones para colocar, con un clic en el mapa: coche, moto, camión,
   persona y punto de choque. Dibuja cada elemento visto desde arriba con un SVG sencillo,
   a su tamaño real en metros (coche 4,5 x 1,8 m; moto 2,1 x 0,8 m; camión 10 x 2,5 m),
   de forma que al hacer zoom mantengan la escala.
4. Los vehículos llevan una letra (A, B, C…) y un color distinto cada uno.
5. Todos los elementos se pueden arrastrar. Al hacer clic en uno aparece un panel
   para girarlo (control deslizante de 0 a 359 grados) y un botón para borrarlo.
6. Herramienta "Trayectoria": clic en varios puntos, doble clic para terminar.
   Se dibuja una línea discontinua con una punta de flecha al final.
7. Escala gráfica en metros.
8. Todos los textos de la pantalla en español y el código comentado en español,
   para que un alumno pueda entenderlo.
```

---

## Prompts para mejorarla (de uno en uno)

Pega cada prompt junto con tu archivo actual, o en la misma conversación. Pide **un cambio cada vez** y pruébalo antes de pasar al siguiente.

**2 · Medir distancias**
```
Añade una herramienta "Medir": dos clics en el mapa dibujan una línea roja
con la distancia en metros escrita encima (usa map.distance de Leaflet).
```

**3 · Buscar la dirección**
```
Añade arriba un buscador de direcciones. Usa este servicio gratuito:
https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&maxLocations=1&SingleLine=TEXTO
y centra el mapa con zoom 20 en el resultado.
```

**4 · Guardar y abrir**
```
Añade botones "Guardar" (descarga el croquis como archivo .json) y "Abrir"
(carga un .json guardado). Guarda también automáticamente en localStorage
para no perder el trabajo al cerrar.
```

**5 · Más elementos**
```
Añade al catálogo: bicicleta, árbol, farola, señal de STOP, señal de ceda el paso,
paso de peatones (franjas blancas) y persona tendida en el suelo.
Todos a tamaño real y que se puedan girar.
```

**6 · Huella de frenada y velocidad**
```
Añade la herramienta "Huella de frenada": se dibuja como dos líneas negras paralelas.
Al seleccionarla, muestra su longitud y calcula la velocidad al inicio de la frenada
con la fórmula v = √(2·μ·g·d), con un desplegable de superficie (asfalto seco μ=0,7;
asfalto mojado μ=0,5; grava μ=0,45; hielo μ=0,1). Muestra el resultado en km/h.
```

**7 · Posiciones del accidente**
```
Permite marcar cada vehículo como "posición de impacto" (contorno discontinuo y
semitransparente) o "posición final" (relleno normal), para dibujar el mismo
vehículo en los dos momentos del accidente.
```

**8 · Datos del atestado e impresión**
```
Añade un panel "Datos del accidente" con: nº de atestado, fecha, hora, lugar,
tipo de accidente, meteorología y observaciones. Al pulsar "Imprimir" debe salir
el mapa con la flecha de Norte, la escala, una leyenda de los vehículos y los datos.
```

**9 · Tu propia idea**
```
Quiero añadir esta función a mi croquis: [descríbela con detalle].
Hazlo sin romper lo que ya funciona y explícame qué parte del código has cambiado.
```

---

## Supuesto práctico para dibujar

> A las 08:15 h, en el cruce de la **Calle Mayor** con la **Avenida de la Constitución**, el turismo **A** (rojo) circula por la Calle Mayor y no respeta la señal de STOP. Colisiona con su parte frontal contra el lateral izquierdo de la motocicleta **B** (azul), que circula por la Avenida.
> El turismo deja una **huella de frenada de 12 m** antes del punto de choque y queda detenido 3 m más allá. La moto acaba a 9 m del punto de choque y su conductor, **tendido a 13 m**. Hay un **testigo** en la acera.
>
> Dibuja el croquis sobre un cruce real de tu localidad. Incluye la trayectoria de cada vehículo, el punto de choque, las posiciones finales y las medidas principales.

*Usa siempre datos inventados en las prácticas: nunca matrículas ni nombres reales.*
