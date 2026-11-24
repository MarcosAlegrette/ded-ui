# DED — División Especial de Detectives (versión web)

Remake web (React + Vite + TypeScript) del juego de detectives de las XO del Plan Ceibal (Python 2.5 + pygame, 2010).
Usa **el arte, la música, los sonidos, las fuentes y los textos originales** de `../data/juego_ded`, y la lógica del
código original recuperado (`_original_src/`), portado línea por línea a TypeScript.

## Correr

```bash
npm install
npm run prepare-game   # genera public/assets (WebP, OGG + MP3) y src/data (JSON) desde ../data/juego_ded
npm run dev            # http://localhost:5202
npm run build          # build de producción en dist/
```

`prepare-game` necesita `ffmpeg`/`ffprobe` (audio) y `python3` (sólo para *parsear* `datastore.py`; nunca se ejecuta el
código original). Los JSON generados quedan en `src/data`, así que el build funciona aunque falte python.

La API (cuenta de jugador, guardado en la nube y ranking) es opcional: sin ella el juego guarda todo en el navegador
(localStorage). Por defecto se busca en `http://<host>:8000`; se cambia con `VITE_API_URL` en `.env.local`.

## Cómo está armado

| Carpeta | Qué hay |
|---|---|
| `_original_src/` | Código original recuperado de `main.exe` (descompilado, desensamblado y datos `DAT!` descomprimidos). Sólo se lee. |
| `scripts/build-assets.mjs` | Imágenes → WebP (máscaras y GIF sin pérdida), OGG original + MP3 de respaldo, WAV → OGG + MP3, fuentes TTF. |
| `scripts/build-data.ts`, `scripts/extract_datastore.py` | Niveles `.tcs/.tcl`, diccionarios `.tcd`, YAML de la persecución, métricas de las fuentes y los datos de `datastore.py` (departamentos, museos, objetos, ladrones, testigos, pistas, notas…) → JSON. |
| `src/pg` | Una "mini pygame" sobre canvas y Web Audio: `Surface`, `Rect`, fuentes con métricas de SDL_ttf, mixer con canales/colas, eventos. |
| `src/framework` | Port de `framework/` (motor de escenas, capas, ítems, texto con marcado, animaciones, carga). |
| `src/game/data` | Port de `game/data` (modelo, generación de casos, guardado de personajes). |
| `src/game/stages` | Port de cada pantalla/fase: presentación, menú, oficina (fase 0), ciudad y minijuegos (fase 1), casa del ladrón (fase 2), persecución (fase 3), finales. |
| `src/game/racer` | Persecución en auto (reconstruida, ver abajo). |
| `src/ui`, `src/App.tsx` | "Shell" web: escala el canvas 600×450, mouse/toque/teclado, menú, cuenta, ranking y controles táctiles. |

El juego corre a su resolución nativa de **600×450** a 40 cuadros por segundo y se escala a la pantalla. En celular
vertical el juego ocupa el ancho y abajo quedan el menú y, en la persecución, los controles táctiles.
Las fases pesadas (ciudad/minijuegos, casa, persecución) se descargan aparte y las imágenes se cargan por demanda
mientras se muestra la pantalla de carga original.

## Qué es reconstrucción

- **Persecución en auto (fase 3)**: en el original era un módulo nativo en C++ (`game.stages.racer.pyd`) que no se puede
  descompilar. Se reescribió desde cero en canvas usando sólo los datos originales (`car.yaml`, `gui.yaml`, `camera.yaml`,
  `traffic.yaml`, `thief.yaml`, `p3_map_*.yaml`), sus imágenes y sonidos. La física y el dibujo son una reconstrucción.
  Las constantes de escala (proyección, potencia/rozamiento, exageración de curvas, distancia inicial del ladrón y que
  el ladrón nunca se aleje más que el máximo de la barra de distancia) están marcadas como "ajuste" en `src/game/racer/racer.ts`.
  Controles: flechas (o WASD); en pantallas táctiles aparecen botones de dirección, acelerar y frenar.
- **Programa principal** (`main.py`) no estaba en el zip: se recuperó del recurso `PYTHONSCRIPT` de `main.exe` (desensamblado).
- Las partes que se comunicaban con servidores remotos (estadísticas, errores, actualizaciones, envío de puntajes) se
  eliminaron; en su lugar el progreso se sincroniza con la API propia si hay sesión.
- `uncompyle6` escribió mal algunas listas grandes de constantes (matrices de departamentos limítrofes/cercanía,
  coordenadas del menú, letras de las notas, fracciones del jardinero): se recuperaron del desensamblado.
- `pygame.time.delay` (que congelaba el juego) se reemplazó por esperas no bloqueantes con la misma duración.
- Agregados web que no existían: pantalla "Tocá para empezar" (los navegadores exigen un gesto para el audio),
  menú con volumen/pantalla completa/cuenta/ranking y controles táctiles.

## Guardado

Igual que el original: lista de detectives (`characters.dat`), progreso de cada uno (incluido el caso en curso) y
récords, con el mismo formato de filas, pero en `localStorage`. Con sesión iniciada se sube todo a
`PUT /games/ded/save` (`elo` = puntaje, `spots_won` = casos resueltos, `max_area` = rango + 1, `gold` = medallas) y al
terminar cada caso se envía `POST /games/ded/results`.

## Publicar en AWS Amplify

Es un sitio estático: no necesita servidor ni la API para jugarse.

1. Los assets ya generados (`public/assets`, ~26 MB) se commitean: Amplify no tiene ffmpeg ni los archivos originales.
   Para regenerarlos, `npm run prepare-game` en tu máquina.
2. En Amplify Hosting: **Deploy an app** → este repositorio → rama `main`. Toma `amplify.yml` y `customHttp.yml` solos.
3. Rewrites and redirects (JSON): `[{"source": "/<*>", "status": "404-200", "target": "/index.html"}]`.
4. (Opcional) Con la API publicada, agregar la variable `VITE_API_URL=https://...` y volver a desplegar: aparecen
   "Cuenta de jugador" y "Ranking". Sin ella, el progreso se guarda en el navegador de cada jugador.
