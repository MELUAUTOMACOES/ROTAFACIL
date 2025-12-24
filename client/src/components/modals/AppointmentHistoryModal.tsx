import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { ScrollArea } from "../ui/scroll-area";
import { Badge } from "../ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, MapPin, Phone, User, Clock, CheckCircle, XCircle, RefreshCw, AlertCircle } from "lucide-react";

interface AppointmentHistoryItem {
    id: number;
    changedBy: number;
    changedByName: string;
    changedAt: Date;
    changeType: string;
    previousData?: any;
    newData?: any;
    reason?: string;
    notes?: string;
    resolutionDetails?: {
        action: string;
        originalReason: string;
        contactedClient: boolean;
        contactChannel?: string;
        notes?: string;
    };
}

interface AppointmentHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    appointmentId: number;
    history: AppointmentHistoryItem[];
}

const changeTypeLabels: Record<string, { label: string; icon: any; color: string }> = {
    created: { label: "Criado", icon: Calendar, color: "bg-blue-500" },
    rescheduled: { label: "Reagendado", icon: RefreshCw, color: "bg-yellow-500" },
    cancelled: { label: "Cancelado", icon: XCircle, color: "bg-red-500" },
    status_changed: { label: "Status Alterado", icon: AlertCircle, color: "bg-purple-500" },
    address_corrected: { label: "Endereço Corrigido", icon: MapPin, color: "bg-green-500" },
    provider_updated: { label: "Prestador Alterado", icon: User, color: "bg-indigo-500" },
};

const resolutionActionLabels: Record<string, string> = {
    rescheduled: "Reagendado",
    cancelled: "Cancelado",
    resolved_by_provider: "Resolvido pelo prestador",
    awaiting: "Aguardando retorno",
};

const pendingReasonLabels: Record<string, string> = {
    cliente_ausente: "Cliente ausente",
    pediu_remarcacao: "Pediu remarcação",
    problema_tecnico: "Problema técnico",
    endereco_incorreto: "Endereço incorreto",
    cliente_recusou: "Cliente recusou",
    outro_motivo: "Outro motivo",
};

export function AppointmentHistoryModal({
    isOpen,
    onClose,
    appointmentId,
    history,
}: AppointmentHistoryModalProps) {
    function getChangeTypeInfo(changeType: string) {
        return changeTypeLabels[changeType] || {
            label: changeType,
            icon: Clock,
            color: "bg-gray-500"
        };
    }

    function formatDataChange(previousData: any, newData: any, changeType: string): string | null {
        if (!previousData || !newData) return null;

        const prev = typeof previousData === 'string' ? JSON.parse(previousData) : previousData;
        const current = typeof newData === 'string' ? JSON.parse(newData) : newData;

        const changes: string[] = [];

        // Data agendada
        if (prev.scheduledDate !== current.scheduledDate) {
            const prevDate = new Date(prev.scheduledDate);
            const newDate = new Date(current.scheduledDate);
            changes.push(`Data: ${format(prevDate, 'dd/MM/yyyy HH:mm', { locale: ptBR })} → ${format(newDate, 'dd/MM/yyyy HH:mm', { locale: ptBR })}`);
        }

        // Status
        if (prev.status !== current.status) {
            changes.push(`Status: ${prev.status} → ${current.status}`);
        }

        // Técnico/Equipe
        if (prev.technicianId !== current.technicianId) {
            changes.push(`Técnico alterado`);
        }
        if (prev.teamId !== current.teamId) {
            changes.push(`Equipe alterada`);
        }

        return changes.length > 0 ? changes.join(' • ') : null;
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[80vh]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Histórico do Agendamento #{appointmentId}
                    </DialogTitle>
                    <DialogDescription>
                        Todas as alterações e ações realizadas neste agendamento
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="h-[500px] pr-4">
                    {history.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p>Nenhuma alteração registrada ainda</p>
                        </div>
                    ) : (
                        <div className="relative">
                            {/* Timeline vertical */}
                            <div className="absolute left-[27px] top-0 bottom-0 w-0.5 bg-border" />

                            <div className="space-y-6">
                                {history.map((item, index) => {
                                    const typeInfo = getChangeTypeInfo(item.changeType);
                                    const Icon = typeInfo.icon;
                                    const dataChanges = formatDataChange(item.previousData, item.newData, item.changeType);

                                    return (
                                        <div key={item.id} className="relative pl-14">
                                            {/* Ícone na timeline */}
                                            <div className={`absolute left-0 w-14 h-14 rounded-full ${typeInfo.color} flex items-center justify-center border-4 border-background`}>
                                                <Icon className="h-6 w-6 text-white" />
                                            </div>

                                            {/* Card de conteúdo */}
                                            <div className="bg-muted/50 rounded-lg p-4 border">
                                                <div className="flex items-start justify-between mb-2">
                                                    <div>
                                                        <Badge variant="outline" className="mb-1">
                                                            {typeInfo.label}
                                                        </Badge>
                                                        <div className="text-sm text-muted-foreground">
                                                            <User className="h-3 w-3 inline mr-1" />
                                                            {item.changedByName}
                                                        </div>
                                                    </div>
                                                    <div className="text-xs text-muted-foreground text-right">
                                                        {format(new Date(item.changedAt), "dd/MM/yyyy", { locale: ptBR })}
                                                        <br />
                                                        {format(new Date(item.changedAt), "HH:mm", { locale: ptBR })}
                                                    </div>
                                                </div>

                                                {/* Razão/Motivo */}
                                                {item.reason && (
                                                    <p className="text-sm font-medium mb-2">
                                                        {item.reason}
                                                    </p>
                                                )}

                                                {/* Mudanças de dados */}
                                                {dataChanges && (
                                                    <div className="text-sm text-muted-foreground bg-background/50 rounded p-2 mb-2">
                                                        {dataChanges}
                                                    </div>
                                                )}

                                                {/* Detalhes da resolução de pendência */}
                                                {item.resolutionDetails && (
                                                    <div className="mt-2 p-3 bg-background rounded border-l-2 border-primary">
                                                        <div className="text-xs font-semibold text-primary mb-1">
                                                            Resolução de Pendência
                                                        </div>
                                                        <div className="text-sm space-y-1">
                                                            <div>
                                                                <span className="font-medium">Ação:</span> {resolutionActionLabels[item.resolutionDetails.action] || item.resolutionDetails.action}
                                                            </div>
                                                            <div>
                                                                <span className="font-medium">Motivo original:</span> {pendingReasonLabels[item.resolutionDetails.originalReason] || item.resolutionDetails.originalReason}
                                                            </div>
                                                            {item.resolutionDetails.contactedClient && (
                                                                <div className="flex items-center gap-1 text-green-600">
                                                                    <Phone className="h-3 w-3" />
                                                                    Cliente contatado
                                                                    {item.resolutionDetails.contactChannel && ` via ${item.resolutionDetails.contactChannel}`}
                                                                </div>
                                                            )}
                                                            {item.resolutionDetails.notes && (
                                                                <div className="mt-1 text-xs text-muted-foreground italic">
                                                                    "{item.resolutionDetails.notes}"
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Observações gerais */}
                                                {item.notes && !item.resolutionDetails && (
                                                    <div className="mt-2 text-sm text-muted-foreground italic">
                                                        "{item.notes}"
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
