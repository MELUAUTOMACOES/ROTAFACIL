import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Navigation, Clock, MapPin, ChevronRight, Users } from "lucide-react";
import { Link } from "wouter";

interface RouteInProgress {
    id: string;
    title: string;
    responsibleType: "technician" | "team";
    responsibleName: string;
    totalStops: number;
    completedStops: number;
    remainingStops: number;
    startedAt: string;
    elapsedMinutes: number;
    estimatedDurationMinutes: number;
}

export function RoutesInProgressCard() {
    const { data: routes = [], isLoading } = useQuery<RouteInProgress[]>({
        queryKey: ["/api/dashboard/routes-in-progress"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/dashboard/routes-in-progress");
            return res.json();
        },
        refetchInterval: 60000, // Atualizar a cada minuto
    });

    const formatElapsedTime = (minutes: number) => {
        if (minutes < 60) return `${minutes}min`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}h${mins > 0 ? ` ${mins}min` : ""}`;
    };

    return (
        <TooltipProvider>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Navigation className="w-5 h-5 text-blue-600" />
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="cursor-help border-b border-dashed border-gray-400">Rotas em Andamento</span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                                <p>Rotas confirmadas que já foram iniciadas pelo prestador, mas ainda não foram finalizadas. Atualiza a cada minuto.</p>
                            </TooltipContent>
                        </Tooltip>
                        {routes.length > 0 && (
                            <Badge variant="secondary" className="ml-2">
                                {routes.length}
                            </Badge>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <p className="text-sm text-gray-500">Carregando...</p>
                    ) : routes.length === 0 ? (
                        <div className="text-center py-4">
                            <Navigation className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">Nenhuma rota em andamento</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {routes.slice(0, 4).map((route) => {
                                const progress = route.totalStops > 0
                                    ? Math.round((route.completedStops / route.totalStops) * 100)
                                    : 0;

                                return (
                                    <div
                                        key={route.id}
                                        className="border-l-4 border-blue-500 pl-3 py-2 bg-blue-50/50 rounded-r"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <Users className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                                    <p className="font-medium text-sm truncate">
                                                        {route.responsibleName}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <span className="text-xs text-gray-600 flex items-center gap-1">
                                                        <MapPin className="w-3 h-3" />
                                                        {route.completedStops}/{route.totalStops} paradas
                                                    </span>
                                                    <span className="text-xs text-gray-600 flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {formatElapsedTime(route.elapsedMinutes)}
                                                    </span>
                                                </div>
                                            </div>
                                            <Badge
                                                variant={progress >= 75 ? "default" : "secondary"}
                                                className="text-xs"
                                            >
                                                {progress}%
                                            </Badge>
                                        </div>
                                        {/* Progress bar */}
                                        <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-blue-500 transition-all duration-300"
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                            {routes.length > 4 && (
                                <p className="text-xs text-gray-500 text-center pt-1">
                                    + {routes.length - 4} outras rotas
                                </p>
                            )}
                            <Link href="/prestadores">
                                <Button variant="outline" size="sm" className="w-full mt-2">
                                    Ver Prestadores
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
