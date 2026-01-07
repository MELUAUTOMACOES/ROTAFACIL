import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
    BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { getAuthHeaders } from "@/lib/auth";
import { ArrowLeft, Users, Building2, Activity, TrendingUp, BarChart3, Calendar } from "lucide-react";
import Layout from "@/components/Layout";

type PeriodType = "7d" | "30d" | "90d" | "365d";

interface MetricsOverview {
    totalUsers: number;
    totalCompanies: number;
    totalActionsToday: number;
    totalActionsWeek: number;
}

interface TopFeature {
    feature: string;
    action: string;
    count: number;
}

interface UserActivity {
    date: string;
    activeUsers: number;
    totalActions: number;
}

// Labels amigáveis para features
const featureLabels: Record<string, string> = {
    appointments: "Agendamentos",
    clients: "Clientes",
    technicians: "Técnicos",
    teams: "Equipes",
    vehicles: "Veículos",
    routes: "Rotas",
    find_date: "Buscar Data",
    dashboard: "Dashboard",
    services: "Serviços",
    checklists: "Checklists",
    maintenances: "Manutenções"
};

// Labels para actions
const actionLabels: Record<string, string> = {
    create: "Criar",
    update: "Atualizar",
    delete: "Excluir",
    list: "Listar",
    view: "Visualizar",
    finalize: "Finalizar",
    optimize: "Otimizar",
    use: "Usar"
};

