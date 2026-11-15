# SPEC 01 — Cuatro fantasmas con IA propia

> **Status:** Approved
> **Depends on:** —
> **Date:** 2026-11-15
> **Objective:** Añadir cuatro fantasmas con IA distinta (cazador agresivo, aleatorio, patrullero y cobarde) y una alternancia global de dispersión/persecución.

## Scope

**In:**

- Cuatro fantasmas con roles fijos: `hunter`, `random`, `patrol` y `coward`.
- Cazador más rápido (`0.125`) y con capacidad de invertir 180° en celdas alineadas.
- Alternancia global `scatter`/`chase` por contador de frames: 420 de dispersión y 1200 de persecución.
- En `scatter` cada fantasma se dirige a una esquina propia.
- Dos fantasmas empiezan dentro de la pen y dos fuera.
- `resetPositions` reposiciona los 4 sin reiniciar la fase ni el contador.

**Out of scope (para futuros specs):**

- Power pellets, modo asustado, fantasmas comestibles u ojos volviendo a la pen.
- Dificultad por nivel, velocidades por nivel o cambios de rol.
- Indicador de fase en el HUD.
- Sonidos.
- Cambios en la geometría del laberinto.

## Data model

```js
// maze.js
const GHOST_STARTS = [
  { x: 13, y: 14, kind: 'hunter', corner: { x: 26, y: 1 } },  // dentro de la pen
  { x: 14, y: 14, kind: 'random', corner: { x: 1,  y: 29 } }, // dentro de la pen
  { x: 1,  y: 5,  kind: 'patrol', corner: { x: 1,  y: 1 } },  // fuera
  { x: 26, y: 5,  kind: 'coward', corner: { x: 26, y: 29 } }, // fuera
];
const PATROL_RECT = { x1: 1, y1: 1, x2: 12, y2: 5 };
```

```js
// game.js
const HUNTER_SPEED = 0.125; // 1/8 celda/frame, igual que Pac-Man
const SCATTER_FRAMES = 420;
const CHASE_FRAMES = 1200;

// Añadidos al estado devuelto por createGame()
mode: 'scatter',   // 'scatter' | 'chase'
modeFrames: 0,
ghosts: [/* { x, y, dir, speed, kind, corner, patrolIndex } */],
```

Convenciones:

- Coordenadas: celda `(x,y)`, origen arriba-izquierda.
- Velocidades en celdas/frame.
- `corner` y `patrolIndex` son estado por fantasma.

## Implementation plan

1. `maze.js`: reemplazar `GHOST_STARTS` por los 4 inicios con `kind` y `corner`; añadir y exportar `PATROL_RECT`.
2. `game.js`: añadir `HUNTER_SPEED`, `SCATTER_FRAMES`, `CHASE_FRAMES`; en `createGame` asignar `speed` según `kind`, copiar `corner` e inicializar `patrolIndex: 0`, además de `mode` y `modeFrames`. (Los `kind` nuevos caen en la lógica aleatoria actual: el juego sigue funcionando.)
3. `game.js`: en `update`, avanzar `modeFrames` y alternar la fase al llegar a 420 / 1200 antes de mover actores.
4. `game.js`: reescribir `decideGhost` con ramas por fase y por `kind`:
   - `scatter`: objetivo = `ghost.corner` para todos.
   - `chase` + `hunter`: objetivo = celda de Pac-Man; puede elegir cualquier dirección válida, incluida la inversa.
   - `chase` + `random`: dirección válida al azar (sin invertir salvo callejón).
   - `chase` + `patrol`: objetivo = siguiente esquina de `PATROL_RECT`; al llegar, avanza `patrolIndex`.
   - `chase` + `coward`: si distancia Manhattan < 4, elige la dirección que más aleja; si no, dirección aleatoria.
5. `game.js`: verificar que `resetPositions` reposiciona los 4 y no toca `mode`/`modeFrames`.
6. Prueba manual en navegador: abrir `src/index.html` y observar los 4 roles y la alternancia.

## Acceptance criteria

- [ ] Se ven 4 fantasmas, cada uno con color distinto.
- [ ] El cazador se mueve a `0.125` y persigue a Pac-Man; puede invertir 180° en celdas alineadas.
- [ ] El aleatorio elige una dirección válida al azar en cada intersección (en persecución).
- [ ] El patrullero recorre en bucle el rectángulo `(1,1)-(12,1)-(12,5)-(1,5)`.
- [ ] El cobarde huye si la distancia Manhattan a Pac-Man es menor que 4; si no, deambula al azar.
- [ ] En dispersión los 4 se dirigen a su esquina asignada.
- [ ] La fase alterna cada 420 frames (dispersión) y 1200 frames (persecución).
- [ ] Perder una vida reposiciona a los actores pero no reinicia la fase ni el contador.
- [ ] El resto del juego (dots, puntaje, victoria/derrota, túnel, puerta) sigue funcionando.
- [ ] La consola no muestra errores.

## Decisions

- **Sí:** cuatro roles simples y distintos (confirmado), en lugar de los roles clásicos Blinky/Pinky/Inky/Clyde.
- **Sí:** temporizador por frames (420/1200) por coherencia con el modelo actual de movimiento por frame; asume ~60 FPS.
- **Sí:** cazador a `0.125` para mantener la alineación de cuadrícula (1/8 de celda).
- **Sí:** solo el cazador puede invertir 180°; el resto mantiene la regla actual salvo callejón sin salida.
- **Sí:** dispersión con una esquina propia por fantasma y sin reinicio de fase al perder una vida.
- **Sí:** rectángulo de patrulla en el bucle superior izquierdo, formado por pasillos abiertos.
- **Sí:** dos inicios dentro de la pen y dos fuera; los dots bajo los fantasmas permanecen hasta comerse.
- **No:** reiniciar a dispersión al morir.
- **No:** velocidades distintas más allá del cazador.
- **No:** targeting clásico de Pinky/Inky/Clyde.

## Risks

| Risk | Mitigation |
| --- | --- |
| El temporizador por frames depende de los FPS reales | Documentado; migrar a tiempo real en un spec futuro si molesta |
| Cobarde/aleatorio pueden oscilar en callejones | El fallback ya permite invertir sin salida |
| El patrullero podría desviarse si el objetivo queda bloqueado | El rectángulo se eligió sobre pasillos abiertos y transitables |
| El cazador puede oscilar al invertir | Se acepta como parte de su comportamiento agresivo |

## What is **not** in this spec

- Power pellets o modo asustado.
- Fantasmas comestibles u ojos regresando a la pen.
- Indicadores de fase en el HUD.
- Sonidos.
- Cambios de geometría del laberinto.
