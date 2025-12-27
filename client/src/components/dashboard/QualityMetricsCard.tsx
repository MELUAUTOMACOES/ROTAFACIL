import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle, XCircle, RefreshCw, PieChart } from "lucide-react";

interface ReasonBreakdown {
    reason: string;
    count: number;
    label: string;
}

interface QualityMetrics {
    totalFinalized: number;
    completed: number;
    notCompletedCount: number;
    notCompletedRate: number;
    reasonsBreakdown: ReasonBreakdown[];
    rescheduledCount: number;
    rescheduledRate: number;
    monthName: string;
}

export function QualityMetricsCard() {
    const { data, isLoading } = useQuery<QualityMetrics>({
        queryKey: ["/api/dashboard/quality-metrics"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/dashboard/quality-metrics");
            return res.json();
        },
    });

    // Simple donut chart using SVG
    const DonutChart = ({ completed, notCompleted }: { completed: number; notCompleted: number }) => {
        const total = completed + notCompleted;
        if (total === 0) return null;

        const completedPercent = (completed / total) * 100;
        const circumference = 2 * Math.PI * 40; // radius = 40
        const completedDash = (completedPercent / 100) * circumference;

        return (
            <div className="relative w-24 h-24">
                <svg className="w-full h-full transform -rotate-90">
                    {/* Background circle */}
                    <circle
                        cx="48"
                        cy="48"
                        r="40"
                        fill="none"
                        className="stroke-gray-200 dark:stroke-zinc-700"
                        strokeWidth="12"
                    />
                    {/* Completed segment */}
                    <circle
                        cx="48"
                        cy="48"
                        r="40"
                        fill="none"
                        stroke="#22c55e"
                        strokeWidth="12"
                        strokeDasharray={`${completedDash} ${circumference}`}
                        strokeLinecap="round"
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold text-gray-700">
                        {Math.round(completedPercent)}%
                    </span>
                </div>
            </div>
        );
    };

    return (
        <TooltipProvider>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <PieChart className="w-5 h-5 text-emerald-600" />
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="cursor-help border-b border-dashed border-gray-400">Qualidade</span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                                <p>Taxa de atendimentos concluídos vs não realizados no mês. Inclui breakdown por motivo e taxa de reagendamentos.</p>
                            </TooltipContent>
                        </Tooltip>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <p className="text-sm text-gray-500">Carregando...</p>
                    ) : !data || data.totalFinalized === 0 ? (
                        <div className="text-center py-4">
                            <CheckCircle className="h-10 w-10 text-gray-300 dark:text-zinc-600 mx-auto mb-2" />
                            <p className="text-sm text-gray-500 dark:text-zinc-500">Sem dados suficientes</p>
                            <p className="text-xs text-gray-400 dark:text-zinc-600 mt-1">
                                Finalize atendimentos para ver métricas
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Month label */}
                            <div className="text-sm text-gray-600 dark:text-zinc-400 capitalize text-center">
                                {data.monthName}
                            </div>

                            {/* Main Stats */}
                            <div className="flex items-center justify-around">
                                <DonutChart
                                    completed={data.completed}
                                    notCompleted={data.notCompletedCount}
                                />
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4 text-green-500" />
                                        <span className="text-sm text-gray-600 dark:text-zinc-400">
                                            {data.completed} concluídos
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <XCircle className="w-4 h-4 text-red-500" />
                                        <span className="text-sm text-gray-600 dark:text-zinc-400">
                                            {data.notCompletedCount} não realizados
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Reasons Breakdown */}
                            {data.reasonsBreakdown.length > 0 && (
                                <div className="pt-2 border-t">
                                    <p className="text-xs text-gray-500 mb-2">Motivos de não realização:</p>
                                    <div className="space-y-1">
                                        {data.reasonsBreakdown.slice(0, 3).map((reason, index) => (
                                            <div
                                                key={index}
                                                className="flex items-center justify-between text-xs"
                                            >
                                                <span className="text-gray-600 dark:text-zinc-400 truncate flex-1">
                                                    {reason.label}
                                                </span>
                                                <Badge variant="secondary" className="text-xs ml-2">
                                                    {reason.count}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Rescheduled Rate */}
                            <div className="flex items-center justify-between pt-2 border-t">
                                <div className="flex items-center gap-2">
                                    <RefreshCw className="w-4 h-4 text-blue-500" />
                                    <span className="text-sm text-gray-600 dark:text-zinc-400">Reagendamentos</span>
                                </div>
                                <Badge
                                    variant={data.rescheduledRate > 15 ? "destructive" : "secondary"}
                                >
                                    {data.rescheduledRate}%
                                </Badge>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </TooltipProvider>
    );
}
