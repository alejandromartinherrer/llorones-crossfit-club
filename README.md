# Llorones Crossfit Club

**App:** <https://alejandromartinherrer.github.io/llorones-crossfit-club/> · **Código:** <https://github.com/alejandromartinherrer/llorones-crossfit-club>

La pizarra de la cuadrilla: tiempos, entrenos, cronómetro, los 249 Hero WODs y las 30 Girls de crossfit.com, y una clasificación por puntos. Un solo `index.html`, sin instalación: se abre en el móvil como una web y se puede añadir a la pantalla de inicio (Safari → Compartir → Añadir a pantalla de inicio).

## Cómo compartimos los datos (igual que la app de nutrición)

Los datos de todos (atletas, entrenos propios y marcas) viven en `data/sync.json`, en la rama **`data`** de este repositorio. La app los lee y los escribe sola por la API de GitHub; no hay ningún servidor ni cuenta externa.

- **Leer es público**: cualquiera que abra el enlace ve las marcas y la clasificación de la cuadrilla.
- **Para escribir hace falta un código de acceso** (un token de GitHub). Cada persona lo pega una vez en **Perfil → Nube → Pegar código de acceso**; se guarda solo en su móvil y nunca sale en las copias exportadas. Sin código, el móvil está en *solo lectura* y lo avisa en la pantalla Hoy.
- Cada cambio se sube a los pocos segundos; la app se descarga la copia de la nube al abrirse, al volver a primer plano, al recuperar conexión y cada minuto. Si dos personas apuntan a la vez no se pierde nada: las copias se **fusionan por id** (gana la modificación más reciente; los borrados también se propagan).
- Si el móvil está sin red, las marcas se guardan en él y se suben solas después.

### Crear el código de acceso (lo hace quien administra el club, una vez)

1. GitHub → foto de perfil → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Nombre libre (p. ej. `llorones-app`), caducidad la máxima que permita (1 año) y **Repository access: Only select repositories → `llorones-crossfit-club`**.
3. **Permissions → Repository permissions → Contents: Read and write**. Nada más.
4. Genera el token, cópialo y pásaselo a la cuadrilla por el canal que uséis. Cada uno lo pega en la app.

Riesgo asumido: quien tenga el código puede escribir en este repositorio (solo en este). Mitigación: alcance mínimo y caducidad; si se filtra, se revoca en GitHub y se genera otro. Cuando caduque, la app lo avisa en Perfil → Nube.

Si la rama `data` desapareciera, la app intenta recrearla sola desde `main`; también vale `git push origin main:data`.

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

For time (con time cap opcional y vueltas), AMRAP (con contador de rondas), EMOM y Tabata, con cuenta atrás de preparación, pitidos (3-2-1, cambios de intervalo, final) y bloqueo de pantalla mientras corre. Si se abre desde un entreno queda preconfigurado y, al terminar, el resultado se apunta con un toque.

## Datos

- Los Hero WODs vienen del PDF oficial de CrossFit (`crossfit.com/heroes`, edición 20260520) y de sus fichas en `crossfit.com/benchmark/…`; cada uno incluye prescripción, cargas ♀/♂ (en lb y kg), fecha de publicación y a quién honra.
- Copia de seguridad: **Perfil → Exportar copia** genera un JSON con todo; **Importar copia** lo fusiona con lo que haya.

## Desarrollo

| Archivo | Rol |
|---|---|
| `index.html` | La app completa, generada por `build.js` |
| `src/index.html`, `src/app.css`, `src/app.js` | Fuente |
| `data/heroes.json`, `data/girls.json` | Catálogo incrustado en el build |
| `test/sync.test.js` | Pruebas de la fusión y, con `GH_TOKEN`, viaje de ida y vuelta real contra la rama `data` |
| `test/live5.js` | Prueba en vivo: cinco móviles (Chrome headless) usan la app y publican en la nube |
| `test/drive.js`, `test/shots.js` | Utilidades de esas pruebas y generador de capturas |

```bash
node build.js && node test/sync.test.js
```

La prueba en vivo (`node test/live5.js`) abre cinco Chrome sin ventana, cada uno con su
propio almacenamiento, y hace de cinco personas: se dan de alta, apuntan marcas, crean un
entreno, usan el cronómetro y comprueban que todos ven lo de los demás. **Vacía la nube al
empezar**, así que solo se ejecuta a propósito; necesita `gh_token.txt` en la raíz (no se
sube: está en `.gitignore`) y la app servida en `http://127.0.0.1:8765`.

Al cambiar algo: editar `src/`, ejecutar el build, subir `index.html` a `main`. Pages publica en un minuto. La rama `data` solo la toca la app.
