# Llorones Crossfit Club — Handoff

## Estado actual (v1.11.6 — 2026-10-14)
- Repo: `github.com/alejandromartinherrer/llorones-crossfit-club` (público; Pages publica `main`).
- App: <https://alejandromartinherrer.github.io/llorones-crossfit-club/> · un solo `index.html` generado
  por `build.js` desde `src/` y `data/`. Los móviles se ponen al día solos al abrirla (miran `version.json`).
- Carpeta local: `C:\Users\ALEJANDRO\GitRepos\llorones-crossfit-club` (fuera de OneDrive).
- Datos del club: `data/sync.json` en la rama **`data`**, que solo toca la app. Leer es público y escribir
  necesita el código de acceso que cada uno pega en su móvil. El código nunca va al repo; `gh_token.txt` está
  en `.gitignore`.
- Pruebas: `test/sync.test.js` (sin Chrome) y 16 archivos de uso real en Chrome sin cabeza; el último es
  `reglas` (lo de la v1.11.6). Con la v1.11.6 pasan todos: 603 comprobaciones en los 16 de navegador,
  más la fusión de `sync.test.js`.
- v1.11.6 (14/10/2026): las dudas de «Pendiente» decididas con el usuario. Botones **Hoy / Ayer** junto a la
  fecha al apuntar; una marca **escalada no saca más rendimiento que el peor Rx** de ese entreno; la **semana
  activa** a caballo entre dos meses cuenta entera en el mes de su jueves; las **cantidades de las filas** se
  validan al guardar; y una **marca rara** (más del triple de la mejor del club, o por encima de 2000 reps,
  200 rondas, 50.000 m o 400 kg) pide «¿Seguro?» con «Guardar igualmente».
- v1.11.5 (14/10/2026): en los entrenos por kg se apuntan también, si se quiere, las **reps con ese peso**
  (180 kg × 2), que desempatan a igualdad de kilos. Salió del peso muerto del 13/10 (cada 90 s × 8:
  5-5-4-4-3-3-2-2, subiendo de peso hasta el máximo).
- v1.11.4 cerró la auditoría del 07/10/2026: 5 agentes metieron entrenos de prueba de todos los formatos y
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
- Toda la batería: cada `test/*.test.js` con `env -u GH_TOKEN` (así `sync.test.js` no toca la nube; el patrón
  deja fuera `live5.js`) y `timeout 900`, mirando el código de salida y la línea `== RESULTADO` de cada log
  (los logs, fuera del repo). Como cada archivo tiene sus puertos, se puede repartir en grupos en paralelo.
- Mirar la nube sin tocarla: `git fetch origin data` y `git show origin/data:data/sync.json`.
- Una prueba que necesite otro «hoy» (meses, semanas) sustituye `todayISO` en la página y la deja como
  estaba al acabar: así lo hace `test/reglas.test.js` con la semana activa.
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
  `scoreType`; en kg, a igualdad de kilos, `repsCarga`) · `fmtScore`/`scoreHtml` · `rendimientosDeEntreno`
  (con el tope del escalado al peor Rx) · `computeStandings` (por `workoutId|scoreType`; la semana activa,
  con `semanaEnPeriodo`) · `wodBoard` · `marcasQueCuentan` · `isPR`. En una marca por
  kg, `reps` son las reps con ese peso (opcionales; sin ellas cuentan como 1) y solo desempatan: `valorMarca`,
  y con él el rendimiento, mira solo los kilos. Quien lea `r.reps` tiene que mirar antes el `scoreType`.
- Apuntar una marca: `scoreFields` (en kg, `#f-load` y `#f-load-reps`) · `maximosDe` · `openLogResult` (la
  fecha se propone con la de hoy; `FECHA_CHIPS`/`marcaFechaChips` para Hoy / Ayer) · `readTime` · `saveResult`
  (avisos en línea: «Cambiarla por esta» y, después, `avisoMarcaRara` con `MARCA_TOPE` y «Guardar
  igualmente», que lleva el `data-reemplaza` si venía de cambiar otra).
- Formulario de entrenos: `openWorkoutForm` · `leerFormEntreno` · `pintaPreviewEntreno` · texto ⇄ bloques con
  `parseaTexto`, `generaDescripcion`, `cabeceraEntreno`, `cabeceraAForm` · filas con `lineaBloque`, `plural`,
  `partesCant`, `cantValida`, `udDeBloque` · esquema con `ESQUEMA_REPS_RE`, `esquemaValido`, `numerosEsquema` · puntuación
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

## Hecho en los últimos días (06–14/10/2026)
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
- 10/10: entreno «10.10 Cachirulo» metido a mano en la nube, sacado de la foto de la pizarra, a petición del
  admin (rama `data`, `df7b46b`).
