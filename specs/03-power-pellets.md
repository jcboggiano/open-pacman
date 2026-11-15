# SPEC 03 — Power pellets y modo asustado

> **Status:** Implemented
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-11-15
> **Objective:** Añadir cuatro power pellets que, al comerse, activan 360 frames de modo asustado en el que los fantasmas huyen a media velocidad y pueden comerse por puntos escalados.

## Scope

**In:**

- Cuatro power pellets en `(1,3)`, `(26,3)`, `(1,23)` y `(26,23)`, reemplazando el dot de esas celdas.
- Nuevo tile `4` (`'o'` en `MAZE_STR`) que se cuenta en `dotsRemaining` y se come como los dots.
- Comer una pellet suma 50 puntos y activa o reinicia el asustado (360 frames) y la escala de puntos.
- Durante el asustado: los fantasmas no comidos huyen de Pac-Man, van a `0.05` celdas/frame e invierten 180° al activarse.
- Comer un fantasma asustado suma 200/400/800/1600 dentro del mismo efecto; el fantasma desaparece 60 frames y reaparece en la pen como normal, saliendo con `leaving`.
- Render: pellets grandes; fantasmas azules con parpadeo azul/blanco en los últimos 120 frames; fantasmas comidos no se dibujan.
- Perder una vida cancela el asustado, restaura los fantasmas comidos en la pen y conserva las pellets ya comidas.
- `resetPositions` no revive pellets ni reinicia el contador `scatter`/`chase`.

**Out of scope (para futuros specs):**

- Ojos de fantasma comido recorriendo el laberinto hasta la pen.
- Sonidos.
- Cambios en la IA normal, velocidades base, temporizador `scatter`/`chase` o geometría.
- Indicadores de efecto en el HUD, pausas o power-ups adicionales.
- Persistencia entre sesiones.

## Data model

```js
// maze.js
// MAZE_STR: 'o' en (1,3), (26,3), (1,23) y (26,23); parseTile('o') => 4
const POWER = 4;
window.POWER = POWER;
```

```js
// game.js
const POWER_PELLET_POINTS = 50;
const FRIGHTENED_FRAMES = 360;
const FRIGHTENED_SPEED = 0.05;       // 1/20 celda/frame, alineado con la rejilla
const FRIGHTENED_FLASH_FRAMES = 120;
const GHOST_RESPAWN_FRAMES = 60;
const FRIGHTENED_BASE_POINTS = 200;  // 200 * 2^n
const PEN_RESPAWN_X = [ 13, 14 ];    // indice par / impar

// Añadidos al estado devuelto por createGame()
{
  frightenedFrames: 0,   // > 0 mientras el efecto esta activo
  frightenedEaten: 0,    // fantasmas comidos en el efecto actual
  ghosts: [/* { ..., frightened: false, respawnFrames: 0 } */],
}
```

Convenciones:

- `frightenedFrames > 0` indica efecto activo; al llegar a 0 se apaga `frightened` en todos los fantasmas.
- `frightened` es por fantasma porque uno que reaparece vuelve normal aunque queden frames.
- `respawnFrames > 0` significa comido: invisible, no colisiona, no se mueve.
- `speed` sigue siendo la velocidad base del rol; `moveGhost` usa `0.05` mientras `frightened`.
- La reaparición usa `(13,14)` para índices pares y `(14,14)` para impares, con `leaving: true`.
- El tile `4` cuenta como dot para `dotsRemaining` y la victoria; al comerse pasa a `0`.

## Implementation plan

1. `maze.js`: en `parseTile`, `'o'` → `4`; reemplazar los cuatro dots por `'o'` en `MAZE_STR`; añadir y exportar `POWER`. El juego sigue arrancando aunque las pellets aún no se dibujen.
2. `render.js`: `drawDots` dibuja el tile `4` con radio mayor (`6`) y el tile `2` como ahora. Prueba manual: se ven cuatro pellets grandes.
3. `game.js`: en `createGame`, contar también el tile `4` en `dotsRemaining`; en `movePacman`, comer tile `4` sumando `POWER_PELLET_POINTS`, decrementando `dotsRemaining` y poniendo la celda a `0`. Prueba manual: comer pellet suma 50 y desaparece.
4. `game.js`: añadir `frightenedFrames`, `frightenedEaten` y `frightened` en `createGame`; `startFrightened( game )` activa 360 frames, reinicia la escala e invierte la dirección de los fantasmas no comidos que no estén saliendo; `advanceFrightened( game )` descuenta frames y apaga el efecto. En `decideGhost`, rama asustada con `chooseAway`; en `moveGhost`, velocidad `0.05` si `frightened`. La puerta sigue bloqueada para ellos. Prueba manual: al comer la pellet los fantasmas huyen más lentos.
5. `render.js`: pintar de azul (`#2121ff`) los fantasmas con `frightened` y alternar con blanco cuando `frightenedFrames <= 120`; saltar los que tienen `respawnFrames > 0`. Prueba manual: azul, parpadeo final y desaparición.
6. `game.js`: en `update`, si Pac-Man colisiona con un fantasma asustado, sumar `200 * 2^frightenedEaten`, subir el contador, poner `frightened = false` y `respawnFrames = 60`; si `respawnFrames > 0`, descontar y, al llegar a 0, restaurar el fantasma en su celda de pen con `leaving: true`, `dir: 'up'` y estado normal. Prueba manual: comer fantasmas da 200/400/800/1600 y reaparecen.
7. `game.js`: en `resetPositions`, limpiar `frightenedFrames`, `frightenedEaten`, `frightened` y `respawnFrames` de todos los fantasmas antes de reposicionarlos. Prueba manual: perder una vida cancela el azul, restaura los comidos y no revive pellets.

