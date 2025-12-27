import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp, TrendingDown, Clock, Target } from "lucide-react";

interface ProductivityMetrics {
    avgPlannedMinutes: number;
    avgRealMinutes: number;
    variationPercent: number;
    efficiencyStatus: "excellent" | "good" | "warning" | "critical";
    sampleSize: number;
    monthName: string;
}

const getStatusConfig = (status: string) => {
    switch (status) {
        case "excellent":
            return {
                label: "Excelente",
                color: "text-green-600 dark:text-green-300",
                bgColor: "bg-green-100 dark:bg-green-900/30",
                icon: <TrendingUp className="w-4 h-4" />,
            };
        case "good":
            return {
                label: "Bom",
                color: "text-blue-600 dark:text-blue-300",
                bgColor: "bg-blue-100 dark:bg-blue-900/30",
                icon: <TrendingUp className="w-4 h-4" />,
            };
        case "warning":
            return {
                label: "Atenção",
                color: "text-orange-600 dark:text-orange-300",
                bgColor: "bg-orange-100 dark:bg-orange-900/30",
                icon: <TrendingDown className="w-4 h-4" />,
            };
        case "critical":
            return {
                label: "Crítico",
                color: "text-red-600 dark:text-red-300",
                bgColor: "bg-red-100 dark:bg-red-900/30",
                icon: <TrendingDown className="w-4 h-4" />,
            };
        default:
            return {
                label: "--",
                color: "text-gray-600 dark:text-zinc-400",
                bgColor: "bg-gray-100 dark:bg-zinc-800",
                icon: null,
            };
    }
};

export function ProductivityCard() {
    const { data, isLoading } = useQuery<ProductivityMetrics>({
        queryKey: ["/api/dashboard/productivity-metrics"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/dashboard/productivity-metrics");
            return res.json();
        },
    });

    const statusConfig = getStatusConfig(data?.efficiencyStatus || "");

    return (
        <TooltipProvider>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Target className="w-5 h-5 text-purple-600" />
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="cursor-help border-b border-dashed border-gray-400">Produtividade</span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                                <p>Compara tempo real de execução (registrado pelo prestador) com tempo planejado (duração do serviço cadastrada). Média do mês atual.</p>
                            </TooltipContent>
                        </Tooltip>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <p className="text-sm text-gray-500">Carregando...</p>
                    ) : !data || data.sampleSize === 0 ? (
                        <div className="text-center py-4">
                            <Clock className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">Sem dados suficientes</p>
                            <p className="text-xs text-gray-400 mt-1">
                                Finalize atendimentos para ver métricas
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Status Badge */}
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600 dark:text-zinc-400 capitalize">
                                    {data.monthName}
                                </span>
                                <Badge className={`${statusConfig.bgColor} ${statusConfig.color}`}>
                                    {statusConfig.icon}
                                    <span className="ml-1">{statusConfig.label}</span>
                                </Badge>
                            </div>

                            {/* Comparison Bars */}
                            <div className="space-y-3">
                                {/* Tempo Planejado */}
                                <div>
                                    <div className="flex justify-between text-xs text-gray-600 dark:text-zinc-400 mb-1">
                                        <span>Tempo Planejado</span>
                                        <span className="font-medium">{data.avgPlannedMinutes} min</span>
                                    </div>
                                    <div className="h-2 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gray-400 rounded-full"
                                            style={{ width: "100%" }}
                                        />
                                    </div>
                                </div>

                                {/* Tempo Real */}
                                <div>
                                    <div className="flex justify-between text-xs text-gray-600 dark:text-zinc-400 mb-1">
                                        <span>Tempo Real</span>
                                        <span className="font-medium">{data.avgRealMinutes} min</span>
                                    </div>
                                    <div className="h-2 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${data.variationPercent <= 0
                                                ? "bg-green-500"
                                                : data.variationPercent <= 15
                                                    ? "bg-blue-500"
                                                    : data.variationPercent <= 25
                                                        ? "bg-orange-500"
                                                        : "bg-red-500"
                                                }`}
                                            style={{
                                                width: `${Math.min(
                                                    (data.avgRealMinutes / data.avgPlannedMinutes) * 100,
                                                    150
                                                )}%`,
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Variação */}
                            <div className="flex items-center justify-between pt-2 border-t">
                                <span className="text-sm text-gray-600 dark:text-zinc-400">Variação</span>
                                <div className={`flex items-center gap-1 font-medium ${statusConfig.color}`}>
                                    {data.variationPercent >= 0 ? (
                                        <TrendingUp className="w-4 h-4" />
                                    ) : (
                                        <TrendingDown className="w-4 h-4" />
                                    )}
                                    <span>
                                        {data.variationPercent >= 0 ? "+" : ""}
                                        {data.variationPercent}%
                                    </span>
                                </div>
                            </div>

                            {/* Sample size */}
                            <p className="text-xs text-gray-400 text-center">
                                Baseado em {data.sampleSize} atendimentos
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </TooltipProvider>
    );
}
