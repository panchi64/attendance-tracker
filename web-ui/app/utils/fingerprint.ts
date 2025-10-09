/**
 * Browser Fingerprinting Utility
 * Generates a unique fingerprint hash based on browser characteristics
 * More reliable than IP address for device identification
 */

/**
 * Get canvas fingerprint
 */
function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-canvas';

    canvas.width = 200;
    canvas.height = 50;

    // Draw text with varying styles
    ctx.textBaseline = 'top';
    ctx.font = '14px "Arial"';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('Attendance Tracker 🎓', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('Attendance Tracker 🎓', 4, 17);

    return canvas.toDataURL();
  } catch {
    return 'canvas-error';
  }
}

/**
 * Get WebGL fingerprint
 */
function getWebGLFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

    if (!gl) return 'no-webgl';

    const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return 'no-debug-info';

    const vendor = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
    const renderer = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);

    return `${vendor}~${renderer}`;
  } catch {
    return 'webgl-error';
  }
}

/**
 * Get audio fingerprint
 */
function getAudioFingerprint(): Promise<string> {
  return new Promise((resolve) => {
    try {
      // Type for webkit-prefixed AudioContext
      type AudioContextType = typeof AudioContext | (new () => AudioContext);
      const AudioContextConstructor: AudioContextType = window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: AudioContextType }).webkitAudioContext as AudioContextType;

      if (!AudioContextConstructor) {
        resolve('no-audio');
        return;
      }

      const context = new AudioContextConstructor();
      const oscillator = context.createOscillator();
      const analyser = context.createAnalyser();
      const gainNode = context.createGain();
      const scriptProcessor = context.createScriptProcessor(4096, 1, 1);

      gainNode.gain.value = 0; // Mute
      oscillator.type = 'triangle';
      oscillator.connect(analyser);
      analyser.connect(scriptProcessor);
      scriptProcessor.connect(gainNode);
      gainNode.connect(context.destination);

      scriptProcessor.onaudioprocess = function (event) {
        const output = event.outputBuffer.getChannelData(0);
        const hash = output.slice(0, 30).reduce((acc, val) => acc + Math.abs(val), 0);

        oscillator.disconnect();
        scriptProcessor.disconnect();
        gainNode.disconnect();
        context.close();

        resolve(hash.toString());
      };

      oscillator.start(0);
    } catch {
      resolve('audio-error');
    }
  });
}

/**
 * Simple hash function for strings
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Generate a unique browser fingerprint
 * @returns Promise<string> - A unique hash representing the browser/device
 */
export async function generateFingerprint(): Promise<string> {
  const components: Record<string, string> = {
    // Screen resolution
    screen: `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`,

    // Available screen size
    availScreen: `${window.screen.availWidth}x${window.screen.availHeight}`,

    // Timezone
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,

    // Timezone offset
    timezoneOffset: new Date().getTimezoneOffset().toString(),

    // Language
    language: navigator.language,

    // Platform
    platform: navigator.platform,

    // User agent
    userAgent: navigator.userAgent,

    // Hardware concurrency (CPU cores)
    cores: navigator.hardwareConcurrency?.toString() || 'unknown',

    // Device memory
    memory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory?.toString() || 'unknown',

    // Touch support
    touch: navigator.maxTouchPoints > 0 ? 'yes' : 'no',

    // Canvas fingerprint
    canvas: getCanvasFingerprint(),

    // WebGL fingerprint
    webgl: getWebGLFingerprint(),

    // Audio fingerprint (async)
    audio: await getAudioFingerprint(),

    // Plugins (deprecated but still useful)
    plugins: Array.from(navigator.plugins || [])
      .map(p => `${p.name}:${p.filename}`)
      .join(',') || 'none',
  };

  // Combine all components
  const fingerprintString = Object.entries(components)
    .map(([key, value]) => `${key}=${value}`)
    .join('|');

  // Generate hash
  return simpleHash(fingerprintString);
}

/**
 * Get or create cached fingerprint from localStorage
 * This ensures the same fingerprint persists across browser sessions and tabs
 * Prevents duplicate submissions via incognito mode or new browser sessions
 */
export async function getCachedFingerprint(): Promise<string> {
  const STORAGE_KEY = 'attendance_device_fingerprint_v2';

  // Try to get from localStorage first
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
      return cached;
    }
  } catch (e) {
    console.warn('Unable to access localStorage:', e);
  }

  // Generate new fingerprint
  const fingerprint = await generateFingerprint();

  // Try to cache it in localStorage for persistence
  try {
    localStorage.setItem(STORAGE_KEY, fingerprint);
  } catch (e) {
    console.warn('Unable to cache fingerprint:', e);
  }

  return fingerprint;
}
