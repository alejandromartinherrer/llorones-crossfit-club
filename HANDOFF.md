# Llorones Crossfit Club — Handoff

## Estado actual (v1.11.4 — 2026-10-07)
- Repo: `github.com/alejandromartinherrer/llorones-crossfit-club` (público; Pages publica `main`).
- App: <https://alejandromartinherrer.github.io/llorones-crossfit-club/> · un solo `index.html` generado
  por `build.js` desde `src/` y `data/`. Los móviles se ponen al día solos al abrirla (miran `version.json`).
- Carpeta local: `C:\Users\ALEJANDRO\GitRepos\llorones-crossfit-club` (fuera de OneDrive).
- Datos del club: `data/sync.json` en la rama **`data`**, que solo toca la app. Leer es público y escribir
  necesita el código de acceso que cada uno pega en su móvil. El código nunca va al repo; `gh_token.txt` está
  en `.gitignore`.
- Pruebas: `test/sync.test.js` (sin Chrome) y 14 archivos de uso real en Chrome sin cabeza; los dos de la
  auditoría (`auditoria-entrenos`, `auditoria-marcas`) son nuevos. Con la v1.11.4 pasan todos: 534
  comprobaciones en los 14 de navegador, más la fusión de `sync.test.js`.
- v1.11.4 cierra la auditoría del 07/10/2026: 5 agentes metieron entrenos de prueba de todos los formatos y
  unidades, nuevos y viejos (51 hallazgos), y 2 agentes arreglaron los 29 temas en que se agruparon. Lo que
  quedó como duda está en «Pendiente». Los códigos `T1-01`…`T5-07` de este archivo son esos hallazgos (T1–T5,
  uno por agente) y rotulan también los casos de `test/auditoria-*.test.js`.

## Cómo se trabaja
- **En una rama del repo**, con commits tempranos; publicar = merge a `main` + push. Lo desechable
  (scripts sueltos, logs, capturas) fuera del repo.
- En la rama: `src/` (y `data/` si toca) → subir `APP_VERSION` en `src/app.js` → `node build.js` → pruebas →
  copiar `dist/index.html` y `dist/version.json` a la raíz → commit. Luego merge a `main` y push.
- Pruebas: servir la carpeta (`python -m http.server 8765`) y `node test/<archivo>.test.js`; con otro puerto,
  `APP_URL=http://127.0.0.1:<puerto>/dist/index.html`. Cada archivo usa sus puertos CDP fijos (se pueden
  correr varios a la vez). Las capturas van a `shots/` (ignorado). Cada archivo termina con
  `== RESULTADO: TODO CORRECTO` y sale con 0: mirar eso, no buscar «MAL» en el log (salta con títulos como
  «UN ATLETA NORMAL…»). `actualizar.test.js` reescribe `dist/version.json` y lo deja como estaba, pero se
  vuelve a hacer el build antes de publicar.
- Comprobar la publicación: `version.json` en vivo y el `index.html` en vivo igual a `dist/index.html` sin
  los CR (`cmp <(tr -d '\r' < vivo) <(tr -d '\r' < dist/index.html)`).
- La especificación de cara al club es el `README.md` («Cómo se puntúa», «Quién puede qué», «Crear
  entrenos»): si un cambio toca una regla, se actualiza ahí.

## Invariantes (NO romper — cada uno costó un incidente)
1. **`test/live5.js` VACÍA la nube** (la rama `data`): era la prueba en vivo con cinco móviles de antes del
   estreno. Nunca con datos reales. **`test/sync.test.js` con `GH_TOKEN` también la deja vacía** al terminar
   su viaje de ida y vuelta: correrlo siempre sin esa variable (`env -u GH_TOKEN node test/sync.test.js`), que
   solo prueba la fusión.
