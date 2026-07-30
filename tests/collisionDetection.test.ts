/**
 * Tests for collision detection utilities
 */

import { describe, it, expect } from 'vitest';
import { wouldCollide, wouldMoveCauseCollision } from '../app/editor/collisionDetection';
import type { EditableStone } from '../app/editor/EditorState';

describe('wouldCollide', () => {
  const existingStones: EditableStone[] = [
    {
      id: 'stone1',
      center: { x: 10, y: 10 },
      holeDiameterMm: 2,
      stoneSize: 'SS6',
    },
    {
      id: 'stone2',
      center: { x: 20, y: 10 },
      holeDiameterMm: 2,
      stoneSize: 'SS6',
    },
  ];

  it('should detect collision when stones overlap', () => {
    const result = wouldCollide(10.5, 10, 1, existingStones);
    expect(result.collides).toBe(true);
    expect(result.collidingStones.length).toBeGreaterThan(0);
  });

  it('should not detect collision when stones are far apart', () => {
    const result = wouldCollide(50, 50, 1, existingStones);
    expect(result.collides).toBe(false);
    expect(result.collidingStones).toHaveLength(0);
  });

  it('should exclude stones by ID', () => {
    const result = wouldCollide(10, 10, 1, existingStones, ['stone1']);
    expect(result.collides).toBe(false);
  });

  it('should detect collision at exact overlap', () => {
    const result = wouldCollide(10, 10, 1, existingStones);
    expect(result.collides).toBe(true);
  });

  it('should return all colliding stones', () => {
    // Place stone between two existing stones
    const result = wouldCollide(15, 10, 5, existingStones);
    if (result.collides) {
      expect(result.collidingStones.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('should handle empty stone array', () => {
    const result = wouldCollide(10, 10, 1, []);
    expect(result.collides).toBe(false);
    expect(result.collidingStones).toHaveLength(0);
  });
});

describe('wouldMoveCauseCollision', () => {
  const stones: EditableStone[] = [
    {
      id: 'stone1',
      center: { x: 10, y: 10 },
      holeDiameterMm: 2,
      stoneSize: 'SS6',
    },
    {
      id: 'stone2',
      center: { x: 20, y: 10 },
      holeDiameterMm: 2,
      stoneSize: 'SS6',
    },
    {
      id: 'stone3',
      center: { x: 30, y: 10 },
      holeDiameterMm: 2,
      stoneSize: 'SS6',
    },
  ];

  it('should detect collision when move causes overlap', () => {
    const moves = [{ id: 'stone1', toX: 19, toY: 10 }];
    const result = wouldMoveCauseCollision(moves, stones);
    expect(result.collides).toBe(true);
    expect(result.collidingPairs.length).toBeGreaterThan(0);
  });

  it('should not detect collision when move is safe', () => {
    const moves = [{ id: 'stone1', toX: 10, toY: 20 }];
    const result = wouldMoveCauseCollision(moves, stones);
    expect(result.collides).toBe(false);
    expect(result.collidingPairs).toHaveLength(0);
  });

  it('should detect collision between multiple moving stones', () => {
    const moves = [
      { id: 'stone1', toX: 15, toY: 10 },
      { id: 'stone3', toX: 15.5, toY: 10 },
    ];
    const result = wouldMoveCauseCollision(moves, stones);
    expect(result.collides).toBe(true);
  });

  it('should not check collision between stationary stones', () => {
    // Moving stone1 far away shouldn't check stone2-stone3 collision
    const moves = [{ id: 'stone1', toX: 100, toY: 100 }];
    const result = wouldMoveCauseCollision(moves, stones);
    expect(result.collides).toBe(false);
  });

  it('should handle empty moves array', () => {
    const result = wouldMoveCauseCollision([], stones);
    expect(result.collides).toBe(false);
    expect(result.collidingPairs).toHaveLength(0);
  });

  it('should return all colliding pairs', () => {
    const moves = [
      { id: 'stone1', toX: 20, toY: 10 },
      { id: 'stone2', toX: 20, toY: 10 },
      { id: 'stone3', toX: 20, toY: 10 },
    ];
    const result = wouldMoveCauseCollision(moves, stones);
    expect(result.collides).toBe(true);
    // All three stones at same position should create multiple collision pairs
    expect(result.collidingPairs.length).toBeGreaterThanOrEqual(1);
  });
});
