import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, AlertCircle, Clock, ChevronRight, User } from "lucide-react";
import { Link } from "wouter";

interface CriticalAlert {
    type: string;
    severity: "critical" | "warning" | "info";
    title: string;
    description: string;
    count: number;
    actionLabel: string;
    actionLink: string;
}

export function CriticalAlertsCard() {
    const { data: alerts = [], isLoading } = useQuery<CriticalAlert[]>({
        queryKey: ["/api/dashboard/critical-alerts"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/dashboard/critical-alerts");
            return res.json();
        },
        refetchInterval: 120000, // Atualizar a cada 2 minutos
    });

    const getSeverityStyles = (severity: string) => {
        switch (severity) {
            case "critical":
                return {
                    border: "border-red-500",
                    bg: "bg-red-50",
                    icon: <AlertTriangle className="w-4 h-4 text-red-600" />,
                };
            case "warning":
                return {
                    border: "border-orange-500",
                    bg: "bg-orange-50",
                    icon: <AlertCircle className="w-4 h-4 text-orange-600" />,
                };
            default:
                return {
                    border: "border-blue-500",
                    bg: "bg-blue-50",
                    icon: <Clock className="w-4 h-4 text-blue-600" />,
                };
        }
    };

    // Calcular total de alertas críticos e warnings
    const criticalCount = alerts.filter(a => a.severity === "critical").length;
    const warningCount = alerts.filter(a => a.severity === "warning").length;

    return (
        <TooltipProvider>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <AlertTriangle className="w-5 h-5 text-orange-600" />
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="cursor-help border-b border-dashed border-gray-400">Alertas Críticos</span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                                <p>Situações que requerem atenção imediata: agendamentos sem técnico, rotas não iniciadas no horário, e pendências não resolvidas.</p>
                            </TooltipContent>
                        </Tooltip>
                        {alerts.length > 0 && (
                            <div className="flex gap-1 ml-2">
                                {criticalCount > 0 && (
                                    <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs font-medium rounded-full">
                                        {criticalCount}
                                    </span>
                                )}
                                {warningCount > 0 && (
                                    <span className="px-2 py-0.5 bg-orange-100 text-orange-800 text-xs font-medium rounded-full">
                                        {warningCount}
                                    </span>
                                )}
                            </div>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <p className="text-sm text-gray-500">Carregando...</p>
                    ) : alerts.length === 0 ? (
                        <div className="text-center py-4">
                            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
                                <span className="text-green-600 text-lg">✓</span>
                            </div>
                            <p className="text-sm text-gray-500">Tudo em ordem! Nenhum alerta.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {alerts.map((alert, index) => {
                                const styles = getSeverityStyles(alert.severity);
                                return (
                                    <Link key={index} href={alert.actionLink}>
                                        <div
                                            className={`border-l-4 ${styles.border} ${styles.bg} pl-3 py-2 rounded-r cursor-pointer hover:opacity-80 transition-opacity`}
                                        >
                                            <div className="flex items-start gap-2">
                                                {styles.icon}
                                                <div className="flex-1">
                                                    <p className="font-medium text-sm">{alert.title}</p>
                                                    <p className="text-xs text-gray-600 mt-0.5">
                                                        {alert.description}
                                                    </p>
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                            </div>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </TooltipProvider>
    );
}
