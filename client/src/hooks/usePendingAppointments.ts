import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

/**
 * Hook para buscar agendamentos pendentes (não concluídos de rotas finalizadas)
 * Retorna os agendamentos pendentes e o total count
 */
export function usePendingAppointments() {
    const { data: pendingAppointments = [], isLoading } = useQuery({
        queryKey: ['/api/pending-appointments'],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/pending-appointments");
            return res.json();
        },
        // Refetch automaticamente a cada 5 minutos para manter atualizado
        refetchInterval: 5 * 60 * 1000,
    });

    return {
        pendingAppointments,
        pendingCount: pendingAppointments.length,
        isLoading
    };
}
