import type { ObstacleSpec, ParkingZoneSpec, Vec2 } from './types';

// Expanded 68m x 44m Mega Mart Supermarket Parking Facility
export const WORLD_MIN_X = -34;
export const WORLD_MAX_X = 34;
export const WORLD_MIN_Z = -14;
export const WORLD_MAX_Z = 30;
export const LOT_CENTER_Z = 8;

// Playable asphalt perimeter walls (used for physics bounds)
export const PLAYABLE_MIN_X = -33.2;
export const PLAYABLE_MAX_X = 33.2;
export const PLAYABLE_MIN_Z = -4.2; // Sidewalk curb edge along storefront
export const PLAYABLE_MAX_Z = 29.2;

export interface CandidateBaySpec {
  id: string;
  zoneLabel: string;
  bay: ParkingZoneSpec;
  /** Direction pointing from bay center out into the driving lane (unit vector) */
  laneNormal: Vec2;
  /** Suggested curb behind the bay (if next to island or sidewalk) */
  curbOffset?: { dx: number; dz: number; yaw: number; width: number };
  /** Flanking spots along bay length axis (-1 = left/rear along axis, +1 = right/front along axis) */
  flankClearance: number;
  /** Accessible driving-aisle spawn candidates for this bay */
  spawns: Array<{ x: number; z: number; yaw: number }>;
}

/**
 * Permanent architectural/environmental fixtures in the expanded 68m x 44m parking facility.
 * Carefully positioned outside the core Level 1-6 north storefront aisle (x in [-11, 11], z in [-4.5, 5.2])
 * so classic Career levels work seamlessly inside the larger living supermarket complex.
 */