export default function AdminMetrics() {
    const { user } = useAuth();
    const [, navigate] = useLocation();
    const [period, setPeriod] = useState<PeriodType>("30d");

    // Redireciona se não for superadmin
    // Redireciona se não for superadmin (verifica flag OU email)
    const isSuperAdmin = user?.isSuperAdmin || user?.email === 'lucaspmastaler@gmail.com';

    if (!isSuperAdmin) {
        navigate("/");
        return null;
    }

    // Buscar overview
    const { data: overview, isLoading: loadingOverview } = useQuery<MetricsOverview>({
        queryKey: ["metrics-overview"],
        queryFn: async () => {
            const res = await fetch("/api/admin/metrics/overview", { headers: getAuthHeaders() });
            if (!res.ok) throw new Error("Erro ao buscar overview");
            return res.json();
        },
    });

    // Buscar top features
    const { data: topFeatures, isLoading: loadingTopFeatures } = useQuery<TopFeature[]>({
        queryKey: ["metrics-top-features", period],
        queryFn: async () => {
            const res = await fetch(`/api/admin/metrics/top-features?period=${period}&limit=15`, { headers: getAuthHeaders() });
            if (!res.ok) throw new Error("Erro ao buscar top features");
            return res.json();
        },
    });

    // Buscar atividade por dia
    const { data: usersActivity, isLoading: loadingActivity } = useQuery<UserActivity[]>({
        queryKey: ["metrics-users-activity", period],
        queryFn: async () => {
            const res = await fetch(`/api/admin/metrics/users-activity?period=${period}`, { headers: getAuthHeaders() });
            if (!res.ok) throw new Error("Erro ao buscar atividade");
            return res.json();
        },
    });

    // Formatar dados para os gráficos
    const formattedTopFeatures = (topFeatures || []).map(f => ({
        ...f,
        label: `${featureLabels[f.feature] || f.feature} / ${actionLabels[f.action] || f.action}`,
        featureLabel: featureLabels[f.feature] || f.feature,
        actionLabel: actionLabels[f.action] || f.action,
    }));

    const formattedActivity = (usersActivity || []).map(a => ({
        ...a,
        dateFormatted: new Date(a.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    }));

    const periodOptions = [
        { value: "7d", label: "Últimos 7 dias" },
        { value: "30d", label: "Últimos 30 dias" },
        { value: "90d", label: "Últimos 90 dias" },
        { value: "365d", label: "Último ano" },
    ];

    return (
        <Layout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">📊 Métricas do Sistema</h1>
                        <p className="text-muted-foreground">
                            Acompanhe o uso das funcionalidades pelos usuários
                        </p>
                    </div>

                    {/* Filtro de período */}
                    <Select value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Período" />
                        </SelectTrigger>
                        <SelectContent>
                            {periodOptions.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Cards de Overview */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {loadingOverview ? "..." : overview?.totalUsers || 0}
                            </div>
                            <p className="text-xs text-muted-foreground">Usuários cadastrados</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total de Empresas</CardTitle>
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {loadingOverview ? "..." : overview?.totalCompanies || 0}
                            </div>
                            <p className="text-xs text-muted-foreground">Empresas ativas</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Ações Hoje</CardTitle>
                            <Activity className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {loadingOverview ? "..." : overview?.totalActionsToday || 0}
                            </div>
                            <p className="text-xs text-muted-foreground">Ações realizadas hoje</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Ações na Semana</CardTitle>
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {loadingOverview ? "..." : overview?.totalActionsWeek || 0}
                            </div>
                            <p className="text-xs text-muted-foreground">Últimos 7 dias</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Gráficos */}
                <Tabs defaultValue="activity" className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="activity" className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" /> Atividade por Dia
                        </TabsTrigger>
                        <TabsTrigger value="features" className="flex items-center gap-2">
                            <BarChart3 className="h-4 w-4" /> Top Funcionalidades
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="activity">
                        <Card>
                            <CardHeader>
                                <CardTitle>Atividade de Usuários</CardTitle>
                                <CardDescription>
                                    Número de usuários ativos e ações por dia no período selecionado
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-4">
                                {loadingActivity ? (
                                    <div className="h-[400px] flex items-center justify-center">Carregando...</div>
                                ) : formattedActivity.length === 0 ? (
                                    <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                                        Nenhum dado disponível para o período selecionado
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height={400}>
                                        <LineChart data={formattedActivity}>
                                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                            <XAxis dataKey="dateFormatted" className="text-xs" />
                                            <YAxis yAxisId="left" className="text-xs" />
                                            <YAxis yAxisId="right" orientation="right" className="text-xs" />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: "hsl(var(--background))",
                                                    border: "1px solid hsl(var(--border))",
                                                    borderRadius: "8px"
                                                }}
                                            />
                                            <Legend />
                                            <Line
                                                yAxisId="left"
                                                type="monotone"
                                                dataKey="activeUsers"
                                                name="Usuários Ativos"
                                                stroke="hsl(var(--primary))"
                                                strokeWidth={2}
                                                dot={{ fill: "hsl(var(--primary))" }}
                                            />
                                            <Line
                                                yAxisId="right"
                                                type="monotone"
                                                dataKey="totalActions"
                                                name="Total de Ações"
                                                stroke="hsl(142 76% 36%)"
                                                strokeWidth={2}
                                                dot={{ fill: "hsl(142 76% 36%)" }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="features">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Gráfico de barras */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Top Funcionalidades</CardTitle>
                                    <CardDescription>
                                        As funcionalidades mais utilizadas no período
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="pt-4">
                                    {loadingTopFeatures ? (
                                        <div className="h-[400px] flex items-center justify-center">Carregando...</div>
                                    ) : formattedTopFeatures.length === 0 ? (
                                        <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                                            Nenhum dado disponível para o período selecionado
                                        </div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height={400}>
                                            <BarChart data={formattedTopFeatures.slice(0, 10)} layout="vertical">
                                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                                <XAxis type="number" className="text-xs" />
                                                <YAxis dataKey="label" type="category" width={150} className="text-xs" />
                                                <Tooltip
                                                    contentStyle={{
                                                        backgroundColor: "hsl(var(--background))",
                                                        border: "1px solid hsl(var(--border))",
                                                        borderRadius: "8px"
                                                    }}
                                                />
                                                <Bar dataKey="count" name="Quantidade" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Tabela detalhada */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Detalhamento por Feature</CardTitle>
                                    <CardDescription>
                                        Todas as funcionalidades e ações registradas
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="max-h-[400px] overflow-y-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Funcionalidade</TableHead>
                                                    <TableHead>Ação</TableHead>
                                                    <TableHead className="text-right">Quantidade</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {loadingTopFeatures ? (
                                                    <TableRow>
                                                        <TableCell colSpan={3} className="text-center">Carregando...</TableCell>
                                                    </TableRow>
                                                ) : formattedTopFeatures.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                                                            Nenhum dado disponível
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    formattedTopFeatures.map((item, i) => (
                                                        <TableRow key={i}>
                                                            <TableCell>{item.featureLabel}</TableCell>
                                                            <TableCell>
                                                                <span className="px-2 py-1 rounded-full text-xs bg-muted">
                                                                    {item.actionLabel}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className="text-right font-medium">{item.count}</TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </Layout>
    );
}
