import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";

interface ChecklistCardProps {
    checklist: any;
    getTypeLabel: (type: string) => string;
    getTypeBadgeColor: (type: string) => string;
    onSelect: (id: number) => void;
}

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

export default function ChecklistCard({ checklist, getTypeLabel, getTypeBadgeColor, onSelect }: ChecklistCardProps) {
    const [problematicItems, setProblematicItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchItems = async () => {
            setLoading(true);
            try {
                const res = await apiRequest("GET", `/api/vehicle-checklists/${checklist.id}`);
                const details = await res.json();
                const items = details.items || [];

                // Filtrar apenas items com status attention ou critical
                const problems = items.filter((item: any) =>
                    item.status === "attention" || item.status === "critical"
                );

                setProblematicItems(problems);
            } catch (error) {
                console.error(`Erro ao buscar items do checklist ${checklist.id}:`, error);
            } finally {
                setLoading(false);
            }
        };

        fetchItems();
    }, [checklist.id]);

    const getApprovalIcon = (approved: boolean) => {
        return approved ? (
            <CheckCircle2 className="w-5 h-5 text-green-600" />
        ) : (
            <XCircle className="w-5 h-5 text-red-600" />
        );
    };

    const getStatusIcon = (status: string) => {
        if (status === "critical") {
            return <XCircle className="w-3 h-3 text-red-600" />;
        }
        return <AlertTriangle className="w-3 h-3 text-yellow-600" />;
    };

    return (
        <Card
            className="p-4 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => onSelect(checklist.id)}
        >
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-gray-900">
                            {checklist.vehicle?.plate || "N/A"}
                        </span>
                        <Badge className={`text-xs ${getTypeBadgeColor(checklist.checklistType)}`}>
                            {getTypeLabel(checklist.checklistType)}
                        </Badge>
                    </div>

                    <p className="text-sm text-gray-600 mb-1">
                        {checklist.vehicle?.brand} {checklist.vehicle?.model}
                    </p>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span>
                            {format(new Date(checklist.checkDate), "dd/MM/yyyy", { locale: ptBR })}
                            {checklist.checkTime && ` às ${checklist.checkTime}`}
                        </span>
                        <span>{checklist.responsibleName}</span>
                        <span>{checklist.vehicleKm.toLocaleString()} km</span>
                    </div>

                    {/* Problematic Items */}
                    {problematicItems.length > 0 && (
                        <div className="mt-3 pt-3 border-t space-y-1">
                            <p className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                Itens com Problemas:
                            </p>
                            {problematicItems.slice(0, 3).map((item: any, index: number) => (
                                <div key={index} className="flex items-center gap-2 text-xs">
                                    {getStatusIcon(item.status)}
                                    <span className={item.status === "critical" ? "text-red-700 font-medium" : "text-yellow-700"}>
                                        {ITEM_NAMES[item.itemName] || item.itemName}
                                    </span>
                                    {item.observation && (
                                        <span className="text-gray-500 text-xs truncate">- {item.observation}</span>
                                    )}
                                </div>
                            ))}
                            {problematicItems.length > 3 && (
                                <p className="text-xs text-gray-500 italic mt-1">
                                    + {problematicItems.length - 3} outros problemas
                                </p>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {getApprovalIcon(checklist.vehicleApproved)}
                    <span className={`text-xs font-medium ${checklist.vehicleApproved ? "text-green-600" : "text-red-600"}`}>
                        {checklist.vehicleApproved ? "Aprovado" : "Não Aprovado"}
                    </span>
                </div>
            </div>
        </Card>
    );
}
