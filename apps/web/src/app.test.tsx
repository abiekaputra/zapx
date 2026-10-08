import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from './app.js';

describe('operator console', () => {
  afterEach(() => vi.restoreAllMocks());

  it('opens the local sign-in flow when no session exists', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ json: async () => ({}), ok: false, status: 401 }),
    );
    render(<App />);
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Sign in to your workspace' }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByDisplayValue('owner@zapx.local')).toBeInTheDocument();
    expect(screen.getByText(/local-only environment/i)).toBeInTheDocument();
  });
});
