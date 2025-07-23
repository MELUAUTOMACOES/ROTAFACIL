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
          console.log('🗓️ [CALENDAR] (Safe cleanup) Ignorando limpeza manual de tooltips/overlays para evitar conflitos com React.');
          // NÃO REMOVA manualmente elementos do DOM aqui!
          // Confie no ciclo de vida do React e do react-big-calendar.

          // Se quiser limpar refs, estados ou timers, faça aqui.
          // Não manipule o DOM diretamente.
        } catch (error) {
          console.error('❌ [CALENDAR] Erro durante cleanup:', error);
        }
      }, 100);
    };
  }, [isCalendarVisible]);

  return calendarContainerRef;
}