export const PERMANENT_LOT_OBSTACLES: ObstacleSpec[] = [
  // Landscaped curbed divider islands (separating North Aisle, Middle Aisle, and South Boulevard)
  { id: 'perm_island_nw', kind: 'island', x: -14.5, z: 7.4, yaw: 0, width: 8.4, length: 2.6, height: 0.28 },
  { id: 'perm_island_c', kind: 'island', x: 0, z: 7.4, yaw: 0, width: 7.4, length: 2.6, height: 0.28 },
  { id: 'perm_island_ne', kind: 'island', x: 14.5, z: 7.4, yaw: 0, width: 8.4, length: 2.6, height: 0.28 },

  { id: 'perm_island_sw', kind: 'island', x: -13.5, z: 18.8, yaw: 0, width: 9.2, length: 2.6, height: 0.28 },
  { id: 'perm_island_se', kind: 'island', x: 13.5, z: 18.8, yaw: 0, width: 9.2, length: 2.6, height: 0.28 },

  // West Wing Delivery & Loading Dock
  { id: 'perm_loading_dock', kind: 'loading_dock', x: -27.2, z: -7.2, yaw: 0, width: 9.4, length: 5.2, height: 1.45 },
  { id: 'perm_dock_barrier_1', kind: 'barrier', x: -21.8, z: -4.8, yaw: Math.PI / 2, width: 2.2, length: 0.42, height: 0.85 },
  { id: 'perm_dock_bol_1', kind: 'bollard', x: -22.2, z: -2.2, yaw: 0, width: 0.36, length: 0.36, height: 0.9 },
  { id: 'perm_dock_bol_2', kind: 'bollard', x: -31.8, z: -2.2, yaw: 0, width: 0.36, length: 0.36, height: 0.9 },

  // Permanent Cart Return Corrals across the middle & east sections
  { id: 'perm_corral_mid_w', kind: 'corral', x: -20.5, z: 13.2, yaw: Math.PI / 2, width: 2.3, length: 3.3, height: 1.1 },
  { id: 'perm_corral_mid_c', kind: 'corral', x: 0, z: 18.8, yaw: 0, width: 2.3, length: 3.3, height: 1.1 },
  { id: 'perm_corral_mid_e', kind: 'corral', x: 20.5, z: 13.2, yaw: -Math.PI / 2, width: 2.3, length: 3.3, height: 1.1 },

  // Storefront sidewalk benches & trash bins (clear of doorway & Level 1-6 lane)
  { id: 'perm_bench_w', kind: 'bench', x: -10.8, z: -5.4, yaw: 0, width: 1.85, length: 0.68, height: 0.85 },
  { id: 'perm_bench_e', kind: 'bench', x: 10.8, z: -5.4, yaw: 0, width: 1.85, length: 0.68, height: 0.85 },
  { id: 'perm_bin_w', kind: 'trash_bin', x: -8.6, z: -5.5, yaw: 0, width: 0.64, length: 0.64, height: 0.95 },
  { id: 'perm_bin_e', kind: 'trash_bin', x: 8.6, z: -5.5, yaw: 0, width: 0.64, length: 0.64, height: 0.95 },
  { id: 'perm_bin_island', kind: 'trash_bin', x: 3.1, z: 7.4, yaw: 0, width: 0.64, length: 0.64, height: 0.95 },

  // Parking signs & safety barriers
  { id: 'perm_sign_nw', kind: 'sign', x: -18.2, z: 7.4, yaw: 0, width: 0.45, length: 0.45, height: 2.2, label: 'P' },
  { id: 'perm_sign_ne', kind: 'sign', x: 18.2, z: 7.4, yaw: 0, width: 0.45, length: 0.45, height: 2.2, label: 'CART' },
  { id: 'perm_sign_sw', kind: 'sign', x: -17.6, z: 18.8, yaw: 0, width: 0.45, length: 0.45, height: 2.2, label: 'P' },
  { id: 'perm_sign_se', kind: 'sign', x: 17.6, z: 18.8, yaw: 0, width: 0.45, length: 0.45, height: 2.2, label: 'EXIT' },
  { id: 'perm_barrier_e1', kind: 'barrier', x: 29.8, z: -1.8, yaw: 0, width: 2.2, length: 0.42, height: 0.85 },
  { id: 'perm_barrier_s1', kind: 'barrier', x: -28.0, z: 26.8, yaw: 0, width: 2.2, length: 0.42, height: 0.85 },
  { id: 'perm_barrier_s2', kind: 'barrier', x: 28.0, z: 26.8, yaw: 0, width: 2.2, length: 0.42, height: 0.85 },

  // Scenic background parked cars in outer parking bays so the facility always feels active
  { id: 'perm_car_sw1', kind: 'car', x: -24.5, z: 21.8, yaw: 0, width: 1.88, length: 4.1, height: 1.46, color: 0x3b82f6, variant: 'sedan' },
  { id: 'perm_car_sw2', kind: 'car', x: -28.2, z: 21.8, yaw: 0, width: 1.95, length: 4.25, height: 1.62, color: 0x64748b, variant: 'suv' },
  { id: 'perm_car_se1', kind: 'car', x: 25.2, z: 21.8, yaw: 0, width: 1.82, length: 3.75, height: 1.42, color: 0x10b981, variant: 'hatchback' },
  { id: 'perm_car_se2', kind: 'car', x: 28.8, z: 21.8, yaw: 0, width: 1.88, length: 4.1, height: 1.46, color: 0xef4444, variant: 'sedan' },
  { id: 'perm_car_e1', kind: 'car', x: 27.6, z: 6.2, yaw: Math.PI / 2, width: 1.95, length: 4.25, height: 1.62, color: 0xf59e0b, variant: 'suv' },
  { id: 'perm_car_w1', kind: 'car', x: -27.8, z: 6.2, yaw: Math.PI / 2, width: 1.82, length: 3.75, height: 1.42, color: 0x8b5cf6, variant: 'hatchback' },
];

/**
 * Rich catalog of 14 distinct parking bay locations across the expanded 68m x 44m facility
 * (North Storefront, Central Islands, Middle Row, West Loading Wing, East Corner, South Row).
 */
