import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DollarSign, Loader2 } from "lucide-react";

interface StatusBreakdown {
    status: string;
    label: string;
    count: number;
    revenue: number;
    percent: number;
    color: string;
}

interface FinancialMetrics {
    totalRevenue: number;
    totalCount: number;
    breakdown: StatusBreakdown[];
}

interface FinancialMetricsCardProps {
    technicianId?: number;
    teamId?: number;
    startDate?: string;
    endDate?: string;
}

export function FinancialMetricsCard({ technicianId, teamId, startDate, endDate }: FinancialMetricsCardProps) {
    const queryParams = new URLSearchParams();
    if (technicianId) queryParams.append("technicianId", String(technicianId));
    if (teamId) queryParams.append("teamId", String(teamId));
    if (startDate) queryParams.append("startDate", startDate);
    if (endDate) queryParams.append("endDate", endDate);
    const queryString = queryParams.toString();

    const { data, isLoading } = useQuery<FinancialMetrics>({
        queryKey: ["/api/dashboard/financial-metrics-v2", technicianId, teamId, startDate, endDate],
        queryFn: async () => {
            const url = queryString
                ? `/api/dashboard/financial-metrics-v2?${queryString}`
                : "/api/dashboard/financial-metrics-v2";
            const res = await apiRequest("GET", url);
            return res.json();
        },
    });

    const formatCurrency = (value: number) => {
        return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    };

    // Simple pie chart using SVG
    const PieChart = ({ breakdown }: { breakdown: StatusBreakdown[] }) => {
        const itemsWithData = breakdown.filter(b => b.count > 0);
        const total = itemsWithData.reduce((sum, b) => sum + b.count, 0);
        if (total === 0) return null;

        const size = 120;
        const radius = 45;
        const cx = size / 2;
        const cy = size / 2;

        // Special case: only one category = full circle
        if (itemsWithData.length === 1) {
            return (
                <div className="flex flex-col items-center">
                    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                        <circle
                            cx={cx}
                            cy={cy}
                            r={radius}
                            fill={itemsWithData[0].color}
                            stroke="white"
                            strokeWidth="2"
                        />
                    </svg>
                    {/* Legend */}
                    <div className="flex flex-wrap gap-2 mt-2 justify-center">
                        <div className="flex items-center gap-1 text-xs">
                            <div
                                className="w-3 h-3 rounded-sm"
                                style={{ backgroundColor: itemsWithData[0].color }}
                            />
                            <span className="text-gray-600">{itemsWithData[0].label}</span>
                        </div>
                    </div>
                </div>
            );
        }

        let cumulativePercent = 0;

        const getCoordinatesForPercent = (percent: number) => {
            const x = Math.cos(2 * Math.PI * percent);
            const y = Math.sin(2 * Math.PI * percent);
            return [x, y];
        };

        return (
            <div className="flex flex-col items-center">
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                    {itemsWithData.map((item, index) => {
                        const percent = item.count / total;
                        const [startX, startY] = getCoordinatesForPercent(cumulativePercent);
                        cumulativePercent += percent;
                        const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
                        const largeArcFlag = percent > 0.5 ? 1 : 0;

                        const pathData = [
                            `M ${cx} ${cy}`,
                            `L ${cx + startX * radius} ${cy + startY * radius}`,
                            `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${cx + endX * radius} ${cy + endY * radius}`,
                            `Z`
                        ].join(' ');

                        return (
                            <path
                                key={index}
                                d={pathData}
                                fill={item.color}
                                stroke="white"
                                strokeWidth="2"
                            />
                        );
                    })}
                </svg>
                {/* Legend */}
                <div className="flex flex-wrap gap-2 mt-2 justify-center">
                    {breakdown.filter(b => b.count > 0).map((item, index) => (
                        <div key={index} className="flex items-center gap-1 text-xs">
                            <div
                                className="w-3 h-3 rounded-sm"
                                style={{ backgroundColor: item.color }}
                            />
                            <span className="text-gray-600">{item.label}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <TooltipProvider>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <DollarSign className="w-5 h-5 text-green-600" />
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="cursor-help border-b border-dashed border-gray-400">
                                    Métricas Financeiras
                                </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                                <p>
                                    Receita total esperada e breakdown por status de agendamento no período selecionado.
                                    Baseado nos preços dos serviços cadastrados.
                                </p>
                            </TooltipContent>
                        </Tooltip>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                        </div>
                    ) : !data || data.totalCount === 0 ? (
                        <div className="text-center py-4">
                            <DollarSign className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">Sem agendamentos no período</p>
                            <p className="text-xs text-gray-400 mt-1">
                                Selecione outro período ou verifique os filtros
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Total Expected Revenue */}
                            <div className="text-center p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
                                <p className="text-sm text-blue-700 font-medium mb-1">Receita Total Esperada</p>
                                <p className="text-3xl font-bold text-blue-800">
                                    {formatCurrency(data.totalRevenue)}
                                </p>
                                <p className="text-xs text-blue-600 mt-1">
                                    {data.totalCount} agendamento{data.totalCount !== 1 ? "s" : ""} no período
                                </p>
                            </div>

                            {/* Pie Chart and Status Breakdown Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {/* Pie Chart */}
                                <div className="flex items-center justify-center">
                                    <PieChart breakdown={data.breakdown} />
                                </div>

                                {/* Status Breakdown Cards */}
                                <div className="space-y-2">
                                    {data.breakdown.map((item) => (
                                        <div
                                            key={item.status}
                                            className="flex items-center justify-between p-3 rounded-lg border"
                                            style={{
                                                backgroundColor: `${item.color}10`,
                                                borderColor: `${item.color}30`
                                            }}
                                        >
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="w-3 h-3 rounded-full"
                                                    style={{ backgroundColor: item.color }}
                                                />
                                                <span className="text-sm font-medium text-gray-700">
                                                    {item.label}
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-bold" style={{ color: item.color }}>
                                                    {formatCurrency(item.revenue)}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {item.count} ({item.percent}%)
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </TooltipProvider>
    );
}
