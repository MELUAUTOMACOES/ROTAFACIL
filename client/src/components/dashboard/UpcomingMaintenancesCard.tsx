import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Wrench, ChevronRight, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "wouter";

export function UpcomingMaintenancesCard() {
    const { data: upcomingMaintenances = [], isLoading } = useQuery({
        queryKey: ["/api/dashboard/upcoming-maintenances"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/dashboard/upcoming-maintenances");
            return res.json();
        },
    });

    return (
        <TooltipProvider>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Wrench className="w-5 h-5 text-blue-600" />
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="cursor-help border-b border-dashed border-gray-400">Próximas Manutenções</span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                                <p>Manutenções preventivas agendadas para os próximos 30 dias, ordenadas por data mais próxima.</p>
                            </TooltipContent>
                        </Tooltip>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <p className="text-sm text-gray-500">Carregando...</p>
                    ) : upcomingMaintenances.length === 0 ? (
                        <div className="text-center py-4">
                            <p className="text-sm text-gray-500">Nenhuma manutenção agendada</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {upcomingMaintenances.slice(0, 5).map((maintenance: any) => (
                                <div
                                    key={maintenance.id}
                                    className="flex items-center justify-between border-l-4 border-blue-500 pl-3 py-2 rounded-r hover:bg-blue-50 transition-colors"
                                >
                                    <div className="flex-1">
                                        <p className="font-medium text-sm">
                                            #{maintenance.id} - {maintenance.vehicle.plate}
                                        </p>
                                        <p className="text-xs text-gray-600">
                                            {maintenance.vehicle.brand} {maintenance.vehicle.model}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Calendar className="w-3 h-3 text-gray-500" />
                                            <p className="text-xs text-gray-500">
                                                {format(new Date(maintenance.scheduledDate), "dd/MM/yyyy", { locale: ptBR })}
                                                {maintenance.location && ` • ${maintenance.location}`}
                                            </p>
                                        </div>
                                        {maintenance.description && (
                                            <p className="text-xs text-gray-600 mt-1 line-clamp-1">
                                                {maintenance.description}
                                            </p>
                                        )}
                                    </div>
                                    <Link href={`/vehicles?tab=maintenances&id=${maintenance.id}`}>
                                        <Button variant="ghost" size="sm">
                                            <ChevronRight className="w-4 h-4" />
                                        </Button>
                                    </Link>
                                </div>
                            ))}
                            {upcomingMaintenances.length > 5 && (
                                <p className="text-xs text-gray-500 text-center pt-2">
                                    + {upcomingMaintenances.length - 5} outras manutenções
                                </p>
                            )}
                            <Link href="/vehicles?tab=maintenances">
                                <Button variant="outline" size="sm" className="w-full mt-2">
                                    Ver Todas as Manutenções
                                    <ChevronRight className="w-4 h-4 ml-2" />
                                </Button>
                            </Link>
                        </div>
                    )}
                </CardContent>
            </Card>
        </TooltipProvider>
    );
}
