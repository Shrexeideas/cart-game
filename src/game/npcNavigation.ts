import type { ObstacleSpec, Vec2 } from './types';
import { WORLD_MAX_X, WORLD_MAX_Z, WORLD_MIN_X, WORLD_MIN_Z } from './worldLayout';

export interface NavGrid {
  cols: number;
  rows: number;
  cellSize: number;
  minX: number;
  minZ: number;
  blocked: Uint8Array;
}

export interface GridPathResult {
  found: boolean;
  blocked: boolean;
  waypoints: Vec2[];
}

export interface DynamicCircleObstacle {
  x: number;
  z: number;
  radius: number;
}

function pointToObbDistance(
  px: number,
  pz: number,
  ox: number,
  oz: number,
  yaw: number,
  halfW: number,
  halfL: number
): { dx: number; dz: number; dist: number; inside: boolean } {
  const relX = px - ox;
  const relZ = pz - oz;
  const sinY = Math.sin(yaw);
  const cosY = Math.cos(yaw);

  // Transform world delta into obstacle-local space
  const lx = relX * cosY - relZ * sinY;
  const lz = relX * sinY + relZ * cosY;

  const clampedX = Math.max(-halfW, Math.min(halfW, lx));
  const clampedZ = Math.max(-halfL, Math.min(halfL, lz));

  let localDx = lx - clampedX;
  let localDz = lz - clampedZ;
  const inside = Math.abs(lx) < halfW && Math.abs(lz) < halfL;

  if (inside) {
    const penX = halfW - Math.abs(lx);
    const penZ = halfL - Math.abs(lz);
    if (penX < penZ) {
      localDx = lx >= 0 ? penX : -penX;
      localDz = 0;
    } else {
      localDx = 0;
      localDz = lz >= 0 ? penZ : -penZ;
    }
  }

  // Rotate push vector back to world space
  const wx = localDx * cosY + localDz * sinY;
  const wz = -localDx * sinY + localDz * cosY;
  return { dx: wx, dz: wz, dist: Math.hypot(wx, wz), inside };
}

/**
 * Checks whether a circle overlaps an obstacle's physical shape (supports open-front U-shaped corrals).
 */
export function resolveSingleObstaclePush(
  px: number,
  pz: number,
  radius: number,
  obs: ObstacleSpec
): { pushX: number; pushZ: number; hit: boolean } {
  // For cart corrals, model left wall, right wall, and back rail so characters don't treat open front as solid block
  if (obs.kind === 'corral') {
    const sinY = Math.sin(obs.yaw);
    const cosY = Math.cos(obs.yaw);
    const sideOffset = Math.max(0.5, obs.width / 2 - 0.08);
    const backOffset = -Math.max(0.5, obs.length / 2 - 0.12);
    const subParts = [
      { lx: -sideOffset, lz: 0, hw: 0.1, hl: obs.length / 2 },
      { lx: sideOffset, lz: 0, hw: 0.1, hl: obs.length / 2 },
      { lx: 0, lz: backOffset, hw: obs.width / 2, hl: 0.1 },
    ];
    let totalX = 0;
    let totalZ = 0;
    let hit = false;
    for (const part of subParts) {
      const partWorldX = obs.x + part.lx * cosY + part.lz * sinY;
      const partWorldZ = obs.z - part.lx * sinY + part.lz * cosY;
      const res = pointToObbDistance(
        px + totalX,
        pz + totalZ,
        partWorldX,
        partWorldZ,
        obs.yaw,
        part.hw,
        part.hl
      );
      if (res.inside) {
        const len = res.dist || 1;
        totalX += res.dx + (res.dx / len) * radius;
        totalZ += res.dz + (res.dz / len) * radius;
        hit = true;
      } else if (res.dist < radius) {
        const push = radius - res.dist;
        const len = res.dist || 1;
        totalX += (res.dx / len) * push;
        totalZ += (res.dz / len) * push;
        hit = true;
      }
    }
    return { pushX: totalX, pushZ: totalZ, hit };
  }

  // Low curbs / wheel stops can be stepped over by pedestrians/owner in emergencies,
  // but we still treat all cars, carts, islands, loading docks, benches, bins, signs, bollards, barriers as solid
  const res = pointToObbDistance(
    px,
    pz,
    obs.x,
    obs.z,
    obs.yaw,
    obs.width / 2,
    obs.length / 2
  );
  if (res.inside) {
    const len = res.dist || 1;
    return {
      pushX: res.dx + (res.dx / len) * radius,
      pushZ: res.dz + (res.dz / len) * radius,
      hit: true,
    };
  }
  if (res.dist < radius) {
    const push = radius - res.dist;
    const len = res.dist || 1;
    return {
      pushX: (res.dx / len) * push,
      pushZ: (res.dz / len) * push,
      hit: true,
    };
  }
  return { pushX: 0, pushZ: 0, hit: false };
}

