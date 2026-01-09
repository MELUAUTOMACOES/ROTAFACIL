import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { normalizeItems } from "@/lib/normalize";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Search, CheckCircle2, XCircle, AlertTriangle, Eye } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

// Mapeamento de nomes de itens em inglês para português
const ITEM_NAMES: Record<string, string> = {
    oil: "Óleo",
    water: "Água / Arrefecimento",
    windshield_washer: "Água do Limpador",
    front_tires: "Pneus Dianteiros",
    rear_tires: "Pneus Traseiros",
    tire_pressure: "Calibragem",
    spare_tire: "Estepe",
    headlights_low: "Farol Baixo",
    headlights_high: "Farol Alto",
    turn_signals: "Setas",
    brake_lights: "Luz de Freio",
    reverse_lights: "Luz de Ré",
    warning_lights: "Luzes de Alerta",
    brakes: "Freios",
    steering_suspension: "Direção / Suspensão",
    seat_belts: "Cintos de Segurança",
    mirrors: "Retrovisores",
    triangle: "Triângulo",
    jack: "Macaco",
    wheel_wrench: "Chave de Roda",
    fire_extinguisher: "Extintor",
    fuel_level: "Nível de Combustível",
};

const ITEM_STATUS_LABELS: Record<string, string> = {
    ok: "OK",
    attention: "Atenção",
    critical: "Crítico",
    not_checked: "Não Verificado",
};

