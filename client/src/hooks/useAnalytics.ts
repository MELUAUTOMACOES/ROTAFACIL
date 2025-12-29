/**
 * 📊 useAnalytics Hook
 * 
 * Hook React para instrumentação de analytics na landing page.
 * Gerencia UTMs, tracking de eventos e scroll milestones.
 * 
 * @example
 * ```tsx
 * function LandingPage() {
 *   const { trackPageView, trackCta, setupScrollTracking } = useAnalytics();
 * 
 *   useEffect(() => {
 *     trackPageView();
 *     const cleanup = setupScrollTracking();
 *     return cleanup;
 *   }, []);
 * 
 *   return (
 *     <button onClick={() => trackCta('hero')}>
 *       Começar agora
 *     </button>
 *   );
 * }
 * ```
 */

import { useEffect, useRef, useCallback } from 'react';
import { initializeUtm, trackEvent, EventName } from '@/lib/analytics';

interface UseAnalyticsReturn {
    /** Dispara evento page_view */
    trackPageView: () => void;
    /** Dispara evento de clique em CTA */
    trackCta: (position?: string) => void;
    /** Dispara evento de clique em WhatsApp */
    trackWhatsApp: () => void;
    /** Dispara evento personalizado */
    track: (eventName: EventName, customData?: Record<string, unknown>) => void;
    /** Configura tracking de scroll (50% e 75%) - retorna cleanup function */
    setupScrollTracking: () => () => void;
}

export function useAnalytics(): UseAnalyticsReturn {
    // Flags para evitar disparos duplicados de scroll
    const scroll50Fired = useRef(false);
    const scroll75Fired = useRef(false);
    // Flag para garantir que UTMs só são inicializados uma vez
    const utmInitialized = useRef(false);

    // Inicializa UTMs no primeiro render
    useEffect(() => {
        if (!utmInitialized.current) {
            initializeUtm();
            utmInitialized.current = true;
        }
    }, []);

    /**
     * Dispara evento page_view
     */
    const trackPageView = useCallback(() => {
        trackEvent('page_view', {
            referrer: document.referrer || 'direct',
            url: window.location.href,
        });
    }, []);

    /**
     * Dispara evento de clique em CTA principal
     */
    const trackCta = useCallback((position?: string) => {
        trackEvent('click_cta_principal', {
            position: position || 'unknown',
            url: window.location.href,
        });
    }, []);

    /**
     * Dispara evento de clique em WhatsApp
     */
    const trackWhatsApp = useCallback(() => {
        trackEvent('click_whatsapp', {
            url: window.location.href,
        });
    }, []);

    /**
     * Dispara evento personalizado
     */
    const track = useCallback((eventName: EventName, customData?: Record<string, unknown>) => {
        trackEvent(eventName, customData);
    }, []);

    /**
     * Configura tracking de scroll milestones (50% e 75%)
     * Usa IntersectionObserver para performance
     * @returns Função de cleanup para remover observers
     */
    const setupScrollTracking = useCallback(() => {
        const handleScroll = () => {
            // Calcula posição do scroll como percentual
            const scrollTop = window.scrollY;
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            const scrollPercent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;

            // Dispara evento de 50% (apenas uma vez)
            if (scrollPercent >= 50 && !scroll50Fired.current) {
                scroll50Fired.current = true;
                trackEvent('scroll_50');
            }

            // Dispara evento de 75% (apenas uma vez)
            if (scrollPercent >= 75 && !scroll75Fired.current) {
                scroll75Fired.current = true;
                trackEvent('scroll_75');
            }
        };

        // Adiciona listener com throttle básico
        let ticking = false;
        const throttledScroll = () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    handleScroll();
                    ticking = false;
                });
                ticking = true;
            }
        };

        window.addEventListener('scroll', throttledScroll, { passive: true });

        // Retorna cleanup function
        return () => {
            window.removeEventListener('scroll', throttledScroll);
        };
    }, []);

    return {
        trackPageView,
        trackCta,
        trackWhatsApp,
        track,
        setupScrollTracking,
    };
}

export default useAnalytics;
