import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './app.js';

describe('foundation page', () => {
  it('states the implemented scope without claiming product completion', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', {
        name: 'Notification delivery you can inspect and recover.',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/product workflows.*begin in Phase 4/i)).toBeInTheDocument();
  });
});
