import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Fuel, TrendingUp, TrendingDown, DollarSign, Gauge, Droplets } from "lucide-react";

interface FuelMetricsCardProps {
    vehicleIds?: number[];
    fuelTypes?: string[];
    startDate?: string;
    endDate?: string;
}

interface FuelStats {
    totalSpent: number;
    totalLiters: number;
    avgPricePerLiter: number;
    costPerKm: number;
    avgKmPerLiter: number;
    totalRefuelings: number;
    spentVariation: number;
    litersVariation: number;
    byVehicle: { vehicleId: number; plate: string; model: string; totalSpent: number; totalLiters: number; kmPerLiter: number }[];
    monthlyEvolution: { month: string; totalSpent: number; totalLiters: number }[];
}

export function FuelMetricsCard({ vehicleIds, fuelTypes, startDate, endDate }: FuelMetricsCardProps) {
    const queryParams = new URLSearchParams();
    if (vehicleIds && vehicleIds.length > 0) {
        queryParams.set("vehicleIds", vehicleIds.join(","));
    }
    if (fuelTypes && fuelTypes.length > 0) {
        queryParams.set("fuelTypes", fuelTypes.join(","));
    }
    if (startDate) queryParams.set("startDate", startDate);
    if (endDate) queryParams.set("endDate", endDate);

    const { data: stats, isLoading } = useQuery<FuelStats>({
        queryKey: ["/api/dashboard/fuel-stats", vehicleIds, fuelTypes, startDate, endDate],
        queryFn: async () => {
            const url = `/api/dashboard/fuel-stats${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
            const res = await apiRequest("GET", url);
            return res.json();
        },
    });

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                    <Card key={i}>
                        <CardContent className="p-6">
                            <div className="animate-pulse">
                                <div className="h-4 bg-gray-200 dark:bg-zinc-700 rounded w-24 mb-2" />
                                <div className="h-8 bg-gray-200 dark:bg-zinc-700 rounded w-32" />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    const metrics = [
        {
            title: "Gasto do Mês",
            value: stats ? `R$ ${stats.totalSpent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "--",
            variation: stats?.spentVariation ?? 0,
            icon: DollarSign,
            iconColor: "text-green-600 dark:text-green-400",
            iconBg: "bg-green-50 dark:bg-green-900/20",
            tooltip: "Total gasto em combustível no mês atual",
        },
        {
            title: "Litros Consumidos",
            value: stats ? `${stats.totalLiters.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} L` : "--",
            variation: stats?.litersVariation ?? 0,
            icon: Droplets,
            iconColor: "text-blue-600 dark:text-blue-400",
            iconBg: "bg-blue-50 dark:bg-blue-900/20",
            tooltip: "Total de litros abastecidos no mês atual",
        },
        {
            title: "Eficiência Média",
            value: stats && stats.avgKmPerLiter > 0 ? `${stats.avgKmPerLiter.toFixed(1)} km/L` : "--",
            icon: Gauge,
            iconColor: "text-orange-600 dark:text-orange-400",
            iconBg: "bg-orange-50 dark:bg-orange-900/20",
            tooltip: "Média de km/L da frota selecionada (requer odômetro)",
        },
        {
            title: "Custo por Km",
            value: stats && stats.costPerKm > 0 ? `R$ ${stats.costPerKm.toFixed(2)}/km` : "--",
            icon: Fuel,
            iconColor: "text-purple-600 dark:text-purple-400",
            iconBg: "bg-purple-50 dark:bg-purple-900/20",
            tooltip: "Custo médio por km rodado (requer odômetro)",
        },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {metrics.map((metric) => (
                <Card key={metric.title}>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <p className="text-sm font-medium text-gray-600 dark:text-zinc-400 cursor-help border-b border-dashed border-gray-400">
                                            {metric.title}
                                        </p>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">
                                        <p>{metric.tooltip}</p>
                                    </TooltipContent>
                                </Tooltip>
                                <p className="text-2xl font-bold text-gray-900 dark:text-zinc-100 mt-1">{metric.value}</p>
                            </div>
                            <div className={`w-12 h-12 ${metric.iconBg} rounded-lg flex items-center justify-center`}>
                                <metric.icon className={`${metric.iconColor} h-6 w-6`} />
                            </div>
                        </div>
                        {metric.variation !== undefined && (
                            <div className="mt-3 flex items-center">
                                {metric.variation >= 0 ? (
                                    <TrendingUp className="h-4 w-4 text-red-600" />
                                ) : (
                                    <TrendingDown className="h-4 w-4 text-green-600" />
                                )}
                                <span
                                    className={`text-sm font-medium ml-1 ${metric.variation >= 0 ? "text-red-600" : "text-green-600"
                                        }`}
                                >
                                    {metric.variation >= 0 ? "+" : ""}
                                    {metric.variation}%
                                </span>
                                <span className="text-gray-600 dark:text-zinc-400 text-sm ml-2">vs. mês passado</span>
                            </div>
                        )}
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
