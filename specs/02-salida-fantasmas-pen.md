# SPEC 02 — Salida de los fantasmas de la pen

> **Status:** Approved
> **Depends on:** SPEC 01
> **Date:** 2026-11-15
> **Objective:** Hacer que los dos fantasmas que empiezan dentro de la pen la abandonen por la puerta al empezar a moverse y tras cada reposición, sin poder volver a entrar.

## Scope

**In:**

- Marcar en `GHOST_STARTS` qué fantasmas empiezan dentro de la pen (`inPen: true`).
- Nuevo estado por fantasma `leaving` que fuerza la salida en línea recta por su columna (13 o 14) hasta la fila 11.
- La puerta de la pen deja de ser transitable para fantasmas fuera de la pen; solo lo es mientras `leaving` es `true`.
- `resetPositions` vuelve a activar `leaving` para los fantasmas que reinician dentro de la pen.

**Out of scope (para futuros specs):**

- Power pellets, modo asustado y fantasmas comestibles.
- Ojos de fantasma comido regresando a la pen.
- Retardos o temporizadores de liberación escalonados.
- Cambios de geometría del laberinto, del render o del HUD.
- Cambios en la IA, en la alternancia `scatter`/`chase` o en las velocidades.

## Data model

```js
// maze.js
const GHOST_STARTS = [
  { x: 13, y: 14, kind: 'hunter', corner: { x: 26, y: 1 }, inPen: true  },
  { x: 14, y: 14, kind: 'random', corner: { x: 1,  y: 29 }, inPen: true },
  { x: 1,  y: 5,  kind: 'patrol', corner: { x: 1,  y: 1 }, inPen: false },
  { x: 26, y: 5,  kind: 'coward', corner: { x: 26, y: 29 }, inPen: false },
];
const PEN_EXIT_ROW = 11; // fila de pasillo donde se considera que el fantasma ya salió
```

```js
// game.js — fantasma devuelto por createGame()
{
  x, y, dir, speed,
  kind,
  corner,          // { x, y }
  patrolIndex,     // number
  leaving,         // booleano nuevo: true mientras debe salir de la pen
}
```

Convenciones:

- `PEN_EXIT_ROW` se exporta igual que el resto de `maze.js` (`window.PEN_EXIT_ROW`).
- La pen es la zona interior `x: 11..16`, `y: 13..15`; no se añade ninguna constante de área porque no hace falta.
- `leaving` se inicializa desde `inPen` en `createGame` y se re-aplica en `resetPositions`.

## Implementation plan

1. `maze.js`: añadir `inPen` a los cuatro inicios y exportar `PEN_EXIT_ROW = 11`. El juego sigue funcionando igual (el flag aún no se usa).
2. `game.js`: en `createGame` añadir `leaving: !!g.inPen`; en `resetPositions` reasignar `g.leaving = !!GHOST_STARTS[ i ].inPen` junto con `x`, `y` y `dir`. Sin cambio de comportamiento todavía.
3. `game.js`: en `decideGhost`, si `g.leaving` es `true`: si `g.y === PEN_EXIT_ROW`, poner `leaving = false` y seguir con la IA normal en esa misma celda; si no, forzar `g.dir = 'up'` y salir. La puerta sigue siendo transitable para fantasmas en este paso, así que la salida funciona de inmediato. Prueba manual: abrir `src/index.html` y ver salir a los dos fantasmas en menos de un segundo.
4. `game.js`: extender la regla de la puerta. `canMove`/`isWall` aceptan el actor `'ghost-leaving'`, para el que la puerta (valor `3`) es transitable; `'ghost'` la trata como muro igual que `'pacman'`. Usar `'ghost-leaving'` en las comprobaciones de `moveGhost` mientras `g.leaving` es `true`. Prueba manual: los fantasmas no vuelven a entrar en la pen.
5. Prueba manual tras perder una vida: dejar que un fantasma alcance a Pac-Man y confirmar que los dos vuelven a salir de la pen.

## Acceptance criteria

- [ ] Al iniciar la partida, los fantasmas de las columnas 13 y 14 cruzan la puerta y salen a la fila 11 en menos de un segundo.
- [ ] Tras salir, los dos fantasmas usan su IA normal (`scatter`/`chase` por rol).
- [ ] Ningún fantasma vuelve a cruzar la puerta hacia el interior de la pen durante la partida.
- [ ] Tras perder una vida, los dos fantasmas de la pen vuelven a salir en menos de un segundo.
- [ ] Pac-Man sigue bloqueado por la puerta y no puede entrar en la pen.
- [ ] El contador de fase `scatter`/`chase` sigue alternando a 420 y 1200 frames sin reiniciarse al salir de la pen.
- [ ] Los fantasmas que empiezan fuera (`patrol`, `coward`) no cambian su comportamiento.
- [ ] Dots, puntaje, victoria/derrota y túnel siguen funcionando igual.
- [ ] La consola no muestra errores.

## Decisions

- **Sí:** estado `leaving` por fantasma con salida recta hacia arriba. Es explícito y no depende de heurísticas de distancia para atravesar la puerta.
- **Sí:** salida al inicio y tras cada pérdida de vida, porque `resetPositions` los devuelve a la pen.
- **Sí:** ambos salen a la vez, sin retardo: es el arreglo mínimo que resuelve el bug.
- **Sí:** la puerta solo es transitable con `leaving = true`; evita que la IA de dispersión/persecución los meta de nuevo y el bug reaparezca de forma intermitente.
- **Sí:** `inPen` explícito en `GHOST_STARTS` en lugar de deducir la pen por coordenadas; si mañana cambia la geometría, el flag sigue siendo correcto.
- **Sí:** colisiones normales durante la salida (sin invulnerabilidad): Pac-Man no puede entrar en la pen y el recorrido de salida queda lejos de su inicio.
- **No:** recolocar los dos inicios fuera de la pen. Se pierde la decisión del SPEC 01 de que dos empiecen dentro.
- **No:** retardos de liberación escalonados. Añaden estado y no forman parte del bug.
- **No:** tocar `render.js`, `main.js` o `index.html`. No hace falta.

## Risks

| Risk | Mitigation |
| --- | --- |
| El fallback de callejón de `decideGhost` no valida `canMove` | Con la geometría actual siempre hay una dirección opuesta válida; la puerta no deja fantasmas acorralados |
| Bloquear la puerta para fantasmas fuera impide futuros regresos de ojos a la pen | Anotado: ese comportamiento va en su propio spec y reabrirá esta regla |
| `leaving` depende de que `moveGhost` redondee la celda antes de decidir | Se usa la misma comprobación `aligned()` + `Math.round` que ya existe; sin tolerancias nuevas |

## What is **not** in this spec

- Power pellets o modo asustado.
- Ojos regresando a la pen.
- Retardos de liberación.
- Cambios de IA, velocidades o temporizador de fase.
- Cambios visuales o de HUD.
