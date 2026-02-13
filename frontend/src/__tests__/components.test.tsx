import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

describe('Badge Component', () => {
  it('renders children text', () => {
    render(<Badge>SUCCESS</Badge>);
    expect(screen.getByText('SUCCESS')).toBeInTheDocument();
  });

  it('applies success variant class', () => {
    render(<Badge variant="success">OK</Badge>);
    const badge = screen.getByText('OK');
    expect(badge.className).toContain('bg-green-100');
  });

  it('applies destructive variant class', () => {
    render(<Badge variant="destructive">ERROR</Badge>);
    const badge = screen.getByText('ERROR');
    expect(badge.className).toContain('bg-destructive');
  });
});

describe('Button Component', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('is disabled when disabled prop is passed', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('applies outline variant class', () => {
    render(<Button variant="outline">Outline</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('border');
  });

  it('applies size sm class', () => {
    render(<Button size="sm">Small</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('h-9');
  });
});
