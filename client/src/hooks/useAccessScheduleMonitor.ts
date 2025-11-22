import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { getAuthHeaders } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

/**
 * Hook para monitorar continuamente se o usuário ainda tem permissão de acesso
 * Verifica a cada 1 minuto e:
 * - Desloga automaticamente se o horário expirou
 * - Mostra aviso 10 minutos antes do fim do expediente
 */
export function useAccessScheduleMonitor() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [warningShown, setWarningShown] = useState(false);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastCheckRef = useRef<number>(0);

  useEffect(() => {
    // Só monitora usuários autenticados
    if (!user) {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      return;
    }

    // Função para verificar o acesso
    const checkAccess = async () => {
      try {
        const response = await fetch('/api/check-access', {
          headers: getAuthHeaders(),
        });

        if (!response.ok) {
          // Acesso negado - deslogar imediatamente
          const data = await response.json();
          
          console.log('⏰ [ACCESS MONITOR] Horário de acesso expirado');
          
          toast({
            title: "Horário de Acesso Expirado",
            description: data.message || "Seu horário de acesso à plataforma expirou. Você será desconectado.",
            variant: "destructive",
            duration: 5000,
          });

          // Deslogar após 2 segundos para dar tempo do usuário ver o aviso
          setTimeout(() => {
            logout();
          }, 2000);
          
          return;
        }

        const data = await response.json();

        // Verificar se está próximo do fim do expediente (10 minutos)
        if (data.minutesUntilEnd !== null && data.minutesUntilEnd > 0) {
          if (data.minutesUntilEnd <= 10 && !warningShown) {
            console.log(`⏰ [ACCESS MONITOR] Aviso: faltam ${data.minutesUntilEnd} minutos para o fim do expediente`);
            
            toast({
              title: "⏰ Atenção: Fim do Expediente",
              description: `Faltam ${data.minutesUntilEnd} minutos para o encerramento do seu horário de acesso. Salve seu trabalho!`,
              variant: "default",
              duration: 10000,
            });
            
            setWarningShown(true);
          }
          
          // Resetar warning se passou mais de 10 minutos
          if (data.minutesUntilEnd > 10 && warningShown) {
            setWarningShown(false);
          }
        } else {
          // Não há expediente ativo ou sem tabela de horário
          if (warningShown) {
            setWarningShown(false);
          }
        }

      } catch (error) {
        console.error('❌ [ACCESS MONITOR] Erro ao verificar acesso:', error);
        // Em caso de erro de rede, não deslogar - apenas logar o erro
      }
    };

    // Fazer primeira verificação imediatamente
    checkAccess();

    // Configurar verificação periódica a cada 1 minuto (60000ms)
    checkIntervalRef.current = setInterval(() => {
      const now = Date.now();
      // Só verificar se passou pelo menos 50 segundos desde a última verificação
      if (now - lastCheckRef.current >= 50000) {
        lastCheckRef.current = now;
        checkAccess();
      }
    }, 60000);

    // Cleanup
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, [user, logout, toast, warningShown]);

  return null;
}
