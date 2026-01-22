import { useQuery } from "@tanstack/react-query";
import { useAuth, getAuthHeaders } from "@/lib/auth";
import { buildApiUrl } from "@/lib/api-config";
import { useLocation } from "wouter";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    FileSearch,
    Filter,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    User,
    Clock,
    Activity
} from "lucide-react";

// Mapeamento de features e ações para português
const FEATURE_NAMES: Record<string, string> = {
    clients: "Clientes",
    appointments: "Agendamentos",
    vehicles: "Veículos",
    technicians: "Técnicos",
    teams: "Equipes",
    services: "Serviços",
    maintenances: "Manutenções",
    routes: "Rotas",
    checklists: "Checklists",
    users: "Usuários",
    business_rules: "Regras de Negócio",
    auth: "Autenticação",
    find_date: "Busca de Data",
};

const ACTION_NAMES: Record<string, string> = {
    create: "Criou",
    update: "Atualizou",
    delete: "Excluiu",
    login: "Login",
    logout: "Logout",
    optimize: "Otimizou",
    confirm: "Confirmou",
    finalize: "Finalizou",
    cancel: "Cancelou",
    search: "Buscou",
};

const ACTION_COLORS: Record<string, string> = {
    create: "bg-green-100 text-green-800",
    update: "bg-blue-100 text-blue-800",
    delete: "bg-red-100 text-red-800",
    login: "bg-purple-100 text-purple-800",
    logout: "bg-gray-100 text-gray-800",
    optimize: "bg-yellow-100 text-yellow-800",
    confirm: "bg-teal-100 text-teal-800",
    finalize: "bg-indigo-100 text-indigo-800",
    cancel: "bg-orange-100 text-orange-800",
    search: "bg-cyan-100 text-cyan-800",
};

interface AuditLog {
    id: number;
    userId: number;
    companyId: number | null;
    userName: string | null;
    feature: string;
    action: string;
    resourceId: string | null;
    description: string | null;
    metadata: any;
    ipAddress: string | null;
    createdAt: string;
}

interface AuditResponse {
    data: AuditLog[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export default function AdminAudit() {
    const { user } = useAuth();
    const [, navigate] = useLocation();

    // State para filtros
    const [page, setPage] = useState(1);
    const [feature, setFeature] = useState<string>("all");
    const [action, setAction] = useState<string>("all");
    const [startDate, setStartDate] = useState<string>("");
    const [endDate, setEndDate] = useState<string>("");

    // Verificar se é admin
    if (user?.role !== "admin") {
        navigate("/");
        return null;
    }

    // Query para buscar auditoria
    const { data, isLoading, refetch } = useQuery<AuditResponse>({
        queryKey: ["admin-audit", page, feature, action, startDate, endDate],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.set("page", page.toString());
            params.set("limit", "25");
            if (feature && feature !== "all") params.set("feature", feature);
            if (action && action !== "all") params.set("action", action);
            if (startDate) params.set("startDate", startDate);
            if (endDate) params.set("endDate", endDate);

            const response = await fetch(buildApiUrl(`/api/admin/audit?${params.toString()}`), {
                headers: getAuthHeaders(),
            });
            if (!response.ok) throw new Error("Erro ao buscar auditoria");
            return response.json();
        },
    });

    // Query para estatísticas
    const { data: stats } = useQuery({
        queryKey: ["admin-audit-stats"],
        queryFn: async () => {
            const response = await fetch(buildApiUrl("/api/admin/audit/stats"), {
                headers: getAuthHeaders(),
            });
            if (!response.ok) throw new Error("Erro ao buscar estatísticas");
            return response.json();
        },
    });

    const clearFilters = () => {
        setFeature("all");
        setAction("all");
        setStartDate("");
        setEndDate("");
        setPage(1);
    };

    return (
        <div className="container mx-auto py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <FileSearch className="h-8 w-8 text-primary" />
                    <div>
                        <h1 className="text-2xl font-bold">Auditoria do Sistema</h1>
                        <p className="text-muted-foreground">
                            Histórico de todas as ações realizadas na empresa
                        </p>
                    </div>
                </div>
                <Button variant="outline" onClick={() => refetch()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Atualizar
                </Button>
            </div>

            {/* Cards de estatísticas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Ações Hoje</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.actionsToday || 0}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total de Registros</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data?.pagination.total || 0}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Retenção</CardTitle>
                        <User className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">30 dias</div>
                    </CardContent>
                </Card>
            </div>

            {/* Filtros */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Filter className="h-5 w-5" />
                        Filtros
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <Select value={feature} onValueChange={setFeature}>
                            <SelectTrigger>
                                <SelectValue placeholder="Funcionalidade" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas</SelectItem>
                                {Object.entries(FEATURE_NAMES).map(([key, name]) => (
                                    <SelectItem key={key} value={key}>{name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={action} onValueChange={setAction}>
                            <SelectTrigger>
                                <SelectValue placeholder="Ação" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas</SelectItem>
                                {Object.entries(ACTION_NAMES).map(([key, name]) => (
                                    <SelectItem key={key} value={key}>{name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Input
                            type="date"
                            placeholder="Data início"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />

                        <Input
                            type="date"
                            placeholder="Data fim"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />

                        <Button variant="outline" onClick={clearFilters}>
                            Limpar Filtros
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Tabela de Auditoria */}
            <Card>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="p-6 space-y-4">
                            {[...Array(5)].map((_, i) => (
                                <Skeleton key={i} className="h-12 w-full" />
                            ))}
                        </div>
                    ) : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Data/Hora</TableHead>
                                        <TableHead>Usuário</TableHead>
                                        <TableHead>Funcionalidade</TableHead>
                                        <TableHead>Ação</TableHead>
                                        <TableHead>Recurso</TableHead>
                                        <TableHead>Descrição</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data?.data.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                                Nenhum registro de auditoria encontrado
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        data?.data.map((log) => (
                                            <TableRow key={log.id}>
                                                <TableCell className="whitespace-nowrap">
                                                    {format(new Date(log.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <User className="h-4 w-4 text-muted-foreground" />
                                                        {log.userName || `User #${log.userId}`}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline">
                                                        {FEATURE_NAMES[log.feature] || log.feature}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={ACTION_COLORS[log.action] || "bg-gray-100 text-gray-800"}>
                                                        {ACTION_NAMES[log.action] || log.action}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {log.resourceId ? `#${log.resourceId}` : "-"}
                                                </TableCell>
                                                <TableCell className="max-w-xs truncate">
                                                    {log.description || "-"}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>

                            {/* Paginação */}
                            {data && data.pagination.totalPages > 1 && (
                                <div className="flex items-center justify-between p-4 border-t">
                                    <p className="text-sm text-muted-foreground">
                                        Página {data.pagination.page} de {data.pagination.totalPages}
                                        ({data.pagination.total} registros)
                                    </p>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPage(page - 1)}
                                            disabled={page === 1}
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPage(page + 1)}
                                            disabled={page >= data.pagination.totalPages}
                                        >
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
