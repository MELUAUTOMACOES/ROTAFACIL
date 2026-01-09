import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { normalizeItems } from "@/lib/normalize";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, Users, User, Loader2, TrendingDown, CheckCircle } from "lucide-react";

interface PendingReason {
    reason: string;
    label: string;
    count: number;
    percent: number;
}

interface ResponsibleBreakdown {
    id: number;
    name: string;
    type: "technician" | "team";
    count: number;
}

interface PendingReasonsData {
    total: number;
    reasons: PendingReason[];
    byResponsible: ResponsibleBreakdown[];
    resolutionRate: number;
    periodStart: string;
    periodEnd: string;
}

interface Technician {
    id: number;
    name: string;
}

interface Team {
    id: number;
    name: string;
}

interface PendingReasonsCardProps {
    technicians?: Technician[];
    teams?: Team[];
    startDate?: string;
    endDate?: string;
}

export function PendingReasonsCard({ technicians = [], teams = [], startDate, endDate }: PendingReasonsCardProps) {
    const [selectedFilter, setSelectedFilter] = useState<string>("all");

    // Parse filter value
    const getFilterParams = () => {
        if (selectedFilter === "all") return {};
        const [type, id] = selectedFilter.split(":");
        if (type === "tech") return { technicianId: id };
        if (type === "team") return { teamId: id };
        return {};
    };

    const filterParams = getFilterParams();
    const queryParams = new URLSearchParams();
    if (filterParams.technicianId) queryParams.append("technicianId", filterParams.technicianId);
    if (filterParams.teamId) queryParams.append("teamId", filterParams.teamId);
    if (startDate) queryParams.append("startDate", startDate);
    if (endDate) queryParams.append("endDate", endDate);
    const queryString = queryParams.toString();

    const { data, isLoading } = useQuery<PendingReasonsData>({
        queryKey: ["/api/dashboard/pending-reasons", selectedFilter, startDate, endDate],
        queryFn: async () => {
            const url = queryString
                ? `/api/dashboard/pending-reasons?${queryString}`
                : "/api/dashboard/pending-reasons";
            const res = await apiRequest("GET", url);
            return res.json();
        },
    });

    // Fetch technicians and teams if not provided
    const { data: techData } = useQuery({
        queryKey: ["/api/technicians"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/technicians");
            return res.json();
        },
        enabled: technicians.length === 0,
        staleTime: 2 * 60_000,
        refetchOnWindowFocus: false,
    });

    const { data: teamData } = useQuery({
        queryKey: ["/api/teams"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/teams");
            return res.json();
        },
        enabled: teams.length === 0,
        staleTime: 2 * 60_000,
        refetchOnWindowFocus: false,
    });

    const allTechnicians = technicians.length > 0 ? technicians : normalizeItems<Technician>(techData);
    const allTeams = teams.length > 0 ? teams : normalizeItems<Team>(teamData);

    const getReasonColor = (reason: string): string => {
        const colors: Record<string, string> = {
            "nao_realizado_cliente_ausente": "bg-yellow-500",
            "nao_realizado_cliente_pediu_remarcacao": "bg-blue-500",
            "nao_realizado_problema_tecnico": "bg-orange-500",
            "nao_realizado_endereco_incorreto": "bg-red-500",
            "nao_realizado_cliente_recusou": "bg-gray-500",
            "nao_realizado_falta_material": "bg-amber-500",
            "nao_realizado_outro": "bg-purple-500",
            "payment_pending": "bg-red-600", // 💰 Pendência de pagamento
        };
        return colors[reason] || "bg-gray-400 dark:bg-gray-600";
    };

    return (
        <TooltipProvider>
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <AlertTriangle className="w-5 h-5 text-orange-600" />
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className="cursor-help border-b border-dashed border-gray-400">
                                        Motivos de Pendências
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                    <p>
                                        Breakdown dos motivos de não-realização de atendimentos no mês.
                                        Use o filtro para ver por técnico ou equipe específica.
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                            {data && data.total > 0 && (
                                <Badge variant="destructive" className="ml-2">
                                    {data.total}
                                </Badge>
                            )}
                        </CardTitle>
                        <Select value={selectedFilter} onValueChange={setSelectedFilter}>
                            <SelectTrigger className="w-[180px] h-8 text-xs">
                                <SelectValue placeholder="Filtrar por..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos</SelectItem>
                                {allTeams.map((team) => (
                                    <SelectItem key={`team:${team.id}`} value={`team:${team.id}`}>
                                        <span className="flex items-center gap-1">
                                            <Users className="w-3 h-3" />
                                            {team.name}
                                        </span>
                                    </SelectItem>
                                ))}
                                {allTechnicians.map((tech) => (
                                    <SelectItem key={`tech:${tech.id}`} value={`tech:${tech.id}`}>
                                        <span className="flex items-center gap-1">
                                            <User className="w-3 h-3" />
                                            {tech.name}
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-gray-400 dark:text-zinc-600" />
                        </div>
                    ) : !data || data.total === 0 ? (
                        <div className="text-center py-4">
                            <CheckCircle className="h-10 w-10 text-green-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-500 dark:text-zinc-500">Nenhuma pendência no período</p>
                            <p className="text-xs text-gray-400 dark:text-zinc-600 mt-1">
                                Todos os atendimentos foram concluídos! 🎉
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Breakdown por motivo */}
                            <div className="space-y-2">
                                {data.reasons.map((reason) => (
                                    <div key={reason.reason} className="flex items-center gap-2">
                                        <div
                                            className={`w-3 h-3 rounded-full ${getReasonColor(reason.reason)}`}
                                        />
                                        <span className="flex-1 text-sm text-gray-700 dark:text-zinc-300 truncate">
                                            {reason.label}
                                        </span>
                                        <span className="text-sm font-medium text-gray-600 dark:text-zinc-400">
                                            {reason.count}
                                        </span>
                                        <Badge variant="secondary" className="text-xs min-w-[45px] justify-center">
                                            {reason.percent}%
                                        </Badge>
                                    </div>
                                ))}
                            </div>

                            {/* Barra visual de distribuição */}
                            <div className="h-3 rounded-full overflow-hidden flex bg-gray-200 dark:bg-zinc-700">
                                {data.reasons.map((reason) => (
                                    <div
                                        key={reason.reason}
                                        className={`${getReasonColor(reason.reason)} transition-all`}
                                        style={{ width: `${reason.percent}%` }}
                                        title={`${reason.label}: ${reason.percent}%`}
                                    />
                                ))}
                            </div>

                            {/* Taxa de resolução */}
                            <div className="flex items-center justify-between pt-2 border-t">
                                <span className="text-sm text-gray-600 dark:text-zinc-400">Taxa de resolução</span>
                                <Badge
                                    variant={data.resolutionRate >= 80 ? "default" : data.resolutionRate >= 50 ? "secondary" : "destructive"}
                                >
                                    {data.resolutionRate}%
                                </Badge>
                            </div>

                            {/* Top responsáveis com mais pendências (se não filtrado) */}
                            {selectedFilter === "all" && data.byResponsible.length > 0 && (
                                <div className="pt-2 border-t">
                                    <p className="text-xs text-gray-500 dark:text-zinc-500 mb-2">Maiores ocorrências:</p>
                                    <div className="space-y-1">
                                        {data.byResponsible.slice(0, 3).map((responsible) => (
                                            <div
                                                key={`${responsible.type}-${responsible.id}`}
                                                className="flex items-center justify-between text-xs"
                                            >
                                                <span className="flex items-center gap-1 text-gray-600 dark:text-zinc-400">
                                                    {responsible.type === "team" ? (
                                                        <Users className="w-3 h-3" />
                                                    ) : (
                                                        <User className="w-3 h-3" />
                                                    )}
                                                    {responsible.name}
                                                </span>
                                                <Badge variant="outline" className="text-xs">
                                                    {responsible.count}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </TooltipProvider>
    );
}
