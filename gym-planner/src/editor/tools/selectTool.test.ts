import { describe, it, expect } from 'vitest';
import { Group } from 'react-konva';
import { getDef } from '@/data/equipment';
describe('smoke', () => { it('imports react-konva', () => { expect(Group).toBeTruthy(); expect(getDef('x')).toBeUndefined(); }); });
