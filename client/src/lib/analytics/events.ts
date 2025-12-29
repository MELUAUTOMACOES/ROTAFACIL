/**
 * 📈 Analytics Events
 * 
 * Sistema de envio de eventos para tracking.
 * Suporta backend interno + integração futura com GA4 e Meta Pixel.
 */

import { UtmParams, getStoredUtmParams } from './utm';
import { DeviceType, getDeviceType } from './device';

// Nomes de eventos suportados
export type EventName =
    | 'page_view'
    | 'scroll_50'
    | 'scroll_75'
    | 'click_cta_principal'
    | 'click_whatsapp'
    | 'signup_start'
    | 'signup_complete';

// Estrutura de um evento de analytics
export interface AnalyticsEvent {
    eventName: EventName;
    timestamp: string;
    page: string;
    deviceType: DeviceType;
    utmParams: UtmParams;
    customData?: Record<string, unknown>;
}

// Payload enviado para o backend
export interface EventPayload {
    eventName: EventName;
    page: string;
    deviceType: DeviceType;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
    utmTerm?: string;
    eventData?: Record<string, unknown>;
    sessionId?: string;
}

// ID de sessão único para agrupar eventos do mesmo visitante
let sessionId: string | null = null;

/**
 * Gera ou recupera o ID de sessão do visitante
 */
function getSessionId(): string {
    if (sessionId) return sessionId;

    try {
        const stored = sessionStorage.getItem('rotafacil_session_id');
        if (stored) {
            sessionId = stored;
            return sessionId;
        }

        // Gera novo ID de sessão
        sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        sessionStorage.setItem('rotafacil_session_id', sessionId);
        return sessionId;
    } catch (error) {
        console.error('[Analytics] Erro ao gerar session ID:', error);
        return 'unknown';
    }
}

/**
 * Cria um evento completo com todos os metadados
 */
export function createEvent(eventName: EventName, customData?: Record<string, unknown>): AnalyticsEvent {
    return {
        eventName,
        timestamp: new Date().toISOString(),
        page: window.location.pathname,
        deviceType: getDeviceType(),
        utmParams: getStoredUtmParams(),
        customData,
    };
}

/**
 * Envia evento para o backend interno
 * @param event - Evento a ser enviado
 */
export async function sendToBackend(event: AnalyticsEvent): Promise<void> {
    try {
        const payload: EventPayload = {
            eventName: event.eventName,
            page: event.page,
            deviceType: event.deviceType,
            utmSource: event.utmParams.utm_source,
            utmMedium: event.utmParams.utm_medium,
            utmCampaign: event.utmParams.utm_campaign,
            utmContent: event.utmParams.utm_content,
            utmTerm: event.utmParams.utm_term,
            eventData: event.customData,
            sessionId: getSessionId(),
        };

        const response = await fetch('/api/metrics/event', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            console.warn('[Analytics] Falha ao enviar evento:', response.status);
        }
    } catch (error) {
        // Não interrompe a experiência do usuário por falha de analytics
        console.warn('[Analytics] Erro ao enviar evento para backend:', error);
    }
}

/**
 * 🔮 Stub para Google Analytics 4
 * Preparado para integração futura - atualmente apenas loga no console
 */
export function sendToGA4(event: AnalyticsEvent): void {
    // TODO: Integrar com gtag.js quando IDs estiverem disponíveis
    // Exemplo futuro:
    // if (typeof gtag !== 'undefined') {
    //   gtag('event', event.eventName, {
    //     page_location: window.location.href,
    //     page_path: event.page,
    //     ...event.utmParams,
    //     ...event.customData,
    //   });
    // }

    if (process.env.NODE_ENV === 'development') {
        console.log('[Analytics GA4] Evento preparado:', event.eventName, event);
    }
}

/**
 * 🔮 Stub para Meta Pixel
 * Preparado para integração futura - atualmente apenas loga no console
 */
export function sendToMeta(event: AnalyticsEvent): void {
    // TODO: Integrar com fbq quando Pixel ID estiver disponível
    // Exemplo futuro:
    // if (typeof fbq !== 'undefined') {
    //   fbq('trackCustom', event.eventName, {
    //     content_name: event.page,
    //     ...event.customData,
    //   });
    // }

    if (process.env.NODE_ENV === 'development') {
        console.log('[Analytics Meta] Evento preparado:', event.eventName, event);
    }
}

/**
 * Envia evento para todos os destinos configurados
 * @param eventName - Nome do evento
 * @param customData - Dados adicionais opcionais
 */
export async function trackEvent(eventName: EventName, customData?: Record<string, unknown>): Promise<void> {
    const event = createEvent(eventName, customData);

    // Log em desenvolvimento
    if (process.env.NODE_ENV === 'development') {
        console.log('[Analytics] Tracking:', eventName, event);
    }

    // Envia para todos os destinos em paralelo
    await Promise.all([
        sendToBackend(event),
        // GA4 e Meta são síncronos por enquanto (stubs)
        Promise.resolve(sendToGA4(event)),
        Promise.resolve(sendToMeta(event)),
    ]);
}