/**
 * Builds a 2D navigation grid covering the expanded 68m x 44m parking facility.
 * Inflates obstacles by `agentRadius` so A* paths keep full physical clearance.
 */
export function buildNavGrid(
  obstacles: ObstacleSpec[],
  agentRadius = 0.42,
  cellSize = 0.65,
  allowSidewalk = true
): NavGrid {
  const minX = WORLD_MIN_X;
  const minZ = WORLD_MIN_Z;
  const cols = Math.ceil((WORLD_MAX_X - WORLD_MIN_X) / cellSize);
  const rows = Math.ceil((WORLD_MAX_Z - WORLD_MIN_Z) / cellSize);
  const blocked = new Uint8Array(cols * rows);

  // Filter obstacles that actually block movement (curbs/wheel_stops are low 0.14m curbs for NPCs unless driving a cart)
  const blockingObs = allowSidewalk
    ? obstacles.filter((o) => o.kind !== 'curb' && o.kind !== 'wheel_stop')
    : obstacles;

  for (let r = 0; r < rows; r++) {
    const wz = minZ + (r + 0.5) * cellSize;
    for (let c = 0; c < cols; c++) {
      const wx = minX + (c + 0.5) * cellSize;
      const idx = r * cols + c;

      // Perimeter & building boundaries
      if (
        wx < WORLD_MIN_X + 0.8 ||
        wx > WORLD_MAX_X - 0.8 ||
        wz > WORLD_MAX_Z - 0.8 ||
        wz < (allowSidewalk ? -9.35 : -4.0)
      ) {
        blocked[idx] = 1;
        continue;
      }

      // Check solid obstacles (including sidewalk booths/planters)
      if (allowSidewalk) {
        // Sidewalk booth near (-14.2, -7.8) & planters at (-17.5, -13.5, 13.5, 17.5, z=-5.8)
        if (Math.abs(wx + 14.2) < 1.55 && Math.abs(wz + 7.8) < 1.45) {
          blocked[idx] = 1;
          continue;
        }
        if (
          Math.abs(wz + 5.8) < 1.15 &&
          (Math.abs(wx + 17.5) < 1.15 ||
            Math.abs(wx + 13.5) < 1.15 ||
            Math.abs(wx - 13.5) < 1.15 ||
            Math.abs(wx - 17.5) < 1.15)
        ) {
          blocked[idx] = 1;
          continue;
        }
      }

      for (let i = 0; i < blockingObs.length; i++) {
        const res = resolveSingleObstaclePush(wx, wz, agentRadius, blockingObs[i]);
        if (res.hit) {
          blocked[idx] = 1;
          break;
        }
      }
    }
  }

  return { cols, rows, cellSize, minX, minZ, blocked };
}

function worldToCell(grid: NavGrid, x: number, z: number): { c: number; r: number } {
  const c = Math.max(0, Math.min(grid.cols - 1, Math.floor((x - grid.minX) / grid.cellSize)));
  const r = Math.max(0, Math.min(grid.rows - 1, Math.floor((z - grid.minZ) / grid.cellSize)));
  return { c, r };
}