2. **Las pruebas de navegador van con móviles `sinNube: true`.** Escribir en la nube solo si lo pide quien
   administra. Si hay que corregir datos a mano: clon de la rama `data`, `data/sync.json` en JSON compacto
   sin salto final, subir el `updatedAt` de cada documento tocado para que gane en la fusión, y push. Así se
   hizo el 06/10/2026 (unidades de 6 entrenos).
3. **`index.html` y `version.json` se publican juntos**: la app compara su versión con `version.json` y se
   recarga sola; uno sin el otro deja los móviles con la versión vieja o pidiendo una que no está.
4. **El repo tiene `core.autocrlf=true` y Pages sirve LF**: el hash directo del `index.html` en vivo nunca
   coincide con el local; se compara sin los CR.
5. **El puerto 8765 puede estar cogido por otra sesión** (pasó el 06/10/2026): servir en otro y usar `APP_URL`.
6. **`confirmSheet` sustituye la hoja abierta**: un aviso dentro de un formulario va en línea, en el
   `.form-error`, con un botón que repite la acción («Cambiarla por esta», «Guardar igualmente»). Con
   `confirmSheet` se pierde lo escrito.
7. **Las marcas copian el `scoreType` del entreno al apuntarse y no se migran.** Si cambia «Se puntúa por»,
   las viejas se quedan aparte: debajo de la pizarra, con rendimiento, mejor marca y PR propios, hasta que
   cada uno edita la suya. Mezclarlas daba pizarras y clasificaciones erráticas (auditoría, T5-01 y T3-02).
8. **«Se puntúa por» automático con máximos** (EMOM, AMRAP, Tabata, intervalos): `#w-score.dataset.maximos`
   guarda la última situación aplicada (`''`, `reps`, `distance`) y solo se actúa cuando cambia. Así se
   respeta lo elegido a mano después (antes se pisaba al tocar otra fila: T3-03).
9. **Una marca por atleta, entreno y día** (`marcasQueCuentan`; si hubiera más, cuenta la última apuntada
   que sea válida) y el **PR solo contra días anteriores**.

## Mapa rápido del código (`src/app.js`, unas 3.000 líneas)
- Nube: `mergeSnapshots` (fusión por id; gana el `updatedAt` más reciente) · `docStamp` · `chooseStore` ·
  `parseCaducidad`/`diasHasta` (caducidad del código de acceso).
- Estado y permisos: `state` · `soyAdmin`, `puedoEditar*`, `puedoBorrar*` · PIN: `creaPin`, `compruebaPin`.
- Marcas y puntos: `PTS` · `SCORE_LABEL` · `marcaValida`/`valorMarca` · `compareResults` (primero el
  `scoreType`) · `fmtScore` · `rendimientosDeEntreno` · `computeStandings` (por `workoutId|scoreType`) ·
  `wodBoard` · `marcasQueCuentan` · `isPR`.
- Apuntar una marca: `scoreFields` · `maximosDe` · `openLogResult` · `readTime` · `saveResult` (aviso en línea
  con «Cambiarla por esta»).
- Formulario de entrenos: `openWorkoutForm` · `leerFormEntreno` · `pintaPreviewEntreno` · texto ⇄ bloques con
  `parseaTexto`, `generaDescripcion`, `cabeceraEntreno`, `cabeceraAForm` · filas con `lineaBloque`, `plural`,
  `partesCant`, `udDeBloque` · esquema con `ESQUEMA_REPS_RE`, `esquemaValido`, `numerosEsquema` · puntuación
  con `DEFAULT_SCORE`, `opcionesPuntua`, `puntuaDeMaximos`, `situacionMaximos`, `puntuaMaximos` · `saveWorkout`.
- Pantallas: `viewHome` · `viewWods`/`viewWod` (pizarra y marcas de otro formato) · `viewRanking` · `viewRx` ·
  `viewProfile` · `viewMusculos` · `viewSugeridos` · `viewTimer` (crono: `timer*`, `ajustaReloj`).
