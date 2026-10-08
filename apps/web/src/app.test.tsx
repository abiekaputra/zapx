import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './app.js';

describe('product status page', () => {
  it('states the implemented scope without claiming product completion', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', {
        name: 'Notification delivery you can inspect and recover.',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/operator console workflows begin in Phase 6/i)).toBeInTheDocument();
  });
});
