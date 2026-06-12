/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Racer {
  id: string;
  name: string;
  avatar: string;
  color: string;
  speed: number; // in km/h
  targetSpeed: number; // in km/h
  distance: number; // in meters
  rank: number;
  isPlayer: boolean;
  lightAlignment: number; // 0 to 100 representing how well aligned with light beam
  engineRpm: number; // high revving inline 4-cylinder RPM (up to 16,000)
}

export type RaceStatus = 'idle' | 'countdown' | 'racing' | 'finished';

export interface GameSettings {
  totalDistance: number; // target distance in meters
  isLowLightTheme: boolean; // active low-light dark theme
  uiColorStyle: 'neon-cyan' | 'neon-amber' | 'night-sky';
  controlMethod: 'keyboard' | 'drag-gesture' | 'screen-pedal';
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  size: number;
  color: string;
}

export interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
  speed: number;
}