export const CANDIDATE_PARKING_BAYS: CandidateBaySpec[] = [
  {
    id: 'bay_north_center_w',
    zoneLabel: 'Storefront West',
    bay: { x: -4.2, z: -2.2, yaw: Math.PI / 2, width: 1.7, length: 2.6 },
    laneNormal: { x: 0, z: 1 },
    curbOffset: { dx: 0, dz: -1.45, yaw: 0, width: 10 },
    flankClearance: 2.1,
    spawns: [
      { x: -13.5, z: 2.3, yaw: Math.PI / 2 },
      { x: 6.8, z: 2.4, yaw: -Math.PI / 2 },
      { x: -6.4, z: 12.2, yaw: Math.PI },
    ],
  },
  {
    id: 'bay_north_center_e',
    zoneLabel: 'Storefront East',
    bay: { x: 4.8, z: -2.2, yaw: -Math.PI / 2, width: 1.7, length: 2.6 },
    laneNormal: { x: 0, z: 1 },
    curbOffset: { dx: 0, dz: -1.45, yaw: 0, width: 10 },
    flankClearance: 2.1,
    spawns: [
      { x: -7.5, z: 2.4, yaw: Math.PI / 2 },
      { x: 14.5, z: 2.3, yaw: -Math.PI / 2 },
      { x: 6.8, z: 12.6, yaw: Math.PI },
    ],
  },
  {
    id: 'bay_north_far_e',
    zoneLabel: 'Bakery Curb',
    bay: { x: 16.5, z: -2.2, yaw: Math.PI / 2, width: 1.65, length: 2.55 },
    laneNormal: { x: 0, z: 1 },
    curbOffset: { dx: 0, dz: -1.45, yaw: 0, width: 9.5 },
    flankClearance: 2.0,
    spawns: [
      { x: 4.0, z: 2.4, yaw: Math.PI / 2 },
      { x: 24.5, z: 2.2, yaw: -Math.PI / 2 },
      { x: 10.5, z: 12.5, yaw: 0.45 },
    ],
  },
  {
    id: 'bay_west_dock',
    zoneLabel: 'Loading Bay Lane',
    bay: { x: -17.5, z: -2.1, yaw: -Math.PI / 2, width: 1.68, length: 2.55 },
    laneNormal: { x: 0, z: 1 },
    curbOffset: { dx: 0, dz: -1.45, yaw: 0, width: 9.0 },
    flankClearance: 2.0,
    spawns: [
      { x: -6.5, z: 2.5, yaw: -Math.PI / 2 },
      { x: -24.5, z: 2.2, yaw: Math.PI / 2 },
      { x: -10.5, z: 12.5, yaw: -0.45 },
    ],
  },
  {
    id: 'bay_island_c_north',
    zoneLabel: 'Center Island North',
    bay: { x: 0.0, z: 4.75, yaw: 0, width: 1.72, length: 2.55 },
    laneNormal: { x: 0, z: -1 },
    flankClearance: 2.0,
    spawns: [
      { x: -10.5, z: 1.8, yaw: Math.PI / 2 },
      { x: 11.2, z: 1.8, yaw: -Math.PI / 2 },
      { x: -7.5, z: -1.2, yaw: Math.PI / 3 },
    ],
  },
  {
    id: 'bay_island_nw_south',
    zoneLabel: 'Mid-West Island',
    bay: { x: -14.5, z: 9.8, yaw: -Math.PI * 0.25, width: 1.72, length: 2.55 },
    laneNormal: { x: 0.707, z: 0.707 },
    flankClearance: 2.0,
    spawns: [
      { x: -23.5, z: 13.4, yaw: Math.PI / 2 },
      { x: -5.5, z: 13.4, yaw: -Math.PI / 2 },
      { x: -7.2, z: 2.5, yaw: Math.PI },
    ],
  },
  {
    id: 'bay_island_ne_south',
    zoneLabel: 'Mid-East Island',
    bay: { x: 14.5, z: 9.8, yaw: Math.PI / 2, width: 1.68, length: 2.55 },
    laneNormal: { x: 0, z: 1 },
    flankClearance: 2.0,
    spawns: [
      { x: 23.5, z: 13.4, yaw: -Math.PI / 2 },
      { x: 5.5, z: 13.4, yaw: Math.PI / 2 },
      { x: 7.2, z: 2.5, yaw: Math.PI },
    ],
  },
  {
    id: 'bay_cross_west',
    zoneLabel: 'West Intersection',
    bay: { x: -24.2, z: 12.8, yaw: 0, width: 1.72, length: 2.6 },
    laneNormal: { x: 1, z: 0 },
    flankClearance: 2.0,
    spawns: [
      { x: -19.5, z: 2.4, yaw: Math.PI },
      { x: -18.5, z: 22.8, yaw: 0 },
      { x: -10.5, z: 13.2, yaw: -Math.PI / 2 },
    ],
  },
  {
    id: 'bay_cross_east',
    zoneLabel: 'East Express Lane',
    bay: { x: 24.2, z: 12.8, yaw: Math.PI, width: 1.72, length: 2.6 },
    laneNormal: { x: -1, z: 0 },
    flankClearance: 2.0,
    spawns: [
      { x: 19.5, z: 2.4, yaw: Math.PI },
      { x: 18.5, z: 22.8, yaw: 0 },
      { x: 10.5, z: 13.2, yaw: Math.PI / 2 },
    ],
  },
  {
    id: 'bay_mid_hub_s',
    zoneLabel: 'Central Cart Plaza',
    bay: { x: 0.0, z: 16.0, yaw: Math.PI, width: 1.68, length: 2.5 },
    laneNormal: { x: 0, z: -1 },
    flankClearance: 2.0,
    spawns: [
      { x: -9.8, z: 13.0, yaw: Math.PI / 2 },
      { x: 9.8, z: 13.0, yaw: -Math.PI / 2 },
      { x: 0.0, z: 2.2, yaw: Math.PI },
    ],
  },
  {
    id: 'bay_south_west',
    zoneLabel: 'South Curb West',
    bay: { x: -13.5, z: 21.4, yaw: Math.PI * 0.75, width: 1.72, length: 2.55 },
    laneNormal: { x: -0.707, z: 0.707 },
    flankClearance: 2.0,
    spawns: [
      { x: -22.5, z: 24.8, yaw: Math.PI / 2 },
      { x: -4.2, z: 24.8, yaw: -Math.PI / 2 },
      { x: -7.5, z: 13.5, yaw: Math.PI },
    ],
  },
  {
    id: 'bay_south_east',
    zoneLabel: 'South Curb East',
    bay: { x: 13.5, z: 21.4, yaw: -Math.PI / 2, width: 1.7, length: 2.55 },
    laneNormal: { x: 0, z: 1 },
    flankClearance: 2.0,
    spawns: [
      { x: 22.5, z: 24.8, yaw: -Math.PI / 2 },
      { x: 4.2, z: 24.8, yaw: Math.PI / 2 },
      { x: 7.5, z: 13.5, yaw: Math.PI },
    ],
  },
  {
    id: 'bay_south_boulevard',
    zoneLabel: 'Boulevard Edge',
    bay: { x: 0.0, z: 26.8, yaw: 0, width: 1.75, length: 2.7 },
    laneNormal: { x: 0, z: -1 },
    curbOffset: { dx: 0, dz: 1.45, yaw: 0, width: 10.5 },
    flankClearance: 2.1,
    spawns: [
      { x: -11.5, z: 24.2, yaw: Math.PI / 2 },
      { x: 11.5, z: 24.2, yaw: -Math.PI / 2 },
      { x: -6.8, z: 13.6, yaw: Math.PI },
    ],
  },
  {
    id: 'bay_angled_east',
    zoneLabel: 'Diagonal Corner',
    bay: { x: 25.5, z: 2.5, yaw: Math.PI * 0.25, width: 1.75, length: 2.6 },
    laneNormal: { x: -0.707, z: 0.707 },
    flankClearance: 2.0,
    spawns: [
      { x: 14.5, z: 2.4, yaw: Math.PI / 2 },
      { x: 20.5, z: 13.5, yaw: 0 },
      { x: 7.5, z: 12.2, yaw: Math.PI * 0.35 },
    ],
  },
];