## Acceptance criteria

- [ ] Al cargar se ven cuatro power pellets grandes en las esquinas clásicas.
- [ ] Comer una pellet suma 50 puntos y la hace desaparecer.
- [ ] Comer una pellet activa 360 frames de asustado: fantasmas azules, huyendo de Pac-Man y a `0.05`.
- [ ] Los fantasmas no comidos invierten 180° al activarse el efecto.
- [ ] En los últimos 120 frames del efecto parpadean azul/blanco.
- [ ] Comer fantasmas en un mismo efecto da 200, 400, 800 y 1600 puntos.
- [ ] Un fantasma comido desaparece 60 frames y reaparece en la pen, normal y saliendo con `leaving`.
- [ ] Tocar un fantasma asustado no quita vida; tocar uno normal sí.
- [ ] Comer otra pellet con el efecto activo vuelve a 360 frames y reinicia la escala.
- [ ] Al agotarse los 360 frames, los fantasmas recuperan su IA y velocidad de rol.
- [ ] Perder una vida cancela el asustado, restaura los comidos y conserva las pellets comidas.
- [ ] `dotsRemaining` incluye las pellets; la victoria exige comerlas.
- [ ] El temporizador `scatter`/`chase` sigue avanzando durante el asustado.
- [ ] Pac-Man sigue bloqueado por la puerta; los fantasmas normales tampoco entran.
- [ ] Dots, túnel, derrota y HUD siguen funcionando; la consola no muestra errores.

## Decisions

- **Sí:** cuatro pellets en las esquinas clásicas `(1,3)`, `(26,3)`, `(1,23)`, `(26,23)`.
- **Sí:** tile `4` en la grid en lugar de una lista aparte; reutiliza copia, conteo y victoria existentes.
- **Sí:** 50 puntos por pellet.
- **Sí:** 360 frames de asustado, coherente con el modelo por frames.
- **Sí:** huir de Pac-Man con `chooseAway` en lugar de dirección aleatoria.
- **Sí:** inversión de 180° al activarse, para feedback inmediato.
- **Sí:** velocidad `0.05` (1/20 de celda) para no romper la alineación de rejilla.
- **Sí:** escala clásica 200/400/800/1600 reiniciada con cada pellet.
- **Sí:** una segunda pellet reinicia el temporizador y la escala.
- **Sí:** el fantasma comido queda invisible 60 frames y vuelve a la pen.
- **Sí:** reaparece normal aunque queden frames de asustado.
- **Sí:** azul con parpadeo en los últimos 120 frames.
- **Sí:** perder vida cancela el efecto y restaura a los comidos.
- **Sí:** el temporizador `scatter`/`chase` sigue corriendo en paralelo.
- **Sí:** celdas de reaparición `(13,14)`/`(14,14)` por paridad de índice, sin ampliar `GHOST_STARTS`.
- **Sí:** las pellets cuentan para la victoria.
- **No:** ojos volviendo a la pen, sonidos, indicador en HUD, pausar la fase, pellets opcionales, campo de reaparición por fantasma.

## Risks

| Risk | Mitigation |
| --- | --- |
| Un fantasma comido mientras sale de la pen (`leaving`) | Se le aplica `respawnFrames` y al volver se reinicia `leaving`; no hay estado inconsistente |
| Reaparición con índice equivocado | La reaparición se resuelve en el bucle de `update` con el índice para elegir `PEN_RESPAWN_X` |
| Velocidad `0.05` y alineación de rejilla | Es `1/20`, múltiplo exacto de la celda; se usa la misma comprobación `aligned()` |
| Parpadeo dependiente de FPS | Se calcula con frames restantes del efecto, como el resto de temporizadores |
| Dos fantasmas reapareciendo en la misma celda | Se separan por paridad `(13,14)`/`(14,14)` |

## What is **not** in this spec

- Ojos regresando a la pen.
- Sonidos o cambios de HUD.
- Cambios de IA normal, velocidades base, temporizador de fase o geometría.
- Power-ups adicionales o pausa.
- Persistencia.
