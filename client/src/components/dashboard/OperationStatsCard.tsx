import { useQuery } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
    CalendarDays,
    CalendarCheck,
    CalendarX,
    Calendar,
    Loader2,
    Share2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRef } from "react";
import { captureAndShare } from "@/lib/screenshot";

interface OperationStatsCardProps {
    startDate?: string;
    endDate?: string;
    technicianId?: number;
    teamId?: number;
}

// Resposta do endpoint agregado /api/dashboard/financial-metrics-v2
interface FinancialMetricsV2Response {
    totalRevenue: number;
    totalCount: number;
    breakdown: Array<{
        status: string;
        label: string;
        count: number;
        revenue: number;
        percent: number;
        color: string;
    }>;
}

// Resposta do endpoint /api/dashboard/appointments-stats
interface AppointmentsStatsResponse {
    todayAppointments: number;
    todayVariation: number;
    completionRate: number;
    completionVariation: number;
    monthRevenue: number;
    revenueVariation: number;
    avgExecutionTime: number;
}

export function OperationStatsCard({ startDate, endDate, technicianId, teamId }: OperationStatsCardProps) {
    // ✅ OTIMIZADO: Usar endpoint agregado em vez de buscar todos os appointments
    // Payload: ~500 bytes vs ~10KB+ (fetch-all)
    const { data: metricsData, isLoading: isLoadingMetrics } = useQuery<FinancialMetricsV2Response>({
        queryKey: ["/api/dashboard/financial-metrics-v2", startDate, endDate, technicianId, teamId],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (startDate) params.set("startDate", startDate);
            if (endDate) params.set("endDate", endDate);
            if (technicianId) params.set("technicianId", technicianId.toString());
            if (teamId) params.set("teamId", teamId.toString());

            const res = await fetch(`/api/dashboard/financial-metrics-v2?${params.toString()}`, {
                headers: getAuthHeaders(),
            });
            if (!res.ok) throw new Error("Failed to fetch metrics");
            return res.json();
        },
        staleTime: 30_000, // 30 segundos
        refetchOnWindowFocus: false,
    });

    // Buscar contagem de hoje separadamente (endpoint leve)
    const { data: todayStats, isLoading: isLoadingToday } = useQuery<AppointmentsStatsResponse>({
        queryKey: ["/api/dashboard/appointments-stats"],
        queryFn: async () => {
            const res = await fetch("/api/dashboard/appointments-stats", {
                headers: getAuthHeaders(),
            });
            if (!res.ok) throw new Error("Failed to fetch today stats");
            return res.json();
        },
        staleTime: 30_000,
        refetchOnWindowFocus: false,
    });

    const isLoading = isLoadingMetrics || isLoadingToday;

    // Extrair contagens do breakdown
    const getCountByStatus = (status: string): number => {
        return metricsData?.breakdown?.find(b => b.status === status)?.count || 0;
    };

    const completedCount = getCountByStatus("concluido");
    const cancelledCount = getCountByStatus("cancelado");
    const totalCount = metricsData?.totalCount || 0;

    const stats = [
        {
            label: "Agendamentos Hoje",
            value: todayStats?.todayAppointments || 0,
            icon: CalendarDays,
            color: "text-blue-600 dark:text-blue-400",
            bgColor: "bg-blue-50 dark:bg-blue-900/20",
            borderColor: "border-blue-100 dark:border-blue-800",
        },
        {
            label: "Concluídos no Período",
            value: completedCount,
            icon: CalendarCheck,
            color: "text-green-600 dark:text-green-400",
            bgColor: "bg-green-50 dark:bg-green-900/20",
            borderColor: "border-green-100 dark:border-green-800",
        },
        {
            label: "Cancelados no Período",
            value: cancelledCount,
            icon: CalendarX,
            color: "text-red-600 dark:text-red-400",
            bgColor: "bg-red-50 dark:bg-red-900/20",
            borderColor: "border-red-100 dark:border-red-800",
        },
        {
            label: "Total no Período",
            value: totalCount,
            icon: Calendar,
            color: "text-gray-600 dark:text-zinc-400",
            bgColor: "bg-gray-50 dark:bg-zinc-800",
            borderColor: "border-gray-100 dark:border-zinc-700",
        },
    ];

    const cardRef = useRef<HTMLDivElement>(null);

    const handleShare = async () => {
        if (cardRef.current) {
            await captureAndShare(cardRef.current, `estatisticas-operacao.png`);
        }
    };

    return (
        <TooltipProvider>
            <Card ref={cardRef}>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between text-lg">
                        <div className="flex items-center gap-2">
                            <CalendarDays className="w-5 h-5 text-blue-600" />
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className="cursor-help border-b border-dashed border-gray-400">
                                        Estatísticas de Agendamentos
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                    <p>
                                        Resumo dos agendamentos no período selecionado.
                                        Inclui totais de hoje, concluídos, cancelados e total geral.
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                        <Button variant="ghost" size="icon" onClick={handleShare} className="h-8 w-8">
                            <Share2 className="w-4 h-4 text-gray-500" />
                        </Button>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-gray-400 dark:text-zinc-600" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {stats.map((stat) => {
                                const Icon = stat.icon;
                                return (
                                    <div
                                        key={stat.label}
                                        className={`p-4 rounded-lg border ${stat.bgColor} ${stat.borderColor}`}
                                    >
                                        <div className="flex items-center gap-2 mb-2">
                                            <Icon className={`w-4 h-4 ${stat.color}`} />
                                            <span className={`text-xs font-medium ${stat.color}`}>
                                                {stat.label}
                                            </span>
                                        </div>
                                        <p className={`text-2xl font-bold ${stat.color}`}>
                                            {stat.value}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </TooltipProvider>
    );
}
