import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { BarChart3, TrendingUp, TrendingDown } from "lucide-react";

interface FuelCostEvolutionCardProps {
    vehicleIds?: number[];
    fuelTypes?: string[];
}

interface FuelStats {
    monthlyEvolution: { month: string; totalSpent: number; totalLiters: number }[];
}

const MONTH_NAMES: Record<string, string> = {
    "01": "Jan",
    "02": "Fev",
    "03": "Mar",
    "04": "Abr",
    "05": "Mai",
    "06": "Jun",
    "07": "Jul",
    "08": "Ago",
    "09": "Set",
    "10": "Out",
    "11": "Nov",
    "12": "Dez",
};

export function FuelCostEvolutionCard({ vehicleIds, fuelTypes }: FuelCostEvolutionCardProps) {
    const queryParams = new URLSearchParams();
    if (vehicleIds && vehicleIds.length > 0) {
        queryParams.set("vehicleIds", vehicleIds.join(","));
    }
    if (fuelTypes && fuelTypes.length > 0) {
        queryParams.set("fuelTypes", fuelTypes.join(","));
    }

    const { data: stats, isLoading } = useQuery<FuelStats>({
        queryKey: ["/api/dashboard/fuel-stats", vehicleIds, fuelTypes],
        queryFn: async () => {
            const url = `/api/dashboard/fuel-stats${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
            const res = await apiRequest("GET", url);
            return res.json();
        },
    });

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Evolução Mensal</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="animate-pulse h-40 bg-gray-200 dark:bg-zinc-700 rounded" />
                </CardContent>
            </Card>
        );
    }

    const monthlyData = stats?.monthlyEvolution || [];
    const maxSpent = Math.max(...monthlyData.map((m) => m.totalSpent), 1);

    // Calcular tendência (comparar último mês com penúltimo)
    const lastMonth = monthlyData[monthlyData.length - 1];
    const previousMonth = monthlyData[monthlyData.length - 2];
    const trend = lastMonth && previousMonth && previousMonth.totalSpent > 0
        ? ((lastMonth.totalSpent - previousMonth.totalSpent) / previousMonth.totalSpent) * 100
        : 0;

    const formatMonthLabel = (month: string) => {
        const [year, monthNum] = month.split("-");
        return `${MONTH_NAMES[monthNum] || monthNum}/${year.slice(2)}`;
    };

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-burnt-yellow" />
                        Evolução Mensal
                    </span>
                    {trend !== 0 && (
                        <span
                            className={`text-sm font-normal flex items-center gap-1 ${trend > 0 ? "text-red-600" : "text-green-600"
                                }`}
                        >
                            {trend > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                            {trend > 0 ? "+" : ""}
                            {trend.toFixed(0)}%
                        </span>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                {monthlyData.length === 0 || monthlyData.every((m) => m.totalSpent === 0) ? (
                    <div className="text-center py-6 text-gray-500 dark:text-zinc-500">
                        <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-50" />
                        <p>Sem dados de evolução</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {/* Simple bar chart */}
                        <div className="flex items-end justify-between gap-2 h-32">
                            {monthlyData.map((month) => {
                                const heightPercent = (month.totalSpent / maxSpent) * 100;
                                return (
                                    <div key={month.month} className="flex-1 flex flex-col items-center">
                                        <div className="w-full flex flex-col items-center justify-end h-24">
                                            {month.totalSpent > 0 && (
                                                <span className="text-xs text-gray-600 dark:text-zinc-400 mb-1">
                                                    R$ {month.totalSpent.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                                                </span>
                                            )}
                                            <div
                                                className="w-full bg-gradient-to-t from-burnt-yellow to-burnt-yellow-dark rounded-t transition-all"
                                                style={{ height: `${Math.max(heightPercent, 2)}%`, minHeight: month.totalSpent > 0 ? "8px" : "2px" }}
                                            />
                                        </div>
                                        <span className="text-xs text-gray-500 dark:text-zinc-500 mt-1">{formatMonthLabel(month.month)}</span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Totals summary */}
                        <div className="pt-3 border-t flex justify-between text-sm">
                            <div>
                                <span className="text-gray-500 dark:text-zinc-500">Total 6 meses:</span>
                                <span className="font-semibold ml-2">
                                    R$ {monthlyData.reduce((sum, m) => sum + m.totalSpent, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                            <div>
                                <span className="text-gray-500 dark:text-zinc-500">Litros:</span>
                                <span className="font-semibold ml-2">
                                    {monthlyData.reduce((sum, m) => sum + m.totalLiters, 0).toLocaleString("pt-BR", { minimumFractionDigits: 0 })} L
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
