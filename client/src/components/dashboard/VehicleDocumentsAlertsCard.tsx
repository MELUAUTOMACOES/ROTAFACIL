import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FileText, ChevronRight, AlertCircle } from "lucide-react";
import { Link } from "wouter";

export function VehicleDocumentsAlertsCard() {
    const { data: alerts = [], isLoading } = useQuery({
        queryKey: ["/api/dashboard/critical-alerts"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/dashboard/critical-alerts");
            return res.json();
        },
    });

    const documentAlerts = alerts.filter((a: any) => a.type === "vehicle_document");

    return (
        <TooltipProvider>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <FileText className="w-5 h-5 text-blue-600" />
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="cursor-help border-b border-dashed border-gray-400">Documentos Vencidos ou a Vencer</span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                                <p>Documentos de veículos que já venceram ou vencem nos próximos 30 dias.</p>
                            </TooltipContent>
                        </Tooltip>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <p className="text-sm text-gray-500">Carregando...</p>
                    ) : documentAlerts.length === 0 ? (
                        <div className="text-center py-4">
                            <p className="text-sm text-gray-500">✅ Nenhum documento pendente</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {documentAlerts.slice(0, 5).map((alert: any, index: number) => (
                                <div
                                    key={index}
                                    className={`flex items-center justify-between border-l-4 pl-3 py-2 rounded-r ${alert.severity === 'critical' ? 'border-red-500 bg-red-50' : 'border-orange-500 bg-orange-50'
                                        }`}
                                >
                                    <div className="flex-1">
                                        <p className="font-medium text-sm">
                                            {alert.title}
                                        </p>
                                        <p className="text-xs text-gray-600">
                                            {alert.description}
                                        </p>
                                    </div>
                                    <Link href={alert.actionLink}>
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </Link>
                                </div>
                            ))}
                            {documentAlerts.length > 5 && (
                                <p className="text-xs text-gray-500 text-center pt-2">
                                    + {documentAlerts.length - 5} outros documentos
                                </p>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </TooltipProvider>
    );
}