export default function VehicleChecklistAuditTab() {
    const [filters, setFilters] = useState({
        vehicleId: "",
        verified: "all",
        situation: "all",
        responsibleName: "",
    });
    const [selectedChecklistId, setSelectedChecklistId] = useState<number | null>(null);
    const [auditForm, setAuditForm] = useState({
        verified: false,
        observations: "",
        maintenanceLinked: null as number | null,
    });

    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Buscar veículos para filtro
    const { data: vehiclesData } = useQuery({
        queryKey: ["/api/vehicles"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/vehicles");
            return res.json();
        },
        staleTime: 2 * 60_000,
        refetchOnWindowFocus: false,
    });
    const vehicles = normalizeItems<any>(vehiclesData);

    // Buscar checklists
    const { data: checklists = [], isLoading } = useQuery({
        queryKey: ["/api/vehicle-checklists", "audit", filters],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filters.vehicleId) params.append("vehicleId", filters.vehicleId);

            const res = await apiRequest("GET", `/api/vehicle-checklists?${params.toString()}`);
            const checklistsData = await res.json();

            // Enriquecer com items e auditoria
            const enriched = await Promise.all(
                checklistsData.map(async (checklist: any) => {
                    try {
                        // Buscar items
                        const detailsRes = await apiRequest("GET", `/api/vehicle-checklists/${checklist.id}`);
                        const details = await detailsRes.json();

                        // Buscar auditoria
                        const auditRes = await apiRequest("GET", `/api/vehicle-checklist-audits/checklist/${checklist.id}`);
                        const audit = await auditRes.json();

                        // Determinar situação
                        const items = details.items || [];
                        const hasCritical = items.some((item: any) => item.status === 'critical');
                        const hasAttention = items.some((item: any) => item.status === 'attention');

                        return {
                            ...checklist,
                            items,
                            audit,
                            situation: hasCritical ? 'critical' : hasAttention ? 'attention' : 'ok',
                        };
                    } catch (error) {
                        return { ...checklist, items: [], audit: null, situation: 'ok' };
                    }
                })
            );

            return enriched;
        },
    });

    // Filtrar checklists
    const filteredChecklists = checklists.filter((checklist: any) => {
        if (filters.verified !== "all") {
            const isVerified = checklist.audit?.verified || false;
            if (filters.verified === "yes" && !isVerified) return false;
            if (filters.verified === "no" && isVerified) return false;
        }

        if (filters.situation !== "all") {
            if (checklist.situation !== filters.situation) return false;
        }

        if (filters.responsibleName) {
            const searchTerm = filters.responsibleName.toLowerCase();
            const responsibleName = (checklist.responsibleName || "").toLowerCase();
            if (!responsibleName.includes(searchTerm)) return false;
        }

        return true;
    });

    // Buscar checklist selecionado com detalhes
    const { data: selectedChecklist } = useQuery({
        queryKey: ["/api/vehicle-checklists", selectedChecklistId],
        queryFn: async () => {
            if (!selectedChecklistId) return null;
            const res = await apiRequest("GET", `/api/vehicle-checklists/${selectedChecklistId}`);
            const data = await res.json();

            // Buscar auditoria
            const auditRes = await apiRequest("GET", `/api/vehicle-checklist-audits/checklist/${selectedChecklistId}`);
            const audit = await auditRes.json();

            return { ...data, audit };
        },
        enabled: !!selectedChecklistId,
    });

    // Buscar manutenções do veículo do checklist
    const { data: maintenances = [] } = useQuery({
        queryKey: ["/api/vehicle-maintenances", selectedChecklist?.vehicleId],
        queryFn: async () => {
            if (!selectedChecklist?.vehicleId) return [];
            const res = await apiRequest("GET", `/api/vehicle-maintenances?vehicleId=${selectedChecklist.vehicleId}`);
            return res.json();
        },
        enabled: !!selectedChecklist?.vehicleId,
    });

    // Mutation para salvar auditoria
    const auditMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await apiRequest("POST", "/api/vehicle-checklist-audits", data);
            return res.json();
        },
        onSuccess: () => {
            toast({
                title: "Auditoria salva!",
                description: "A auditoria do checklist foi registrada com sucesso.",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/vehicle-checklists"] });
            queryClient.invalidateQueries({ queryKey: ["/api/vehicle-checklist-audits"] });
            setSelectedChecklistId(null);
            setAuditForm({ verified: false, observations: "", maintenanceLinked: null });
        },
        onError: (error: any) => {
            toast({
                title: "Erro ao salvar auditoria",
                description: error.message || "Ocorreu um erro ao salvar a auditoria.",
                variant: "destructive",
            });
        },
    });

    const handleSaveAudit = () => {
        if (!selectedChecklistId) return;

        auditMutation.mutate({
            checklistId: selectedChecklistId,
            ...auditForm,
        });
    };

    const getSituationBadge = (situation: string) => {
        if (situation === 'critical') {
            return <Badge className="bg-red-100 text-red-800">Crítico</Badge>;
        }
        if (situation === 'attention') {
            return <Badge className="bg-yellow-100 text-yellow-800">Atenção</Badge>;
        }
        return <Badge className="bg-green-100 text-green-800">OK</Badge>;
    };

    const problematicItems = selectedChecklist?.items?.filter(
        (item: any) => item.status === 'attention' || item.status === 'critical'
    ) || [];

    return (
        <div className="space-y-4">
            {/* Filtros */}
            <Card className="p-3">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[150px]">
                        <Label htmlFor="vehicle-filter" className="text-xs">Veículo</Label>
                        <Select
                            value={filters.vehicleId || "__all__"}
                            onValueChange={(value) => setFilters({ ...filters, vehicleId: value === "__all__" ? "" : value })}
                        >
                            <SelectTrigger id="vehicle-filter" className="mt-1 h-9">
                                <SelectValue placeholder="Todos os veículos" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__all__">Todos os veículos</SelectItem>
                                {vehicles.map((v: any) => (
                                    <SelectItem key={v.id} value={v.id.toString()}>
                                        {v.plate} - {v.model}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="w-32">
                        <Label htmlFor="verified-filter" className="text-xs">Verificado</Label>
                        <Select
                            value={filters.verified}
                            onValueChange={(value) => setFilters({ ...filters, verified: value })}
                        >
                            <SelectTrigger id="verified-filter" className="mt-1 h-9">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos</SelectItem>
                                <SelectItem value="yes">Sim</SelectItem>
                                <SelectItem value="no">Não</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="w-32">
                        <Label htmlFor="situation-filter" className="text-xs">Situação</Label>
                        <Select
                            value={filters.situation}
                            onValueChange={(value) => setFilters({ ...filters, situation: value })}
                        >
                            <SelectTrigger id="situation-filter" className="mt-1 h-9">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas</SelectItem>
                                <SelectItem value="ok">OK</SelectItem>
                                <SelectItem value="attention">Atenção</SelectItem>
                                <SelectItem value="critical">Crítico</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex-1 min-w-[150px]">
                        <Label htmlFor="responsible-filter" className="text-xs">Responsável</Label>
                        <input
                            id="responsible-filter"
                            type="text"
                            className="w-full mt-1 border border-gray-300 px-3 h-9 text-sm rounded-md focus:border-burnt-yellow focus:outline-none"
                            placeholder="Buscar por nome..."
                            value={filters.responsibleName}
                            onChange={(e) => setFilters({ ...filters, responsibleName: e.target.value })}
                        />
                    </div>

                    <div className="flex gap-2">
                        {(filters.vehicleId || filters.verified !== "all" || filters.situation !== "all" || filters.responsibleName) && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-9 px-3"
                                onClick={() => setFilters({ vehicleId: "", verified: "all", situation: "all", responsibleName: "" })}
                            >
                                Limpar
                            </Button>
                        )}
                    </div>
                </div>
            </Card>

            {/* Listagem de Checklists */}
            <div className="space-y-3">
                {isLoading ? (
                    <Card className="p-8 text-center text-gray-500">
                        <p>Carregando checklists...</p>
                    </Card>
                ) : filteredChecklists.length === 0 ? (
                    <Card className="p-8 text-center text-gray-500">
                        <Search className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>Nenhum checklist encontrado</p>
                    </Card>
                ) : (
                    filteredChecklists.map((checklist: any) => (
                        <Card
                            key={checklist.id}
                            className={`p-4 hover:shadow-md transition-shadow cursor-pointer ${checklist.situation === 'critical' && !checklist.audit?.verified
                                ? 'border-red-500 border-2'
                                : ''
                                }`}
                            onClick={() => {
                                setSelectedChecklistId(checklist.id);
                                setAuditForm({
                                    verified: checklist.audit?.verified || false,
                                    observations: checklist.audit?.observations || "",
                                    maintenanceLinked: checklist.audit?.maintenanceLinked || null,
                                });
                            }}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="font-semibold text-gray-900 dark:text-zinc-100">
                                            {checklist.vehicle?.plate || "N/A"}
                                        </span>
                                        {getSituationBadge(checklist.situation)}
                                        {checklist.audit?.verified ? (
                                            <Badge className="bg-blue-100 text-blue-800">✓ Verificado</Badge>
                                        ) : (
                                            <Badge variant="outline">Não Verificado</Badge>
                                        )}
                                    </div>

                                    <p className="text-sm text-gray-600 dark:text-zinc-400 mb-1">
                                        {checklist.vehicle?.brand} {checklist.vehicle?.model}
                                    </p>

                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                                        <span>
                                            {format(new Date(checklist.checkDate), "dd/MM/yyyy", { locale: ptBR })}
                                            {checklist.checkTime && ` às ${checklist.checkTime}`}
                                        </span>
                                        <span>{checklist.responsibleName}</span>
                                    </div>
                                </div>

                                <Button variant="ghost" size="sm">
                                    <Eye className="w-4 h-4" />
                                </Button>
                            </div>
                        </Card>
                    ))
                )}
            </div>

            {/* Modal de Auditoria */}
            <Dialog open={!!selectedChecklistId} onOpenChange={(open) => !open && setSelectedChecklistId(null)}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Auditoria de Checklist</DialogTitle>
                    </DialogHeader>

                    {selectedChecklist && (
                        <div className="space-y-4">
                            {/* Resumo do Checklist */}
                            <Card className="p-4 bg-gray-50 dark:bg-zinc-800">
                                <h3 className="font-semibold mb-2">Informações do Checklist</h3>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div>
                                        <span className="text-gray-600 dark:text-zinc-400">Veículo:</span>{" "}
                                        <span className="font-medium">
                                            {selectedChecklist.vehicle?.plate} - {selectedChecklist.vehicle?.model}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-gray-600 dark:text-zinc-400">Data:</span>{" "}
                                        <span className="font-medium">
                                            {format(new Date(selectedChecklist.checkDate), "dd/MM/yyyy", { locale: ptBR })}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-gray-600 dark:text-zinc-400">Responsável:</span>{" "}
                                        <span className="font-medium">{selectedChecklist.responsibleName}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-600 dark:text-zinc-400">KM:</span>{" "}
                                        <span className="font-medium">{selectedChecklist.vehicleKm.toLocaleString()} km</span>
                                    </div>
                                </div>
                            </Card>

                            {/* Items Problemáticos */}
                            {problematicItems.length > 0 && (
                                <Card className="p-4 border-orange-200">
                                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4 text-orange-600" />
                                        Itens com Problemas ({problematicItems.length})
                                    </h3>
                                    <div className="space-y-2">
                                        {problematicItems.map((item: any, index: number) => (
                                            <div key={index} className="flex items-start gap-2 text-sm">
                                                {item.status === 'critical' ? (
                                                    <XCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                                                ) : (
                                                    <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                                                )}
                                                <div>
                                                    <p className={`font-medium ${item.status === 'critical' ? 'text-red-700' : 'text-yellow-700'}`}>
                                                        {ITEM_NAMES[item.itemName] || item.itemName}
                                                    </p>
                                                    {item.observation && (
                                                        <p className="text-gray-600 text-xs">{item.observation}</p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            )}

                            {/* Formulário de Auditoria */}
                            <div className="space-y-4">
                                <div>
                                    <Label>Checklist Verificado?</Label>
                                    <RadioGroup
                                        value={auditForm.verified ? "yes" : "no"}
                                        onValueChange={(value) => setAuditForm({ ...auditForm, verified: value === "yes" })}
                                        className="flex gap-4 mt-2"
                                    >
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="yes" id="verified-yes" />
                                            <Label htmlFor="verified-yes" className="font-normal cursor-pointer">
                                                Sim
                                            </Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="no" id="verified-no" />
                                            <Label htmlFor="verified-no" className="font-normal cursor-pointer">
                                                Não
                                            </Label>
                                        </div>
                                    </RadioGroup>
                                </div>

                                <div>
                                    <Label htmlFor="observations">Observações da Auditoria</Label>
                                    <Textarea
                                        id="observations"
                                        value={auditForm.observations}
                                        onChange={(e) => setAuditForm({ ...auditForm, observations: e.target.value })}
                                        placeholder="Digite observações sobre a auditoria..."
                                        rows={4}
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="maintenance">Vincular a Manutenção (Opcional)</Label>
                                    <Select
                                        value={auditForm.maintenanceLinked?.toString() || "__none__"}
                                        onValueChange={(value) => setAuditForm({ ...auditForm, maintenanceLinked: value && value !== "__none__" ? parseInt(value) : null })}
                                    >
                                        <SelectTrigger id="maintenance">
                                            <SelectValue placeholder="Selecione uma manutenção (opcional)" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__none__">Nenhuma</SelectItem>
                                            {maintenances.map((m: any) => (
                                                <SelectItem key={m.id} value={m.id.toString()}>
                                                    #{m.id} - {format(new Date(m.entryDate), "dd/MM/yyyy")} - {m.description}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Botões */}
                            <div className="flex justify-end gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setSelectedChecklistId(null)}
                                    disabled={auditMutation.isPending}
                                >
                                    Cancelar
                                </Button>
                                <Button onClick={handleSaveAudit} disabled={auditMutation.isPending}>
                                    {auditMutation.isPending ? "Salvando..." : "Salvar Auditoria"}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
