import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Plus, XCircle, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import VehicleChecklistForm from "@/components/forms/VehicleChecklistForm";
import ChecklistCard from "./ChecklistCard";

interface VehicleChecklistTabProps { }

const ITEM_STATUS_LABELS: Record<string, string> = {
    ok: "OK",
    attention: "Atenção",
    critical: "Crítico",
    not_checked: "Não Verificado",
};

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

const CATEGORY_NAMES: Record<string, string> = {
    fluids: "Fluidos e Níveis",
    tires: "Pneus",
    lights: "Luzes Externas",
    panel: "Painel",
    safety: "Segurança",
    mandatory_items: "Itens Obrigatórios",
    fuel: "Combustível",
};

export default function VehicleChecklistTab({ }: VehicleChecklistTabProps) {
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedChecklistId, setSelectedChecklistId] = useState<number | null>(null);
    const [filters, setFilters] = useState({
        vehicleId: "",
        checklistType: "",
    });

    const { data: vehicles } = useQuery({
        queryKey: ["/api/vehicles"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/vehicles");
            return res.json();
        },
    });

    const { data: checklists, isLoading } = useQuery({
        queryKey: ["/api/vehicle-checklists", filters],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filters.vehicleId) params.append("vehicleId", filters.vehicleId);
            if (filters.checklistType) params.append("checklistType", filters.checklistType);
            const res = await apiRequest("GET", `/api/vehicle-checklists?${params.toString()}`);
            return res.json();
        },
    });

    const { data: checklistDetails } = useQuery({
        queryKey: ["/api/vehicle-checklists", selectedChecklistId],
        queryFn: async () => {
            if (!selectedChecklistId) return null;
            const res = await apiRequest("GET", `/api/vehicle-checklists/${selectedChecklistId}`);
            return res.json();
        },
        enabled: !!selectedChecklistId,
    });

    const handleClearFilters = () => {
        setFilters({ vehicleId: "", checklistType: "" });
    };

    const getTypeLabel = (type: string) => {
        return type === "pre_trip" ? "Pré-viagem" : "Pós-viagem";
    };

    const getTypeBadgeColor = (type: string) => {
        return type === "pre_trip" ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800";
    };

    const getApprovalIcon = (approved: boolean) => {
        return approved ? (
            <CheckCircle2 className="w-5 h-5 text-green-600" />
        ) : (
            <AlertTriangle className="w-5 h-5 text-red-600" />
        );
    };

    const getStatusBadgeColor = (status: string) => {
        switch (status) {
            case "ok":
                return "bg-green-100 text-green-800";
            case "attention":
                return "bg-yellow-100 text-yellow-800";
            case "critical":
                return "bg-red-100 text-red-800";
            default:
                return "bg-gray-100 text-gray-800";
        }
    };

    const groupItemsByCategory = (items: any[]) => {
        const grouped: Record<string, any[]> = {};
        items.forEach((item) => {
            if (!grouped[item.category]) {
                grouped[item.category] = [];
            }
            grouped[item.category].push(item);
        });
        return grouped;
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-burnt-yellow"></div>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Checklists de Veículos</h2>
                <Button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-[#DAA520] hover:bg-[#B8860B] text-white"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Checklist
                </Button>
            </div>

            <div className="flex flex-wrap gap-2 items-end">
                <div className="flex-1 min-w-[200px]">
                    <Select value={filters.vehicleId || "all"} onValueChange={(value) => setFilters({ ...filters, vehicleId: value === "all" ? "" : value })}>
                        <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Todos os veículos" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos os veículos</SelectItem>
                            {vehicles?.map((vehicle: any) => (
                                <SelectItem key={vehicle.id} value={vehicle.id.toString()}>
                                    {vehicle.plate} - {vehicle.model}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex-1 min-w-[180px]">
                    <Select value={filters.checklistType || "all"} onValueChange={(value) => setFilters({ ...filters, checklistType: value === "all" ? "" : value })}>
                        <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Todos os tipos" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos os tipos</SelectItem>
                            <SelectItem value="pre_trip">Pré-viagem</SelectItem>
                            <SelectItem value="post_trip">Pós-viagem</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {(filters.vehicleId && filters.vehicleId !== "all" || filters.checklistType && filters.checklistType !== "all") && (
                    <Button variant="outline" size="sm" onClick={handleClearFilters}>
                        <XCircle className="w-4 h-4 mr-1" />
                        Limpar
                    </Button>
                )}
            </div>

            <div className="space-y-3">
                {!checklists || checklists.length === 0 ? (
                    <Card className="p-8 text-center text-gray-500">
                        <Clock className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>Nenhum checklist encontrado</p>
                        <p className="text-sm mt-1">Clique em "Novo Checklist" para criar o primeiro</p>
                    </Card>
                ) : (
                    checklists.map((checklist: any) => (
                        <ChecklistCard
                            key={checklist.id}
                            checklist={checklist}
                            getTypeLabel={getTypeLabel}
                            getTypeBadgeColor={getTypeBadgeColor}
                            onSelect={setSelectedChecklistId}
                        />
                    ))
                )}
            </div>

            <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
                <DialogContent className="max-w-3xl">
                    <VehicleChecklistForm
                        open={showCreateModal}
                        onClose={() => setShowCreateModal(false)}
                    />
                </DialogContent>
            </Dialog>

            <Dialog open={!!selectedChecklistId} onOpenChange={() => setSelectedChecklistId(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    {checklistDetails && (
                        <div className="space-y-6">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h2 className="text-xl font-bold">
                                        {checklistDetails.vehicle?.plate} - {checklistDetails.vehicle?.brand} {checklistDetails.vehicle?.model}
                                    </h2>
                                    <div className="flex items-center gap-2 mt-2">
                                        <Badge className={getTypeBadgeColor(checklistDetails.checklistType)}>
                                            {getTypeLabel(checklistDetails.checklistType)}
                                        </Badge>
                                        {getApprovalIcon(checklistDetails.vehicleApproved)}
                                        <span className={`text-sm font-medium ${checklistDetails.vehicleApproved ? "text-green-600" : "text-red-600"}`}>
                                            {checklistDetails.vehicleApproved ? "Veículo Aprovado" : "Veículo Não Aprovado"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-gray-500">Data/Hora:</span>
                                    <p className="font-medium">
                                        {format(new Date(checklistDetails.checkDate), "dd/MM/yyyy", { locale: ptBR })}
                                        {checklistDetails.checkTime && ` às ${checklistDetails.checkTime}`}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-gray-500">Responsável:</span>
                                    <p className="font-medium">{checklistDetails.responsibleName}</p>
                                </div>
                                <div>
                                    <span className="text-gray-500">KM:</span>
                                    <p className="font-medium">{checklistDetails.vehicleKm.toLocaleString()} km</p>
                                </div>
                                <div>
                                    <span className="text-gray-500">Ano do Veículo:</span>
                                    <p className="font-medium">{checklistDetails.vehicle?.year}</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="font-bold text-lg">Itens Verificados</h3>
                                {Object.entries(groupItemsByCategory(checklistDetails.items || [])).map(([category, items]) => (
                                    <div key={category} className="border rounded-lg p-4">
                                        <h4 className="font-semibold mb-3">{CATEGORY_NAMES[category] || category}</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            {(items as any[]).map((item, idx) => (
                                                <div key={idx} className="flex items-start justify-between text-sm">
                                                    <span className="text-gray-700">{ITEM_NAMES[item.itemName] || item.itemName}:</span>
                                                    <div className="text-right">
                                                        <Badge className={`text-xs ${getStatusBadgeColor(item.status)}`}>
                                                            {ITEM_STATUS_LABELS[item.status] || item.status}
                                                        </Badge>
                                                        {item.observation && (
                                                            <p className="text-xs text-gray-500 mt-1">{item.observation}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {checklistDetails.photos && checklistDetails.photos.length > 0 && (
                                <div>
                                    <h3 className="font-bold text-lg mb-3">Fotos</h3>
                                    <div className="grid grid-cols-3 gap-2">
                                        {checklistDetails.photos.map((photo: string, idx: number) => (
                                            <img
                                                key={idx}
                                                src={photo}
                                                alt={`Foto ${idx + 1}`}
                                                className="w-full h-32 object-cover rounded border cursor-pointer hover:opacity-80"
                                                onClick={() => window.open(photo, "_blank")}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {checklistDetails.generalObservations && (
                                <div>
                                    <h3 className="font-bold text-lg mb-2">Observações Gerais</h3>
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{checklistDetails.generalObservations}</p>
                                </div>
                            )}

                            {!checklistDetails.vehicleApproved && checklistDetails.disapprovalReason && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                    <h3 className="font-bold text-lg text-red-800 mb-2">Motivo da Não Aprovação</h3>
                                    <p className="text-sm text-red-700 whitespace-pre-wrap">{checklistDetails.disapprovalReason}</p>
                                </div>
                            )}

                            <div className="flex justify-end pt-4 border-t">
                                <Button onClick={() => setSelectedChecklistId(null)}>Fechar</Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
