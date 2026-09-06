# La Pizarra

**App:** <https://alejandromartinherrer.github.io/la-pizarra/> · **Código:** <https://github.com/alejandromartinherrer/la-pizarra>

La pizarra de la cuadrilla de CrossFit: tiempos, entrenos, cronómetro, los 249 Hero WODs y las 30 Girls de crossfit.com, y una clasificación por puntos. Un solo archivo `index.html`, sin instalación: se abre en el móvil como una web y se puede añadir a la pantalla de inicio.

## Publicar en GitHub Pages (5 minutos)

1. Crea un repositorio en GitHub (por ejemplo `la-pizarra`) y sube `index.html` a la raíz.
2. En el repositorio: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: main / (root) → Save**.
3. En un minuto la app queda en <https://alejandromartinherrer.github.io/la-pizarra/>. Comparte ese enlace con la cuadrilla (ya está hecho para este repositorio).

## Compartir los datos entre todos (Firebase, gratis)

Sin configurar nada la app funciona en **modo local**: cada móvil guarda sus propios datos. Para que todos veáis los mismos tiempos y la misma clasificación:

1. Entra en <https://console.firebase.google.com>, **Añadir proyecto** (nombre libre, sin Analytics).
2. En el proyecto: **Compilación → Realtime Database → Crear base de datos** → elige la ubicación (Bélgica / europe-west1 va bien) → **Empezar en modo de prueba**.
3. Pestaña **Reglas** de la base de datos: pon esto y publica (cualquiera con el enlace puede leer y escribir; para un grupo de amigos es suficiente):
   ```json
   { "rules": { ".read": true, ".write": true } }
   ```
4. **Configuración del proyecto (rueda dentada) → Tus apps → icono web `</>`** → registra la app (sin hosting) y copia el objeto `firebaseConfig`.
5. Abre `index.html` con un editor de texto, busca `const FIREBASE_CONFIG = null;` y sustitúyelo por tu configuración, añadiendo una `groupKey` (una palabra para vuestro grupo):
   ```js
   const FIREBASE_CONFIG = {
     apiKey: "AIza....",
     authDomain: "la-pizarra-1234.firebaseapp.com",
     databaseURL: "https://la-pizarra-1234-default-rtdb.europe-west1.firebasedatabase.app",
     projectId: "la-pizarra-1234",
     groupKey: "cuadrilla-2026"
   };
   ```
6. Sube el `index.html` actualizado al repositorio. Listo: todos los que abran el enlace comparten atletas, entrenos y resultados en tiempo real.

Alternativa sin tocar el archivo: en la app, **Perfil → Configurar Firebase** y pega el mismo objeto JSON (solo vale para ese dispositivo).

Nota: el `apiKey` de Firebase no es secreto (va en cualquier web que use Firebase); lo que protege los datos son las reglas. Con reglas abiertas, cualquiera que conozca la URL de la base de datos podría escribir; la `groupKey` solo separa los datos de vuestro grupo.

## Cómo se puntúa

| Concepto | Puntos |
|---|---|
| Apuntar un entreno (un mismo entreno solo cuenta una vez al día) | 10 |
| Hacerlo Rx | +5 |
| Hero WOD | +10 |
| Benchmark (Girls) | +5 |
| Mejorar tu marca (PR) | +5 |
| 1.º / 2.º / 3.º de la pizarra de ese entreno (si lo han hecho 2 o más) | 15 / 10 / 6 |
| A partir del 4.º | 3 |
| Semana activa (3 días o más con entreno) | +5 |

Cuenta la mejor marca de cada atleta en cada entreno; Rx siempre queda por delante de scaled. Los puntos se recalculan en vivo. Periodos: semana, mes y temporada (todo).

## Cronómetro

For time (con time cap opcional y vueltas), AMRAP (con contador de rondas), EMOM y Tabata, con cuenta atrás de preparación, pitidos (3-2-1, cambios de intervalo, final) y bloqueo de pantalla mientras corre. Si se abre desde un entreno, queda preconfigurado y al terminar el resultado se apunta con un toque.

## Datos

- Los Hero WODs vienen del PDF oficial de CrossFit (`crossfit.com/heroes`, edición 20260520) y de sus fichas en `crossfit.com/benchmark/…`; cada uno incluye prescripción, cargas ♀/♂, fecha de publicación y a quién honra.
- Copia de seguridad: **Perfil → Exportar copia** genera un JSON con todo; **Importar copia** lo vuelve a cargar (también sirve para pasar datos del modo local a Firebase).

## Desarrollo

`src/` contiene `index.html`, `app.css` y `app.js`; `data/` los JSON de héroes y girls. `node build.js` genera `dist/index.html`.
