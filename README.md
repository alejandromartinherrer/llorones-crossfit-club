# Llorones Crossfit Club

**App:** <https://alejandromartinherrer.github.io/llorones-crossfit-club/> · **Código:** <https://github.com/alejandromartinherrer/llorones-crossfit-club>

La pizarra de la cuadrilla: tiempos, entrenos, cronómetro, los 249 Hero WODs y las 30 Girls de crossfit.com, y una clasificación por puntos. Un solo `index.html`, sin instalación: se abre en el móvil como una web y se puede añadir a la pantalla de inicio (Safari → Compartir → Añadir a pantalla de inicio).

## Cómo compartimos los datos (igual que la app de nutrición)

Los datos de todos (atletas, entrenos propios y marcas) viven en `data/sync.json`, en la rama **`data`** de este repositorio. La app los lee y los escribe sola por la API de GitHub; no hay ningún servidor ni cuenta externa.

- **Leer es público**: cualquiera que abra el enlace ve las marcas y la clasificación de la cuadrilla.
- **Para escribir hace falta un código de acceso** (un token de GitHub). Cada persona lo pega una vez en **Perfil → Nube → Pegar código de acceso**; se guarda solo en su móvil y nunca sale en las copias exportadas. Sin código, el móvil está en *solo lectura* y lo avisa en la pantalla Hoy.
- Cada cambio se sube a los pocos segundos; la app se descarga la copia de la nube al abrirse, al volver a primer plano, al recuperar conexión y cada minuto. Si dos personas apuntan a la vez no se pierde nada: las copias se **fusionan por id** (gana la modificación más reciente; los borrados también se propagan).
- Si el móvil está sin red, las marcas se guardan en él y se suben solas después.
- Si el código caduca o se pega mal, la app **sigue enseñando las marcas de todos** (la lectura es pública) y avisa de que las tuyas no se están compartiendo.

### Crear el código de acceso (lo hace quien administra el club, una vez)

1. En GitHub, arriba a la derecha: **foto de perfil → Settings**. En la barra lateral izquierda, abajo del todo, **Developer settings**. Allí, bajo el apartado **Personal access tokens**, entra en **Fine-grained tokens** y pulsa **Generate new token**.
2. **Token name**: lo que quieras, por ejemplo `llorones-app`.
3. **Resource owner**: deja tu propia cuenta (`alejandromartinherrer`). Si eliges una organización, el repositorio del club no aparecerá en la lista.
4. **Expiration**: elige **Custom** y pon una fecha; el máximo con fecha son 366 días. GitHub también ofrece **No expiration**, pero no la uses: que caduque es parte de la seguridad de este montaje.
5. **Repository access**: marca **Only select repositories** y, en el desplegable **Select repositories** que aparece debajo, busca y marca `llorones-crossfit-club`.
6. **Permissions → Repository permissions**: busca **Contents** y ponlo en **Read and write**. No hace falta nada más; GitHub añade solo **Metadata: Read-only**, que aparece marcado y no se puede quitar.
7. Pulsa **Generate token**. El código (empieza por `github_pat_`) **solo se muestra una vez**: cópialo en ese momento y pásaselo a la cuadrilla. Si cierras la página sin copiarlo, no se puede recuperar y hay que generar otro.

Cada uno lo pega en **Perfil → Nube → Pegar código de acceso**. La app lo comprueba contra GitHub antes de guardarlo: si está mal o ha caducado te lo dice y conserva el que tuvieras.

Riesgo asumido: quien tenga el código puede escribir en este repositorio (solo en este). Mitigación: alcance mínimo y caducidad; si se filtra, se revoca en GitHub y se genera otro. Cuando caduque, la app avisa en la pantalla Hoy y en Perfil → Nube, y se sigue viendo todo mientras tanto.

Si la rama `data` desapareciera, la app intenta recrearla sola desde `main`; también vale `git push origin main:data`.

## Cómo se puntúa

Por cada entreno y día (cuenta la mejor marca de cada uno en ese entreno):

