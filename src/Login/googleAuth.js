const cancelPattern = /cancel|canceled|user cancelled|user canceled|popup closed|popup closed by user|sign-in cancelled|sign in cancelled|sign-in canceled|sign in canceled|SIGN_IN_CANCELLED|CANCELLED_BY_USER/i;

export function getGoogleSignInErrorMessage(error) {
  if (error == null) {
    return 'Sign-in was cancelled';
  }

  if (typeof error === 'object') {
    if ('code' in error && typeof error.code === 'number') {
      error = error.code;
    } else if (typeof error.message === 'string' && error.message.trim()) {
      if (cancelPattern.test(error.message)) {
        return 'Sign-in was cancelled';
      }
      return error.message;
    } else if (typeof error.details === 'string' && error.details.trim()) {
      if (cancelPattern.test(error.details)) {
        return 'Sign-in was cancelled';
      }
      return error.details;
    }
  }

  if (typeof error === 'number') {
    const errorMap = {
      0: 'Sign-in was cancelled',
      2: 'Sign-in is in progress',
      3: 'Sign-in is required',
      4: 'Invalid account',
      5: 'Resolution denied',
      8: 'Network error - please check your connection',
      10: 'Plugin configuration issue or operation cancelled',
      12: 'API not available on this device',
      12501: 'Sign-in was cancelled',
      12502: 'Native Google Sign-In unavailable or misconfigured',
    };

    return errorMap[error] || 'Google Sign-In failed';
  }

  if (typeof error === 'string' && error.trim()) {
    const normalized = error.trim();
    if (cancelPattern.test(normalized)) {
      return 'Sign-in was cancelled';
    }
    if (/^(Error\s*)?\d+$/i.test(normalized)) {
      const numeric = Number(normalized.replace(/[^0-9]/g, ''));
      if (numeric === 0 || numeric === 12501) {
        return 'Sign-in was cancelled';
      }
      return 'Google Sign-In failed';
    }
    return normalized;
  }

  return 'Google Sign-In failed';
}

