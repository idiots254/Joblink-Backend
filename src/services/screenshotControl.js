const isNativePlatform = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  return !!window.Capacitor?.isNativePlatform?.();
};

async function invokeNativePlugin(methodName, payload) {
  if (!isNativePlatform()) {
    return;
  }

  try {
    const plugin = window.Capacitor?.Plugins?.ScreenshotControl;
    if (!plugin || typeof plugin[methodName] !== 'function') {
      return;
    }

    await plugin[methodName](payload);
  } catch (err) {
    console.warn(`ScreenshotControl ${methodName} failed:`, err);
  }
}

export async function setSecure(secure = true) {
  await invokeNativePlugin('setSecure', { secure });
}

export async function setSystemBarLightMode(lightMode = true, persist = true) {
  await invokeNativePlugin('setSystemBarStyle', { lightMode, persist });
}

const screenshotControl = { setSecure, setSystemBarLightMode };

export default screenshotControl;