| Concepto | Puntos |
|---|---|
| Apuntar una marca válida (una marca en cero no cuenta) | 5 |
| **Rendimiento**: tu marca frente a la mejor del club en ese entreno | hasta 40 |
| Tener la mejor marca del club en ese entreno | +5 |
| Hacerlo Rx (la casilla viene marcada: quítala si escalaste) | +5 |
| Hero WOD | +10 |
| Benchmark (Girls) | +5 |
| Mejorar tu marca (PR) | +5 |
| Semana activa (3 días o más con entreno) | +5 |

El **rendimiento** es lo que hace que el resultado importe: quien tiene la mejor marca del club se lleva los 40 y el resto la parte proporcional. La mitad de rondas, la mitad de kilos o el doble de tiempo son la mitad de puntos. Así 20 rondas no valen lo mismo que 2, ni 10 minutos lo mismo que 20.

Detalles: si eres el único que ha hecho ese entreno cuenta a la mitad, hasta que otro lo haga. Una marca con time cap sin terminar no pasa de la mitad. Rx siempre queda por delante de scaled en la pizarra. Un mismo entreno solo suma una vez al día; las marcas extra de ese día solo cuentan para el PR. Los puntos se recalculan en vivo, así que cuando alguien mejora la referencia, la clasificación se ajusta sola. Periodos: semana, mes y temporada.

## Quién puede qué

La app tiene un **administrador** (quien montó el club; puede nombrar a más desde Perfil → Editar de cada atleta). El reparto es este:

| | Cualquiera | Admin |
|---|---|---|
| Crearse su atleta, apuntar, editar y borrar **sus** marcas, poner sus Rx | ✔ | ✔ |
| Cambiar **su** nombre, disco y PIN | ✔ | ✔ |
| Crear entrenos y editar o borrar **los suyos** | ✔ | ✔ |
| Editar o borrar a **otro** atleta | ✘ | ✔ |
| Editar o borrar marcas de **otro** | ✘ | ✔ |
| Editar o borrar entrenos de **otro** | ✘ | ✔ |
| Nombrar administradores | ✘ | ✔ |
| Cambiar o quitar el PIN de otro | ✘ | ✘ (ni el admin) |
| Importar una copia (cambia los datos de todos) | ✘ | ✔ |

Al apuntar una marca, quien no es admin solo puede hacerlo a su nombre: el selector de atleta queda fijado en él.

Si te equivocas de día o de resultado, **una marca se edita** (fecha, resultado, Rx, notas e incluso el entreno) **o se borra** con el lápiz y la papelera que salen donde se ve: en la ficha del entreno (Tus marcas y la pizarra) y en los Últimos tiempos de Hoy. El entreno del día también se edita o se quita desde la tarjeta "WOD de hoy".

Dos reglas más para que el club no se rompa: **el primero que se da de alta en un club vacío queda como administrador** (si no, nadie podría serlo nunca), y **no se puede borrar al último administrador**. Al borrar un atleta o un entreno propio se avisa de cuántas marcas se van con él y se borran también, para no dejar marcas fantasma puntuando.

### PIN

Como la app no tiene contraseñas, cualquiera podría ponerse el nombre de otro en "¿Quién eres?". Para evitarlo, cada uno puede ponerse un **PIN** de 4 a 8 números en **Perfil → Editar**. Con PIN puesto, para usar ese atleta hay que escribirlo (sale un 🔒 junto al nombre). **Al admin le conviene tenerlo**, porque es el único cerrojo entre un atleta normal y el mando del club.

El PIN solo lo pone y lo quita su dueño: ni el admin puede tocarlo. Se guarda derivado con PBKDF2 (210.000 vueltas y sal propia), nunca en claro, y no sale en las copias exportadas. Aun así son cuatro números y su huella viaja con los datos del club: **no lo trates como una contraseña de verdad**, trátalo como el candado de la taquilla.

Aviso honesto: esto ordena la convivencia dentro de la app, pero **no es un candado**. Todos compartís el mismo código de acceso a la nube, así que quien sepa hacerlo puede editar los datos directamente en GitHub. Para impedirlo de verdad haría falta un servidor, que es justo lo que este montaje evita.

## Crear entrenos

Un entreno nuestro se monta **eligiendo los movimientos de la lista**, para que todos escribamos lo mismo y la app sepa qué se hace en cada uno:

