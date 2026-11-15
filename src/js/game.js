// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS, PATROL_RECT.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };
const PATROL_CORNERS = [
  { x: PATROL_RECT.x1, y: PATROL_RECT.y1 },
  { x: PATROL_RECT.x2, y: PATROL_RECT.y1 },
  { x: PATROL_RECT.x2, y: PATROL_RECT.y2 },
  { x: PATROL_RECT.x1, y: PATROL_RECT.y2 },
];

const PACMAN_SPEED = 0.125;  // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;     // 1/10 celda/frame
const HUNTER_SPEED = 0.125;  // 1/8 celda/frame, igual que Pac-Man
const SCATTER_FRAMES = 420;
const CHASE_FRAMES = 1200;
const POWER_PELLET_POINTS = 50;
const FRIGHTENED_FRAMES = 360;
const FRIGHTENED_SPEED = 0.05;  // 1/20 celda/frame, alineado con la rejilla
const FRIGHTENED_FLASH_FRAMES = 120;
const GHOST_RESPAWN_FRAMES = 60;
const FRIGHTENED_BASE_POINTS = 200;  // 200 * 2^n
const PEN_RESPAWN_X = [ 13, 14 ];    // indice par / impar

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 || v === 4 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: g.kind === 'hunter' ? HUNTER_SPEED : GHOST_SPEED,
      kind: g.kind,
      corner: { x: g.corner.x, y: g.corner.y },
      patrolIndex: 0,
      leaving: !!g.inPen,
      frightened: false,
      respawnFrames: 0,
    } ) ),
    mode: 'scatter',
    modeFrames: 0,
    frightenedFrames: 0,
    frightenedEaten: 0,
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman:        bloqueado por pared (1) y puerta (3)
//   ghost:         bloqueado por pared (1) y puerta (3)
//   ghost-leaving: bloqueado solo por pared (1); la puerta es transitable
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && actor !== 'ghost-leaving' ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    }
    // Comer power pellet.
    if ( grid[ p.y ][ p.x ] === 4 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += POWER_PELLET_POINTS;
      game.dotsRemaining--;
      startFrightened( game );
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Elige la direccion cuyo vecino queda mas cerca de target (Manhattan).
function chooseToward( choices, x, y, target ) {
  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const dist = Math.abs( x + d.x - target.x ) + Math.abs( y + d.y - target.y );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  return best;
}

// Elige la direccion cuyo vecino queda mas lejos de target (Manhattan).
function chooseAway( choices, x, y, target ) {
  let best = choices[ 0 ];
  let bestDist = -Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const dist = Math.abs( x + d.x - target.x ) + Math.abs( y + d.y - target.y );
    if ( dist > bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  return best;
}

function decideGhost( game, g ) {
  const grid = game.grid;
  const p = game.pacman;
  const px = Math.round( p.x );
  const py = Math.round( p.y );

  // Salida de la pen: subir en linea recta hasta el pasillo de la fila 11.
  if ( g.leaving ) {
    if ( g.y === PEN_EXIT_ROW ) {
      g.leaving = false;
    } else {
      g.dir = 'up';
      return;
    }
  }

  // El cazador puede invertir siempre; el resto solo en callejon sin salida.
  let choices = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, 'ghost' )
  );
  if ( g.kind === 'hunter' || choices.length === 0 ) {
    choices = Object.keys( DIRS ).filter(
      ( dir ) => canMove( grid, g.x, g.y, dir, 'ghost' )
    );
  }
  if ( choices.length === 0 ) choices = [ OPPOSITE[ g.dir ] ];

  // Asustado: huir de Pac-Man en lugar de perseguir o patrullar.
  if ( g.frightened ) {
    g.dir = chooseAway( choices, g.x, g.y, { x: px, y: py } );
    return;
  }

  if ( game.mode === 'scatter' ) {
    g.dir = chooseToward( choices, g.x, g.y, g.corner );
    return;
  }

  // Persecucion: comportamiento distinto por rol.
  if ( g.kind === 'hunter' ) {
    g.dir = chooseToward( choices, g.x, g.y, { x: px, y: py } );
  } else if ( g.kind === 'patrol' ) {
    let target = PATROL_CORNERS[ g.patrolIndex ];
    if ( g.x === target.x && g.y === target.y ) {
      g.patrolIndex = ( g.patrolIndex + 1 ) % PATROL_CORNERS.length;
      target = PATROL_CORNERS[ g.patrolIndex ];
    }
    g.dir = chooseToward( choices, g.x, g.y, target );
  } else if ( g.kind === 'coward' ) {
    const dist = Math.abs( g.x - px ) + Math.abs( g.y - py );
    if ( dist < 4 ) {
      g.dir = chooseAway( choices, g.x, g.y, { x: px, y: py } );
    } else {
      g.dir = choices[ Math.floor( Math.random() * choices.length ) ];
    }
  } else {
    g.dir = choices[ Math.floor( Math.random() * choices.length ) ];
  }
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( g.respawnFrames > 0 ) return; // comido: invisible, no colisiona, no se mueve

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    decideGhost( game, g );
    const actor = g.leaving ? 'ghost-leaving' : 'ghost';
    if ( !canMove( grid, g.x, g.y, g.dir, actor ) ) return;
  }

  const d = DIRS[ g.dir ];
  const speed = g.frightened ? FRIGHTENED_SPEED : g.speed;
  g.x += d.x * speed;
  g.y += d.y * speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
    g.leaving = !!GHOST_STARTS[ i ].inPen;
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function advanceMode( game ) {
  game.modeFrames++;
  if ( game.mode === 'scatter' && game.modeFrames >= SCATTER_FRAMES ) {
    game.mode = 'chase';
    game.modeFrames = 0;
  } else if ( game.mode === 'chase' && game.modeFrames >= CHASE_FRAMES ) {
    game.mode = 'scatter';
    game.modeFrames = 0;
  }
}