function cellToWorld(grid: NavGrid, c: number, r: number): Vec2 {
  return {
    x: grid.minX + (c + 0.5) * grid.cellSize,
    z: grid.minZ + (r + 0.5) * grid.cellSize,
  };
}

function findNearestWalkable(
  grid: NavGrid,
  c0: number,
  r0: number,
  maxRadius = 6
): { c: number; r: number } | null {
  if (!grid.blocked[r0 * grid.cols + c0]) return { c: c0, r: r0 };
  let bestDistSq = Infinity;
  let best: { c: number; r: number } | null = null;
  for (let rad = 1; rad <= maxRadius; rad++) {
    for (let dr = -rad; dr <= rad; dr++) {
      for (let dc = -rad; dc <= rad; dc++) {
        const nr = r0 + dr;
        const nc = c0 + dc;
        if (nr < 0 || nr >= grid.rows || nc < 0 || nc >= grid.cols) continue;
        if (!grid.blocked[nr * grid.cols + nc]) {
          const d2 = dr * dr + dc * dc;
          if (d2 < bestDistSq) {
            bestDistSq = d2;
            best = { c: nc, r: nr };
          }
        }
      }
    }
    if (best) return best;
  }
  return null;
}

export function isLineWalkable(
  grid: NavGrid,
  x0: number,
  z0: number,
  x1: number,
  z1: number
): boolean {
  const dist = Math.hypot(x1 - x0, z1 - z0);
  const steps = Math.max(2, Math.ceil(dist / (grid.cellSize * 0.45)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const wx = x0 + (x1 - x0) * t;
    const wz = z0 + (z1 - z0) * t;
    const { c, r } = worldToCell(grid, wx, wz);
    if (grid.blocked[r * grid.cols + c]) return false;
  }
  return true;
}

/**
 * 8-connected A* pathfinder with corner-cutting prevention and string-pulling smoothing.
 */
export function findGridPath(
  grid: NavGrid,
  startX: number,
  startZ: number,
  goalX: number,
  goalZ: number
): GridPathResult {
  const sRaw = worldToCell(grid, startX, startZ);
  const gRaw = worldToCell(grid, goalX, goalZ);
  const start = findNearestWalkable(grid, sRaw.c, sRaw.r, 5);
  const goal = findNearestWalkable(grid, gRaw.c, gRaw.r, 6);

  if (!start || !goal) {
    return { found: false, blocked: true, waypoints: [] };
  }

  if (start.c === goal.c && start.r === goal.r) {
    return { found: true, blocked: false, waypoints: [{ x: goalX, z: goalZ }] };
  }

  // Fast direct line-of-sight shortcut
  if (isLineWalkable(grid, startX, startZ, goalX, goalZ)) {
    return { found: true, blocked: false, waypoints: [{ x: goalX, z: goalZ }] };
  }

  const total = grid.cols * grid.rows;
  const gScore = new Float32Array(total).fill(Infinity);
  const fScore = new Float32Array(total).fill(Infinity);
  const cameFrom = new Int32Array(total).fill(-1);
  const closed = new Uint8Array(total);
  const inOpen = new Uint8Array(total);

  const startIdx = start.r * grid.cols + start.c;
  const goalIdx = goal.r * grid.cols + goal.c;

  const heuristic = (c: number, r: number) => {
    const dx = Math.abs(c - goal.c);
    const dz = Math.abs(r - goal.r);
    return Math.max(dx, dz) + 0.41421356 * Math.min(dx, dz);
  };

  gScore[startIdx] = 0;
  fScore[startIdx] = heuristic(start.c, start.r);

  // Simple binary min-heap on open indices
  const heap: number[] = [startIdx];
  inOpen[startIdx] = 1;

  const swap = (i: number, j: number) => {
    const tmp = heap[i];
    heap[i] = heap[j];
    heap[j] = tmp;
  };
  const push = (idx: number) => {
    heap.push(idx);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (fScore[heap[i]] < fScore[heap[p]]) {
        swap(i, p);
        i = p;
      } else break;
    }
  };
  const pop = (): number => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      while (true) {
        const l = i * 2 + 1;
        const r = i * 2 + 2;
        let smallest = i;
        if (l < heap.length && fScore[heap[l]] < fScore[heap[smallest]]) smallest = l;
        if (r < heap.length && fScore[heap[r]] < fScore[heap[smallest]]) smallest = r;
        if (smallest !== i) {
          swap(i, smallest);
          i = smallest;
        } else break;
      }
    }
    return top;
  };

  const DIRS = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, 1.41421356],
    [1, -1, 1.41421356],
    [-1, 1, 1.41421356],
    [-1, -1, 1.41421356],
  ] as const;

  let iterations = 0;
  let reachedGoal = false;

  while (heap.length > 0 && iterations < 5500) {
    iterations++;
    const current = pop();
    inOpen[current] = 0;

    if (current === goalIdx) {
      reachedGoal = true;
      break;
    }

    closed[current] = 1;
    const cr = Math.floor(current / grid.cols);
    const cc = current % grid.cols;

    for (const [dc, dr, cost] of DIRS) {
      const nc = cc + dc;
      const nr = cr + dr;
      if (nc < 0 || nc >= grid.cols || nr < 0 || nr >= grid.rows) continue;
      const nIdx = nr * grid.cols + nc;
      if (closed[nIdx] || grid.blocked[nIdx]) continue;

      // Prevent diagonal corner clipping
      if (dc !== 0 && dr !== 0) {
        if (grid.blocked[cr * grid.cols + nc] || grid.blocked[nr * grid.cols + cc]) {
          continue;
        }
      }

      const tentativeG = gScore[current] + cost;
      if (tentativeG < gScore[nIdx]) {
        cameFrom[nIdx] = current;
        gScore[nIdx] = tentativeG;
        fScore[nIdx] = tentativeG + heuristic(nc, nr);
        if (!inOpen[nIdx]) {
          inOpen[nIdx] = 1;
          push(nIdx);
        }
      }
    }
  }

  if (!reachedGoal) {
    return { found: false, blocked: true, waypoints: [] };
  }

  // Reconstruct raw path
  const rawPoints: Vec2[] = [];
  let cur = goalIdx;
  while (cur !== -1 && cur !== startIdx) {
    const r = Math.floor(cur / grid.cols);
    const c = cur % grid.cols;
    rawPoints.push(cellToWorld(grid, c, r));
    cur = cameFrom[cur];
  }
  rawPoints.reverse();

  // Replace final point with exact goal if walkable
  if (rawPoints.length > 0 && !grid.blocked[gRaw.r * grid.cols + gRaw.c]) {
    rawPoints[rawPoints.length - 1] = { x: goalX, z: goalZ };
  }

  // String-pull smoothing: greedily skip intermediate waypoints when line-of-sight is clear
  if (rawPoints.length <= 2) {
    return { found: true, blocked: false, waypoints: rawPoints };
  }

  const smoothed: Vec2[] = [];
  let anchorX = startX;
  let anchorZ = startZ;
  let i = 0;
  while (i < rawPoints.length) {
    let furthest = i;
    for (let j = rawPoints.length - 1; j > i; j--) {
      if (isLineWalkable(grid, anchorX, anchorZ, rawPoints[j].x, rawPoints[j].z)) {
        furthest = j;
        break;
      }
    }
    smoothed.push(rawPoints[furthest]);
    anchorX = rawPoints[furthest].x;
    anchorZ = rawPoints[furthest].z;
    i = furthest + 1;
  }

  return { found: true, blocked: false, waypoints: smoothed };
}