- **Formato** (For time, AMRAP, EMOM, Tabata, intervalos, fuerza, otro) y por qué se puntúa, como antes.
- **Rondas o esquema de reps**, en los formatos que lo llevan: un número son rondas (`5` → "5 rounds for time of:") y varios separados por guiones son un esquema (`21-15-9` → "21-15-9 reps for time of:"). Hay chips para los habituales (3, 5, 21-15-9, 15-12-9, 10→1; en fuerza 5x5, 5x3…).
- **Movimientos**, una fila por cada uno: las reps a la izquierda, el movimiento en medio y la carga Rx a la derecha si la hay. Al tocar el movimiento sale la lista entera por grupos y **se filtra según escribes** ("thr" → Thruster, Dumbbell thruster). Enter elige el primero. Si escribes el nombre entero ("pull-up") se enlaza solo, y si algo no está en la lista se puede **usar tal cual** (y avisar para añadirlo al catálogo).
- **Notas** opcionales (descansos, cómo repartir en pareja…).
- **Así quedará**: la vista previa del texto que se genera, al estilo de los héroes, con plurales ("10 Thrusters 43/30 kg") y con "400 m" o "20 cal" en los de cardio cuando solo pones el número.

Quien prefiera puede **escribirlo a mano** (el cuadro viene relleno con lo construido), y los entrenos antiguos escritos a mano se abren en ese modo; al pulsar "Mejor elegir los movimientos de la lista" se convierten en filas en lo que se pueda ("30 Push Ups" → 30 × Push-up; las líneas "Rx …" pasan a las notas).

Los entrenos nuestros los edita quien los creó **o quien administra el club**, da igual quién los metiera.

## Movimientos y Rx de cada uno

**Perfil → Mis Rx** tiene el catálogo de movimientos (151, sacados de los propios entrenos, del Open y los Games, de Hyrox y del trabajo de kettlebell y **con el nombre en inglés**, como se dicen en el box) agrupados en Barbell, Dumbbell & kettlebell, Ball, sandbag & vest, Box, Gymnastics, Cardio y Other. Cada uno apunta lo suyo: los kilos con los que hace cada levantamiento, la altura de cajón, si un gimnástico lo tiene Rx, Scaled o Aún no, y una nota libre en los de cardio.

Como ya son muchos, arriba de la lista hay un **buscador** que filtra según escribes, también por abreviaturas (hspu, t2b, c2b, kb swing, g2oh…); las mismas abreviaturas valen al montar un entreno.

En la ficha de cada entreno, la sección **Tus Rx aquí** enseña tus cargas en los movimientos de ese WOD (los elegidos de la lista si se montó por bloques; adivinados en el texto si está escrito a mano), para saber de un vistazo con qué peso vas y si te sale Rx.

**Al porcentaje**: arriba de Mis Rx se elige a qué porcentaje quieres ver las cargas (50, 60, 70, 80, 90 % u otro a mano) y debajo de cada movimiento con kilos aparece lo que te toca, redondeado a medio kilo (65 kg al 70 % → 45,5 kg). El porcentaje elegido se recuerda en ese móvil.

## Músculos

Cada movimiento del catálogo lleva sus **músculos principales y secundarios** (16 grupos: hombros, pecho, bíceps, tríceps, antebrazos, trapecio, espalda alta, lumbar, abdominales, oblicuos, glúteos, cuádriceps, isquios, aductores, gemelos, tibiales). Con eso:

- En la ficha de cada entreno, **Músculos que trabaja** dibuja el cuerpo (de frente y de espaldas) con los grupos que toca: verde intenso los principales, apagado los que ayudan. Cada movimiento suma 1 a sus principales y 0,3 a los secundarios.
- En **Perfil → Tus músculos**, lo tuyo según las marcas que has apuntado: **Equilibrio** (reparto del trabajo por grupos en la semana, 30 días, 90 días o todo, con lo que no has tocado en ese periodo) y **Fatiga** (días desde la última marca en que cada músculo fue principal: hoy o ayer fatigado, hasta tres días en recuperación, después listo).
- Tocar un músculo enseña qué movimientos lo trabajan (en ese entreno o en lo que has hecho) y otros del catálogo que lo tienen de principal.