- Sugeridos y músculos: `estimaTexto` · `estadoMuscular` · `sugerenciasAMedida` · `sugerenciasCatalogo`.
- Actualización sola: `buscaVersionNueva` · `actualizaApp` · `avisoVersion`.
- Hojas y avisos: `openSheet`, `closeSheet`, `confirmSheet` (ver el invariante 6) · `toast`.
- Acciones: `ACTIONS` (un `data-action` por botón o campo) · `onAction`/`onChange` · `boot` (escuchas globales,
  entre ellas `focusin`/`focusout` del formulario de entrenos).
- Datos que mete el build: `data/movimientos.json` (catálogo y alias), `heroes.json`, `girls.json`,
  `pruebas.json` (pruebas oficiales; hoy solo la DEKA FIT) y `cuerpo.json` (figura de frente y espalda de
  Músculos, sacada con `tools/cuerpo-desde-body-highlighter.js`).

## Hecho en los últimos días (06–07/10/2026)
La app existe desde el 06/09/2026; el historial completo está en `git log`.
- `0e15a9e` v1.11.0: For quality sin crono ni marca; metros, calorías y segundos en los movimientos.
- `c9ac672` v1.11.1: Triceps extension en el catálogo.
- `f5a1f2e` v1.11.2: unidad «máx» («Max Pull-ups», «Max cal Row»); con máximos, EMOM, AMRAP, Tabata e
  intervalos se puntúan por reps.
- `51315c8` v1.11.3: si todos los máximos son de distancia («Max meters Run») se puntúa por metros (así se
  apunta salir a correr).
- `bb82c06` + `8df3868` v1.11.4: arreglos de la auditoría (el primero, fuentes y pruebas; el segundo, la
  publicación). Formulario de entrenos: «Se puntúa por» con máximos,
  texto ⇄ bloques, esquema, unidades tecleadas, alias, plurales, avisos al guardar. Puntos y marcas: formatos
  aparte, empates, redondeo, «Cambiarla por esta», enteros y time cap al apuntar, PR al corregir.

## En vuelo
Nada.

## Pendiente / dudas para decidir (de la auditoría; no se han tocado)
- **Rx lento frente a escalado rápido** (T5-03): la pizarra y el +5 de mejor marca ponen primero al Rx, pero
  el rendimiento (hasta 40) solo mira la marca, así que un escalado rápido puede sacar más que un Rx lento.
- **«Max Plank»** y otros máximos de segundos (T3-07, T2-10): se puntúan por reps totales y el texto sale sin
  unidad; «máx» y «máx cal» dan el mismo texto en la bici.
- **Modo texto** (T1-09, T1-14): la duración, el intervalo y las rondas salen de los campos, no del texto
  («AMRAP 20 min» escrito con el campo en 12 se queda en 12); un EMOM antiguo sin parámetros recibe 60 s × 10
  al editarlo.
- **Semana activa en «Mes»** (T5-07): en una semana a caballo entre dos meses, el +5 no cuenta los días que
  caen fuera del mes.
- **Cantidades de texto libre** (T2-08): en la cantidad de una fila, «15 kg», «5k», «abc» o «0» se aceptan tal
  cual.
- Sin tope superior en reps, rondas y metros al apuntar.
- Decididos sin cambios: recortes de rango en silencio (T1-11), cambiar de formato reinicia los parámetros
  (T1-12) y las líneas libres pasan a filas al volver a bloques (T1-15).

## Prompt de reanudación
«Lee `HANDOFF.md` y `README.md` de `C:\Users\ALEJANDRO\GitRepos\llorones-crossfit-club`. La app está en la
v1.11.4 publicada. Trabaja en una rama del repo; pruebas con móviles `sinNube` y `APP_URL` si el 8765 está
cogido; nunca `test/live5.js` ni `test/sync.test.js` con `GH_TOKEN` (las dos vacían la nube). Siguiente:
decidir con el usuario las dudas de “Pendiente”.»
