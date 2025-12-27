import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "wouter";

export function VehiclesAttentionCard() {
    const { data: vehiclesWithIssues = [], isLoading } = useQuery({
        queryKey: ["/api/dashboard/vehicles-attention"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/dashboard/vehicles-attention");
            return res.json();
        },
    });

    return (
        <TooltipProvider>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <AlertTriangle className="w-5 h-5 text-orange-600" />
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="cursor-help border-b border-dashed border-gray-400">Veículos que Precisam de Atenção</span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                                <p>Veículos cujo último checklist apresentou itens com status "atenção" ou "crítico".</p>
                            </TooltipContent>
                        </Tooltip>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <p className="text-sm text-gray-500">Carregando...</p>
                    ) : vehiclesWithIssues.length === 0 ? (
                        <div className="text-center py-4">
                            <p className="text-sm text-gray-500">✅ Nenhum veículo com problemas</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {vehiclesWithIssues.slice(0, 5).map((vehicle: any) => (
                                <div
                                    key={vehicle.id}
                                    className={`flex items-center justify-between border-l-4 pl-3 py-2 rounded-r ${vehicle.severity === 'critical' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                                        }`}
                                >
                                    <div className="flex-1">
                                        <p className="font-medium text-sm dark:text-zinc-100">
                                            {vehicle.plate} - {vehicle.model}
                                        </p>
                                        <p className="text-xs text-gray-600 dark:text-zinc-400">
                                            Checklist em {format(new Date(vehicle.checklistDate), "dd/MM/yyyy", { locale: ptBR })}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-zinc-500">
                                            {vehicle.problematicItemsCount} {vehicle.problematicItemsCount === 1 ? 'item' : 'itens'} com problema
                                        </p>
                                    </div>
                                    <Badge variant={vehicle.severity === 'critical' ? 'destructive' : 'secondary'} className="text-xs">
                                        {vehicle.severity === 'critical' ? 'Crítico' : 'Atenção'}
                                    </Badge>
                                </div>
                            ))}
                            {vehiclesWithIssues.length > 5 && (
                                <p className="text-xs text-gray-500 text-center pt-2">
                                    + {vehiclesWithIssues.length - 5} outros veículos
                                </p>
                            )}
                            <Link href="/vehicles#checklist">
                                <Button variant="outline" size="sm" className="w-full mt-2">
                                    Ver Todos os Checklists
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
