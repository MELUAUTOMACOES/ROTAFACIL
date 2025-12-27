import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { TrendingUp, TrendingDown, AlertTriangle, Car } from "lucide-react";

interface FuelEfficiencyCardProps {
    vehicleIds?: number[];
    fuelTypes?: string[];
}

interface FuelStats {
    byVehicle: { vehicleId: number; plate: string; model: string; totalSpent: number; totalLiters: number; kmPerLiter: number }[];
    avgKmPerLiter: number;
}

export function FuelEfficiencyCard({ vehicleIds, fuelTypes }: FuelEfficiencyCardProps) {
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
                    <CardTitle className="text-lg">Ranking de Eficiência</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="animate-pulse space-y-3">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-12 bg-gray-200 dark:bg-zinc-700 rounded" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Filtrar veículos com dados de eficiência (kmPerLiter > 0)
    const vehiclesWithEfficiency = (stats?.byVehicle || []).filter((v) => v.kmPerLiter > 0);
    const avgEfficiency = stats?.avgKmPerLiter || 0;

    // Top 3 melhores
    const topVehicles = vehiclesWithEfficiency.slice(0, 3);
    // 3 piores (ordem inversa)
    const bottomVehicles = [...vehiclesWithEfficiency].reverse().slice(0, 3);

    // Veículos com consumo atípico (±20% da média)
    const atypicalVehicles = vehiclesWithEfficiency.filter((v) => {
        if (avgEfficiency === 0) return false;
        const deviation = Math.abs(v.kmPerLiter - avgEfficiency) / avgEfficiency;
        return deviation > 0.2;
    });

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                    <Car className="h-5 w-5 text-burnt-yellow" />
                    Ranking de Eficiência
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {vehiclesWithEfficiency.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 dark:text-zinc-500">
                        <Car className="h-10 w-10 mx-auto mb-2 opacity-50" />
                        <p>Sem dados de eficiência</p>
                        <p className="text-xs">Requer odômetro em abastecimentos</p>
                    </div>
                ) : (
                    <>
                        {/* Melhores */}
                        <div>
                            <h4 className="text-sm font-medium text-green-700 flex items-center gap-1 mb-2">
                                <TrendingUp className="h-4 w-4" />
                                Mais Eficientes
                            </h4>
                            <div className="space-y-2">
                                {topVehicles.map((vehicle, index) => (
                                    <div
                                        key={vehicle.vehicleId}
                                        className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded-lg"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-green-700 dark:text-green-400 w-5">{index + 1}º</span>
                                            <div>
                                                <p className="text-sm font-medium">{vehicle.plate}</p>
                                                <p className="text-xs text-gray-500 dark:text-zinc-500">{vehicle.model}</p>
                                            </div>
                                        </div>
                                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">{vehicle.kmPerLiter.toFixed(1)} km/L</Badge>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Piores */}
                        {bottomVehicles.length > 0 && bottomVehicles[0].vehicleId !== topVehicles[topVehicles.length - 1]?.vehicleId && (
                            <div>
                                <h4 className="text-sm font-medium text-red-700 flex items-center gap-1 mb-2">
                                    <TrendingDown className="h-4 w-4" />
                                    Menos Eficientes
                                </h4>
                                <div className="space-y-2">
                                    {bottomVehicles.map((vehicle, index) => (
                                        <div
                                            key={vehicle.vehicleId}
                                            className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-900/20 rounded-lg"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-red-700 dark:text-red-400 w-5">{vehiclesWithEfficiency.length - index}º</span>
                                                <div>
                                                    <p className="text-sm font-medium">{vehicle.plate}</p>
                                                    <p className="text-xs text-gray-500 dark:text-zinc-500">{vehicle.model}</p>
                                                </div>
                                            </div>
                                            <Badge className="bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300">{vehicle.kmPerLiter.toFixed(1)} km/L</Badge>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Alertas de consumo atípico */}
                        {atypicalVehicles.length > 0 && (
                            <div className="pt-2 border-t">
                                <h4 className="text-sm font-medium text-orange-700 dark:text-orange-400 flex items-center gap-1 mb-2">
                                    <AlertTriangle className="h-4 w-4" />
                                    Consumo Atípico ({atypicalVehicles.length})
                                </h4>
                                <p className="text-xs text-gray-500 dark:text-zinc-500">
                                    Veículos com eficiência ±20% da média ({avgEfficiency.toFixed(1)} km/L)
                                </p>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
