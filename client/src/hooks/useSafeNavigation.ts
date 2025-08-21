/**
 * Hook para navegação segura que previne erros DOM de removeChild
 * Gerencia o ciclo de vida de modais, calendários e outros elementos do DOM
 */
import { useEffect, useRef, useCallback } from 'react';

interface SafeNavigationConfig {
  componentName: string;
  modals?: {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    resetState?: () => void;
  }[];
  calendars?: {
    isVisible: boolean;
    cleanup?: () => void;
  }[];
}

export function useSafeNavigation(config: SafeNavigationConfig) {
  const isComponentMounted = useRef(true);
  const cleanupFunctions = useRef<(() => void)[]>([]);

  // Função para registrar limpeza personalizada
  const registerCleanup = useCallback((cleanupFn: () => void) => {
    cleanupFunctions.current.push(cleanupFn);
  }, []);

  // Função segura para fechar modais
  const safeCloseModals = useCallback(() => {
    if (!isComponentMounted.current) {
      return false;
    }

    try {
      config.modals?.forEach((modal, index) => {
        if (modal.isOpen) {
          console.log(`🔒 [${config.componentName}] Fechando modal ${index + 1}`);
          modal.setIsOpen(false);
          modal.resetState?.();
        }
      });
      return true;
    } catch (error) {
      console.error(`❌ [${config.componentName}] Erro ao fechar modais:`, error);
      return false;
    }
  }, [config.componentName, config.modals]);

  // Função segura para limpeza de calendários
  const safeCleanupCalendars = useCallback(() => {
    if (!isComponentMounted.current) {
      return false;
    }

    try {
      config.calendars?.forEach((calendar, index) => {
        if (calendar.isVisible && calendar.cleanup) {
          console.log(`📅 [${config.componentName}] Limpando calendário ${index + 1}`);
          calendar.cleanup();
        }
      });
      return true;
    } catch (error) {
      console.error(`❌ [${config.componentName}] Erro na limpeza de calendários:`, error);
      return false;
    }
  }, [config.componentName, config.calendars]);

  // Cleanup principal no desmonte do componente
  useEffect(() => {
    isComponentMounted.current = true;

    return () => {
      isComponentMounted.current = false;

      // Executar todas as limpezas registradas
      cleanupFunctions.current.forEach((cleanup, index) => {
        try {
          cleanup();
          console.log(`✅ [${config.componentName}] Limpeza ${index + 1} concluída`);
        } catch (error) {
          console.error(`❌ [${config.componentName}] Erro na limpeza ${index + 1}:`, error);
        }
      });

      // Limpeza de modais
      safeCloseModals();
      
      // Limpeza de calendários
      safeCleanupCalendars();
    };
  }, [config.componentName, safeCloseModals, safeCleanupCalendars]);

  // Retorna utilidades para o componente
  return {
    isComponentMounted,
    registerCleanup,
    safeCloseModals,
    safeCleanupCalendars,
    // Função para verificar se é seguro executar operações DOM
    isSafeToOperate: () => isComponentMounted.current,
  };
}