El dibujo del cuerpo viene de [react-native-body-highlighter](https://github.com/HichamELBSI/react-native-body-highlighter) (MIT, © 2022 ELABBASSI Hicham; licencia en `data/cuerpo.LICENSE`), convertido a `data/cuerpo.json`.

## Entrenos sugeridos

**Perfil → Entrenos sugeridos** propone qué hacer hoy según lo que has apuntado y el tiempo que tienes (un deslizador de **5 a 25 minutos**, que se recuerda):

- **Cómo estás**: el cuerpo con lo **fatigado** (principal en una marca de hoy o ayer), lo que está **recuperando** (hasta tres días) y lo que **toca**: frescos y con falta de trabajo en los últimos 30 días, comparando tu reparto con el típico de los Héroes y las Girls. Si tienes medio cuerpo fatigado, lo avisa.
- **A tu medida**: un AMRAP, un for time y un EMOM (este desde 6 min) montados con movimientos de siempre para esa duración, cada uno con movimientos distintos, eligiendo lo que tienes fresco y sin tocar lo fatigado. Las reps salen del ritmo de un atleta medio y de la carga Rx (43/30 kg el thruster, 24/16 kg la kettlebell…); en los for time cortos usa esquemas tipo 21-15-9. No propone lo que tienes como «Aún no» en Mis Rx, ni muscle-ups si no los tienes como Rx. **Usar este entreno** abre el formulario relleno y programado para hoy, para retocarlo y guardarlo. **Otras ideas** baraja otras propuestas.
- **Del catálogo**: Héroes, Girls y los vuestros que duran más o menos ese tiempo, ordenados por lo bien que le vienen a tu estado; lo que has hecho esta semana no sale, y los que piden algo que tienes como «Aún no» bajan y lo avisan.

La duración de los entrenos del catálogo es fija en los AMRAP, EMOM y Tabata; en los for time es **lo que tarda el club** (la mediana de las marcas terminadas) y, si nadie lo ha hecho, una **estimación** a partir de la prescripción (reps, distancias, cargas y descansos al ritmo de un atleta medio: Fran ≈ 5 min, Helen ≈ 11, DT ≈ 14, Angie ≈ 22, Murph ≈ 57). Los de pareja y los de fuerza no se sugieren.

## Cronómetro

For time (con time cap opcional y vueltas), AMRAP (con contador de rondas), EMOM y Tabata, con cuenta atrás de preparación, pitidos (3-2-1, cambios de intervalo, final) y bloqueo de pantalla mientras corre. Si se abre desde un entreno queda preconfigurado y, al terminar, el resultado se apunta con un toque.

## Datos

- Los Hero WODs vienen del PDF oficial de CrossFit (`crossfit.com/heroes`, edición 20260520) y de sus fichas en `crossfit.com/benchmark/…`; cada uno incluye prescripción, cargas ♀/♂ (en lb y kg), fecha de publicación y a quién honra.
- Copia de seguridad: **Perfil → Exportar copia** genera un JSON con todo; **Importar copia** lo fusiona con lo que haya.

## Desarrollo

| Archivo | Rol |
|---|---|
| `index.html` | La app completa, generada por `build.js` |
| `src/index.html`, `src/app.css`, `src/app.js` | Fuente |
| `data/heroes.json`, `data/girls.json`, `data/movimientos.json`, `data/cuerpo.json` | Catálogos incrustados en el build (movimientos con sus músculos; cuerpo con los paths SVG) |
| `test/sync.test.js` | Pruebas de la fusión y, con `GH_TOKEN`, viaje de ida y vuelta real contra la rama `data` |
| `test/puntos`, `permisos`, `entrenos`, `marcas`, `musculos`, `sugeridos`, `crono`, `reloj.test.js` | Pruebas de uso real en Chrome sin cabeza (`drive.js`): puntuación, permisos y PIN, constructor de entrenos y Mis Rx al %, cronómetro y reloj a pantalla completa. Necesitan la app servida en `http://127.0.0.1:8765` (`python -m http.server 8765`) |

```bash
node build.js && node test/sync.test.js
```

Al cambiar algo: editar `src/`, ejecutar el build, subir `index.html` a `main`. Pages publica en un minuto. La rama `data` solo la toca la app.