// Activa o reinicia el modo asustado: 360 frames y escala de puntos a cero.
// Los fantasmas comidos (invisibles) no participan; el resto se vuelve asustado
// y los que no estan saliendo de la pen invierten su direccion.
function startFrightened( game ) {
  game.frightenedFrames = FRIGHTENED_FRAMES;
  game.frightenedEaten = 0;
  for ( const g of game.ghosts ) {
    if ( g.respawnFrames > 0 ) continue;
    g.frightened = true;
    if ( !g.leaving ) g.dir = OPPOSITE[ g.dir ];
  }
}

// Descuenta un frame del efecto y lo apaga al agotarse.
function advanceFrightened( game ) {
  if ( game.frightenedFrames <= 0 ) return;
  game.frightenedFrames--;
  if ( game.frightenedFrames <= 0 ) {
    for ( const g of game.ghosts ) g.frightened = false;
  }
}

function update( game ) {
  advanceMode( game );
  advanceFrightened( game );
  movePacman( game );
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  // Cuenta atras de los fantasmas comidos y reaparicion en la pen.
  game.ghosts.forEach( ( g, i ) => {
    if ( g.respawnFrames <= 0 ) return;
    g.respawnFrames--;
    if ( g.respawnFrames <= 0 ) {
      g.x = PEN_RESPAWN_X[ i % 2 ];
      g.y = 14;
      g.dir = 'up';
      g.leaving = true;
      g.frightened = false;
    }
  } );

  for ( const g of game.ghosts ) {
    if ( g.respawnFrames > 0 ) continue; // invisible: no colisiona
    if ( !collides( game.pacman, g ) ) continue;

    // Fantasma asustado: se come con puntos escalados dentro del efecto.
    if ( g.frightened ) {
      game.score += FRIGHTENED_BASE_POINTS * Math.pow( 2, game.frightenedEaten );
      game.frightenedEaten++;
      g.frightened = false;
      g.respawnFrames = GHOST_RESPAWN_FRAMES;
      continue;
    }

    // Fantasma normal: perder vida.
    game.lives--;
    if ( game.lives <= 0 ) {
      game.state = 'lost';
      return;
    }
    resetPositions( game );
    break;
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
window.FRIGHTENED_FLASH_FRAMES = FRIGHTENED_FLASH_FRAMES;
