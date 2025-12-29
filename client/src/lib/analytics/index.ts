/**
 * 📊 Analytics Module
 * 
 * Sistema de rastreamento de métricas para análise de tráfego pago.
 * 
 * Uso básico:
 * ```typescript
 * import { trackEvent, initializeUtm } from '@/lib/analytics';
 * 
 * // No mount do componente
 * initializeUtm();
 * trackEvent('page_view');
 * 
 * // Ao clicar em CTA
 * trackEvent('click_cta_principal', { position: 'hero' });
 * ```
 */

// UTM exports
export { captureUtmParams, persistUtmParams, getStoredUtmParams, initializeUtm } from './utm';
export type { UtmParams } from './utm';

// Device exports
export { getDeviceType, getBrowserInfo } from './device';
export type { DeviceType } from './device';

// Events exports
export { trackEvent, createEvent, sendToBackend, sendToGA4, sendToMeta } from './events';
export type { EventName, AnalyticsEvent, EventPayload } from './events';
