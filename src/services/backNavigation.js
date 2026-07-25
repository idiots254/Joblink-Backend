const backActionStack = [];

export const pushBackAction = (action) => {
  if (typeof action !== 'function') return;
  backActionStack.push(action);
};

export const popBackAction = (action) => {
  if (backActionStack.length === 0) return;

  const top = backActionStack[backActionStack.length - 1];
  if (top === action) {
    backActionStack.pop();
    return;
  }

  const index = backActionStack.lastIndexOf(action);
  if (index !== -1) {
    backActionStack.splice(index, 1);
  }
};

export const canGoBackInHistory = (historyRef = window.history) => {
  if (!historyRef) return false;

  const historyState = historyRef.state;
  if (historyState && typeof historyState === 'object' && typeof historyState.idx === 'number') {
    return historyState.idx > 0;
  }

  const length = typeof historyRef.length === 'number' ? historyRef.length : 0;
  return length > 1;
};

export const navigateBackOrFallback = (navigate, fallbackPath = '/home') => {
  if (typeof navigate !== 'function') return false;

  if (canGoBackInHistory()) {
    navigate(-1);
    return true;
  }

  navigate(fallbackPath, { replace: true });
  return false;
};

export const runBackAction = async () => {
  if (backActionStack.length === 0) return false;
  const action = backActionStack[backActionStack.length - 1];
  if (typeof action !== 'function') return false;

  try {
    await action();
    return true;
  } catch (error) {
    console.warn('BackNavigation: failed to run back action', error);
    return false;
  }
};

export const clearBackActionStack = () => {
  while (backActionStack.length > 0) {
    backActionStack.pop();
  }
};
