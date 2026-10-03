function detectBrowser(userAgent: string) {
  if (userAgent.includes('Edg/')) return 'Edge';
  if (userAgent.includes('OPR/')) return 'Opera';
  if (userAgent.includes('Firefox/')) return 'Firefox';
  if (userAgent.includes('Chrome/')) return 'Chrome';
  if (userAgent.includes('Safari/')) return 'Safari';
  return 'Браузер';
}

function detectSystem(userAgent: string) {
  if (userAgent.includes('Windows')) return 'Windows';
  if (userAgent.includes('Android')) return 'Android';
  if (/iPhone|iPad/.test(userAgent)) return 'iOS';
  if (userAgent.includes('Mac OS X')) return 'macOS';
  if (userAgent.includes('Linux')) return 'Linux';
  return;
}

/** Краткое «Chrome · Windows» из User-Agent: строка целиком слишком длинная. */
export function describeUserAgent(userAgent?: string) {
  if (!userAgent) return 'Неизвестное устройство';

  const browser = detectBrowser(userAgent);
  const system = detectSystem(userAgent);

  return system ? `${browser} · ${system}` : browser;
}
