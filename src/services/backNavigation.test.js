import { canGoBackInHistory, navigateBackOrFallback } from './backNavigation';

describe('back navigation helpers', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('uses history back when there is a prior entry', () => {
    window.history.replaceState({ idx: 2 }, '', '/profile/123/followers');
    const navigate = jest.fn();

    const result = navigateBackOrFallback(navigate, '/home');

    expect(result).toBe(true);
    expect(navigate).toHaveBeenCalledWith(-1);
  });

  it('falls back to home when there is no prior history entry', () => {
    window.history.replaceState({ idx: 0 }, '', '/profile/123/followers');
    const navigate = jest.fn();

    const result = navigateBackOrFallback(navigate, '/home');

    expect(result).toBe(false);
    expect(navigate).toHaveBeenCalledWith('/home', { replace: true });
  });

  it('treats a positive history index as a navigable back target', () => {
    window.history.replaceState({ idx: 1 }, '', '/profile/123/followers');

    expect(canGoBackInHistory()).toBe(true);
  });
});
