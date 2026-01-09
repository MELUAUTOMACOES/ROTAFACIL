import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { normalizeItems } from "@/lib/normalize";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Navigation, Clock, MapPin, ChevronRight, Users, Eye, Route as RouteIcon, Loader2, CheckCircle2, Circle } from "lucide-react";
import { Link } from "wouter";
import { getAuthHeaders } from "@/lib/auth";

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

interface RouteStop {
    id: string;
    routeId: string;
    appointmentId: string;
    order: number;
    lat: number;
    lng: number;
    address: string;
    appointmentNumericId?: number | null;
    clientName?: string | null;
}

interface RouteDetail {
    route: {
        id: string;
        title: string;
        date: string;
        responsibleType: string;
        responsibleId: string;
        distanceTotal: number;
        durationTotal: number;
        stopsCount: number;
        status: string;
    };
    stops: RouteStop[];
}

export function RoutesInProgressCard() {
    const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

    const { data: routes = [], isLoading } = useQuery<RouteInProgress[]>({
        queryKey: ["/api/dashboard/routes-in-progress"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/dashboard/routes-in-progress");
            return res.json();
        },
        refetchInterval: 60000, // Atualizar a cada minuto
    });

    // Query para buscar detalhes da rota selecionada
    const { data: routeDetail, isLoading: isLoadingDetail } = useQuery<RouteDetail>({
        queryKey: ["/api/routes", selectedRouteId],
        queryFn: async () => {
            const res = await fetch(`/api/routes/${selectedRouteId}`, {
                headers: getAuthHeaders(),
            });
            if (!res.ok) throw new Error("Erro ao buscar detalhes da rota");
            return res.json();
        },
        enabled: !!selectedRouteId,
    });

    // Query para buscar agendamentos (para pegar status de execução) - normalizado
    const { data: appointmentsData } = useQuery({
        queryKey: ["/api/appointments"],
        queryFn: async () => {
            const res = await fetch("/api/appointments", {
                headers: getAuthHeaders(),
            });
            if (!res.ok) throw new Error("Erro ao buscar agendamentos");
            return res.json();
        },
        enabled: !!selectedRouteId,
        staleTime: 30_000, // 30 segundos
        refetchOnWindowFocus: false,
    });
    const appointments = normalizeItems<any>(appointmentsData);

    const formatElapsedTime = (minutes: number) => {
        if (minutes < 60) return `${minutes}min`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}h${mins > 0 ? ` ${mins}min` : ""}`;
    };

    const fmtKm = (m?: number) => (m && m > 0 ? `${(m / 1000).toFixed(1)} km` : "—");
    const fmtMin = (s?: number) => (s && s > 0 ? `${Math.round(s / 60)} min` : "—");

    // Obter informações de execução de uma parada
    const getStopExecutionInfo = (stop: RouteStop) => {
        const apptId = stop.appointmentNumericId;
        if (!apptId) return { status: null, startedAt: null, finishedAt: null };
        const apt = appointments.find((a: any) => Number(a.id) === apptId);
        return {
            status: apt?.executionStatus || null,
            startedAt: apt?.executionStartedAt || null,
            finishedAt: apt?.executionFinishedAt || null,
        };
    };

    // Determinar o status visual: Concluído > Em Andamento > Não Realizado > Pendente
    const getVisualStatus = (stop: RouteStop): "completed" | "in_progress" | "not_completed" | "pending" => {
        const { status, startedAt, finishedAt } = getStopExecutionInfo(stop);

        if (status === "concluido") return "completed";
        if (status?.startsWith("nao_realizado")) return "not_completed";
        if (startedAt && !finishedAt) return "in_progress";
        return "pending";
    };

    const getExecutionStatusLabel = (status: string | null) => {
        if (!status) return "Pendente";
        switch (status) {
            case "concluido": return "Concluído";
            case "nao_realizado_cliente_ausente": return "Ausente";
            case "nao_realizado_cliente_pediu_remarcacao": return "Remarcar";
            case "nao_realizado_problema_tecnico": return "Prob. Técnico";
            case "nao_realizado_endereco_incorreto": return "End. Incorreto";
            case "nao_realizado_cliente_recusou": return "Recusou";
            case "nao_realizado_falta_material": return "Falta Material";
            case "nao_realizado_outro": return "Outro";
            default: return "Pendente";
        }
    };

    const getExecutionStatusBadge = (stop: RouteStop) => {
        const visualStatus = getVisualStatus(stop);
        const { status } = getStopExecutionInfo(stop);

        switch (visualStatus) {
            case "completed":
                return <Badge className="bg-green-100 text-green-800 border-green-200 text-[10px]">Concluído</Badge>;
            case "in_progress":
                return <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[10px] animate-pulse">Em Andamento</Badge>;
            case "not_completed":
                return <Badge className="bg-red-100 text-red-800 border-red-200 text-[10px]">{getExecutionStatusLabel(status)}</Badge>;
            default:
                return <Badge className="bg-gray-100 text-gray-600 border-gray-200 text-[10px]">Pendente</Badge>;
        }
    };

    // Encontrar a rota selecionada na lista
    const selectedRouteInfo = routes.find(r => r.id === selectedRouteId);

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
                                        className="border-l-4 border-blue-500 pl-3 py-2 bg-blue-50/50 dark:bg-blue-900/20 rounded-r"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <Users className="w-4 h-4 text-gray-500 dark:text-zinc-500 flex-shrink-0" />
                                                    <p className="font-medium text-sm truncate">
                                                        {route.responsibleName}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <span className="text-xs text-gray-600 dark:text-zinc-400 flex items-center gap-1">
                                                        <MapPin className="w-3 h-3" />
                                                        {route.completedStops}/{route.totalStops} paradas
                                                    </span>
                                                    <span className="text-xs text-gray-600 dark:text-zinc-400 flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {formatElapsedTime(route.elapsedMinutes)}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {/* Botão de visualizar detalhes */}
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 w-7 p-0 hover:bg-blue-100 dark:hover:bg-blue-800"
                                                            onClick={() => setSelectedRouteId(route.id)}
                                                        >
                                                            <Eye className="w-4 h-4 text-blue-600" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>Ver detalhes da rota</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                                <Badge
                                                    variant={progress >= 75 ? "default" : "secondary"}
                                                    className="text-xs"
                                                >
                                                    {progress}%
                                                </Badge>
                                            </div>
                                        </div>
                                        {/* Progress bar */}
                                        <div className="mt-2 h-1.5 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden">
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

            {/* Modal de detalhes da rota */}
            <Dialog open={!!selectedRouteId} onOpenChange={(open) => !open && setSelectedRouteId(null)}>
                <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <RouteIcon className="w-5 h-5 text-blue-600" />
                            Detalhes da Rota
                        </DialogTitle>
                        <DialogDescription>
                            Visualização das entregas e status da rota em andamento
                        </DialogDescription>
                    </DialogHeader>

                    {isLoadingDetail ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                            <span className="ml-2 text-gray-500">Carregando detalhes...</span>
                        </div>
                    ) : routeDetail ? (
                        <div className="flex-1 overflow-hidden flex flex-col space-y-4">
                            {/* Informações resumidas */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-500">Responsável</span>
                                    <span className="font-medium text-sm">{selectedRouteInfo?.responsibleName}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-2">
                                        <RouteIcon className="w-4 h-4 text-blue-600 mx-auto mb-1" />
                                        <div className="text-xs text-gray-500">Distância</div>
                                        <div className="font-semibold text-sm text-blue-600">
                                            {fmtKm(routeDetail.route?.distanceTotal)}
                                        </div>
                                    </div>
                                    <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-2">
                                        <Clock className="w-4 h-4 text-green-600 mx-auto mb-1" />
                                        <div className="text-xs text-gray-500">Duração</div>
                                        <div className="font-semibold text-sm text-green-600">
                                            {fmtMin(routeDetail.route?.durationTotal)}
                                        </div>
                                    </div>
                                    <div className="bg-yellow-50 dark:bg-yellow-900/30 rounded-lg p-2">
                                        <MapPin className="w-4 h-4 text-yellow-600 mx-auto mb-1" />
                                        <div className="text-xs text-gray-500">Paradas</div>
                                        <div className="font-semibold text-sm text-yellow-600">
                                            {selectedRouteInfo?.completedStops}/{selectedRouteInfo?.totalStops}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            {/* Lista de paradas */}
                            <div className="flex-1 overflow-hidden flex flex-col">
                                <h4 className="font-semibold text-sm mb-2">Paradas da Rota</h4>
                                <ScrollArea className="flex-1 pr-2">
                                    <div className="space-y-2">
                                        {routeDetail.stops
                                            ?.slice()
                                            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                                            .map((stop) => {
                                                const visualStatus = getVisualStatus(stop);
                                                const isCompleted = visualStatus === "completed";
                                                const isInProgress = visualStatus === "in_progress";

                                                return (
                                                    <div
                                                        key={stop.id}
                                                        className={`flex items-start gap-3 p-3 rounded-lg ${isCompleted
                                                            ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                                                            : isInProgress
                                                                ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                                                                : "bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700"
                                                            }`}
                                                    >
                                                        {/* Número da ordem */}
                                                        <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${isCompleted
                                                            ? "bg-green-600 text-white"
                                                            : isInProgress
                                                                ? "bg-blue-600 text-white animate-pulse"
                                                                : "bg-burnt-yellow text-white"
                                                            }`}>
                                                            {isCompleted ? (
                                                                <CheckCircle2 className="w-4 h-4" />
                                                            ) : (
                                                                stop.order
                                                            )}
                                                        </div>

                                                        {/* Detalhes */}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div className="font-medium text-sm truncate">
                                                                    {stop.clientName || `Agendamento #${stop.appointmentNumericId || stop.appointmentId?.slice(0, 8)}`}
                                                                </div>
                                                                {getExecutionStatusBadge(stop)}
                                                            </div>
                                                            <div className="text-xs text-gray-600 dark:text-zinc-400 mt-1 line-clamp-2">
                                                                {stop.address}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </ScrollArea>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-500">
                            Não foi possível carregar os detalhes da rota.
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </TooltipProvider>
    );
}