- `1be0184` + `490fe53` v1.11.5: «Reps con ese peso» opcional al apuntar una marca por kg (180 kg × 2). A
  igualdad de kilos ponen delante en la pizarra y deciden la mejor marca (+5) y el PR (180 × 3 después de
  180 × 2 es PR); sin apuntar cuentan como 1; el rendimiento sigue saliendo solo de los kilos. En la pizarra,
  «180 kg × 2» solo se parte antes del «×». Prueba nueva: `test/pesos.test.js` (28 comprobaciones).
- `8849c96` + `b1474d1` v1.11.6 (publicada y comprobada en vivo el 14/10): las dudas de «Pendiente»,
  decididas con el usuario ese día:
  - **Fecha**: botones «Hoy» / «Ayer» bajo la fecha de la hoja de apuntar; queda marcado el que coincide.
  - **Rx frente a escalado** (T5-03): tope al peor Rx. Una marca escalada no pasa del rendimiento del Rx con
    peor marca, también si ese Rx no terminó (time cap); sin ningún Rx, las escaladas se miden entre ellas.
    En la nube no cambia nada: de 84 marcas solo 3 son escaladas y ninguna superaba a un Rx.
  - **Semana activa** (T5-07): cuenta entera, con todos sus días, en el mes de su jueves (como las semanas
    ISO). Así la suma de los meses da lo de la temporada.
  - **Cantidades** (T2-08): al guardar un entreno por bloques, una cantidad que no sea un número mayor que
    cero, un rango, un esquema o ♀/♂ (10, 1,5, 10-15, 21-15-9, 15/12) da error con su fila y el foco en ella.
    En modo texto vale lo escrito: un entreno pasado a texto sin tocarlo, con una cantidad mala, se guarda
    como texto y no como filas.
  - **Marca rara** (sin tope superior): más del triple de la mejor del club en ese entreno (en tiempo, menos
    de un tercio del mejor) o más de 2000 reps, 200 rondas, 50.000 m o 400 kg (`MARCA_TOPE`) pide
    «¿Seguro?» con «Guardar igualmente», también después de «Cambiarla por esta».
  - Prueba nueva: `test/reglas.test.js` (41 comprobaciones).

## En vuelo
Nada. `main` = `origin/main`; la rama `dudas-pendientes` ya está fusionada (se puede borrar).

## Pendiente / a vigilar
- **«10.13 - 1» (el peso muerto del 13/10) se puntúa aún por reps**: así seguía en la nube a las 11:06 (Madrid) del
  14/10, con una sola marca, la de Santi (28 reps, fecha 14/10). El usuario decidió arreglarlo desde la app.
  Pueden hacerlo el admin (Alejandro) o Santi, que creó el entreno: editarlo, «Se puntúa por: kg» y
  «Guardar igualmente». Después, Santi edita su marca con los kilos, las reps con ese peso y la fecha del
  13/10 (ahora le basta «Ayer» si lo hace el 14). Comprobar en la nube que ha quedado así.
- **Rango con unidad tecleada** («3-5 m» en la cantidad): `partesCant` solo separa la unidad de un número
  suelto, así que ese texto ahora da error de cantidad (antes se guardaba tal cual). Se escribe 3-5 y se
  elige «m». Si molesta, que `partesCant` entienda rangos con unidad.
- **Los umbrales del aviso de marca rara** (×3 y `MARCA_TOPE`) son de criterio: ajustarlos si saltan con
  marcas buenas.

Decididos sin cambios (14/10/2026, con el usuario):
- **«Max Plank»** y otros máximos de segundos (T3-07, T2-10): se puntúan por reps totales y el texto sale sin
  unidad (podría ser «Max seconds Plank»). «Máx» en la bici sale como calorías, que es su unidad.
- **Modo texto** (T1-09, T1-14): la duración, el intervalo y las rondas salen de los campos, no del texto
  («AMRAP 20 min» con el campo en 12 se queda en 12), y un EMOM antiguo sin parámetros recibe 60 s × 10 al
  editarlo. Solo 3 de los 46 entrenos de la nube están en modo texto.
- De antes: recortes de rango en silencio (T1-11), cambiar de formato reinicia los parámetros (T1-12) y las
  líneas libres pasan a filas al volver a bloques (T1-15).

## Prompt de reanudación
«Lee `HANDOFF.md` y `README.md` de `C:\Users\ALEJANDRO\GitRepos\llorones-crossfit-club`. La app está en la
v1.11.6 publicada. Trabaja en una rama del repo; pruebas con móviles `sinNube` y `APP_URL` si el 8765 está
cogido; nunca `test/live5.js` ni `test/sync.test.js` con `GH_TOKEN` (las dos vacían la nube). No quedan
dudas abiertas. Siguiente: mirar en la nube si «10.13 - 1» ya se puntúa por kg y si la marca de Santi tiene
los kilos y la fecha del 13/10; si no, recordárselo al usuario.»