/**
 * Local dynamic avoidance steering force around nearby carts, pedestrians, and vehicles.
 */
export function computeLocalAvoidance(
  x: number,
  z: number,
  dirX: number,
  dirZ: number,
  dynamicCircles: DynamicCircleObstacle[],
  avoidRadius = 1.45
): Vec2 {
  let steerX = 0;
  let steerZ = 0;

  for (let i = 0; i < dynamicCircles.length; i++) {
    const c = dynamicCircles[i];
    const dx = x - c.x;
    const dz = z - c.z;
    const dist = Math.hypot(dx, dz);
    const threshold = avoidRadius + c.radius;
    if (dist > 0.001 && dist < threshold) {
      const strength = (threshold - dist) / threshold;
      // Radial push + slight perpendicular tangent so NPCs sidestep cleanly instead of deadlocking head-on
      const nx = dx / dist;
      const nz = dz / dist;
      const cross = dirX * nz - dirZ * nx;
      const tangSign = cross >= 0 ? 1 : -1;
      steerX += (nx * 1.15 - nz * 0.65 * tangSign) * strength;
      steerZ += (nz * 1.15 + nx * 0.65 * tangSign) * strength;
    }
  }

  return { x: steerX, z: steerZ };
}

/**
 * Hard physical collision resolution keeping NPC capsules outside all static obstacles,
 * dynamic carts/vehicles, storefront walls, and lot perimeter boundaries.
 */
