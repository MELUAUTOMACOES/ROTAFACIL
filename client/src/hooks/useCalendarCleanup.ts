/**
 * Hook específico para limpeza de calendários react-big-calendar
 * Previne erros DOM relacionados aos tooltips, overlays e portals do calendário
 */
import { useEffect, useRef } from 'react';

export function useCalendarCleanup(isCalendarVisible: boolean) {
  const calendarContainerRef = useRef<HTMLDivElement>(null);
  const cleanupPerformed = useRef(false);

  useEffect(() => {
    return () => {
      if (cleanupPerformed.current) return;
      cleanupPerformed.current = true;

      // Aguarda um tick para garantir que outros hooks já foram processados
      setTimeout(() => {
        try {
          console.log('🗓️ [CALENDAR] Iniciando limpeza específica do calendário');

          // Remove tooltips do react-big-calendar que possam ter ficado no DOM
          const tooltips = document.querySelectorAll('.rbc-tooltip, [role="tooltip"], .rbc-overlay');
          tooltips.forEach((tooltip, index) => {
            try {
              if (tooltip.parentNode) {
                tooltip.parentNode.removeChild(tooltip);
                console.log(`✅ [CALENDAR] Tooltip ${index + 1} removido com sucesso`);
              }
            } catch (error) {
              console.log(`⚠️ [CALENDAR] Tooltip ${index + 1} já foi removido ou não existe mais`);
            }
          });

          // Remove overlays específicos do react-big-calendar
          const overlays = document.querySelectorAll('.rbc-overlay-header, .rbc-date-header-overlay, .rbc-popup');
          overlays.forEach((overlay, index) => {
            try {
              if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
                console.log(`✅ [CALENDAR] Overlay ${index + 1} removido com sucesso`);
              }
            } catch (error) {
              console.log(`⚠️ [CALENDAR] Overlay ${index + 1} já foi removido ou não existe mais`);
            }
          });

          // Remove event handlers que podem ter ficado órfãos
          const eventElements = document.querySelectorAll('.rbc-event, .rbc-event-content');
          eventElements.forEach((element) => {
            try {
              // Remove event listeners que podem estar causando vazamentos
              const clonedElement = element.cloneNode(true);
              if (element.parentNode) {
                element.parentNode.replaceChild(clonedElement, element);
              }
            } catch (error) {
              console.log('⚠️ [CALENDAR] Elemento de evento já foi processado');
            }
          });

          console.log('✨ [CALENDAR] Limpeza específica do calendário concluída');
        } catch (error) {
          console.error('❌ [CALENDAR] Erro durante limpeza específica:', error);
        }
      }, 100);
    };
  }, [isCalendarVisible]);

  return calendarContainerRef;
}