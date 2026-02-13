import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn utility', () => {
  it('merges class names', () => {
    const result = cn('px-2', 'py-3');
    expect(result).toBe('px-2 py-3');
  });

  it('handles conditional classes', () => {
    const active = true;
    const result = cn('base', active && 'active');
    expect(result).toContain('active');
  });

  it('deduplicates tailwind classes', () => {
    const result = cn('px-2', 'px-4');
    expect(result).toBe('px-4');
  });

  it('handles undefined and null', () => {
    const result = cn('base', undefined, null, 'extra');
    expect(result).toBe('base extra');
  });
});