export function resolveCircleObstacles(
  x: number,
  z: number,
  radius: number,
  obstacles: ObstacleSpec[],
  dynamicCircles: DynamicCircleObstacle[] = [],
  allowSidewalk = true
): { x: number; z: number; collided: boolean } {
  let px = x;
  let pz = z;
  let collided = false;

  // Iterative projection (2 passes cleanly resolves corners)
  for (let pass = 0; pass < 2; pass++) {
    // Perimeter & storefront wall
    const minZ = allowSidewalk ? -9.4 + radius : -4.0 + radius;
    if (px < WORLD_MIN_X + 0.6 + radius) {
      px = WORLD_MIN_X + 0.6 + radius;
      collided = true;
    }
    if (px > WORLD_MAX_X - 0.6 - radius) {
      px = WORLD_MAX_X - 0.6 - radius;
      collided = true;
    }
    if (pz < minZ) {
      pz = minZ;
      collided = true;
    }
    if (pz > WORLD_MAX_Z - 0.6 - radius) {
      pz = WORLD_MAX_Z - 0.6 - radius;
      collided = true;
    }

    // Sidewalk planters & booth
    if (allowSidewalk) {
      const boothPush = pointToObbDistance(px, pz, -14.2, -7.8, 0, 1.15, 1.05);
      if (boothPush.inside || boothPush.dist < radius) {
        const push = boothPush.inside ? radius + boothPush.dist : radius - boothPush.dist;
        const len = boothPush.dist || 1;
        px += (boothPush.dx / len) * push;
        pz += (boothPush.dz / len) * push;
        collided = true;
      }
      for (const tx of [-17.5, -13.5, 13.5, 17.5]) {
        const pPush = pointToObbDistance(px, pz, tx, -5.8, 0, 0.9, 0.9);
        if (pPush.inside || pPush.dist < radius) {
          const push = pPush.inside ? radius + pPush.dist : radius - pPush.dist;
          const len = pPush.dist || 1;
          px += (pPush.dx / len) * push;
          pz += (pPush.dz / len) * push;
          collided = true;
        }
      }
    }

    for (let i = 0; i < obstacles.length; i++) {
      const obs = obstacles[i];
      if (obs.kind === 'curb' || obs.kind === 'wheel_stop') continue;
      const push = resolveSingleObstaclePush(px, pz, radius, obs);
      if (push.hit) {
        px += push.pushX;
        pz += push.pushZ;
        collided = true;
      }
    }

    for (let i = 0; i < dynamicCircles.length; i++) {
      const c = dynamicCircles[i];
      const dx = px - c.x;
      const dz = pz - c.z;
      const dist = Math.hypot(dx, dz);
      const minDist = radius + c.radius;
      if (dist < minDist) {
        const nx = dist > 0.0001 ? dx / dist : 1;
        const nz = dist > 0.0001 ? dz / dist : 0;
        const push = minDist - dist;
        px += nx * push;
        pz += nz * push;
        collided = true;
      }
    }
  }

  return { x: px, z: pz, collided };
}
