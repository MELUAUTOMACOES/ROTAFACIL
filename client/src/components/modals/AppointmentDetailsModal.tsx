import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, FileText, Image, PenTool, History, MapPin } from 'lucide-react';
import AppointmentLocationMap from '../maps/AppointmentLocationMap';
import { getAuthHeaders } from '@/lib/auth';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AppointmentDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    appointmentId: number | null;
}

export function AppointmentDetailsModal({ isOpen, onClose, appointmentId }: AppointmentDetailsModalProps) {
    const { data: appointment, isLoading } = useQuery({
        queryKey: [`/api/appointments/${appointmentId}`],
        queryFn: async () => {
            const res = await fetch(`/api/appointments/${appointmentId}`, { headers: getAuthHeaders() });
            if (!res.ok) throw new Error('Failed to fetch');
            return res.json();
        },
        enabled: isOpen && !!appointmentId,
    });

    const { data: history = [] } = useQuery({
        queryKey: [`/api/appointments/${appointmentId}/history`],
        queryFn: async () => {
            const res = await fetch(`/api/appointments/${appointmentId}/history`, { headers: getAuthHeaders() });
            if (!res.ok) throw new Error('Failed to fetch');
            return res.json();
        },
        enabled: isOpen && !!appointmentId,
    });

    const getStatusLabel = (status: string | null) => {
        const labels: Record<string, string> = {
            concluido: 'Concluído',
            remarcado: 'Remarcado',
            nao_realizado_ausente: 'Cliente Ausente',
            nao_realizado_recusou: 'Cliente Recusou',
            nao_realizado_tecnico: 'Problema Técnico',
            nao_realizado_endereco: 'Endereço Incorreto',
            nao_realizado_outro: 'Outro Motivo',
        };
        return labels[status || ''] || status || 'N/A';
    };

    const getStatusColor = (status: string | null) => {
        const colors: Record<string, string> = {
            concluido: 'bg-green-100 text-green-800',
            remarcado: 'bg-orange-100 text-orange-800',
            nao_realizado_ausente: 'bg-yellow-100 text-yellow-800',
            nao_realizado_recusou: 'bg-red-100 text-red-800',
            nao_realizado_tecnico: 'bg-purple-100 text-purple-800',
            nao_realizado_endereco: 'bg-blue-100 text-blue-800',
            nao_realizado_outro: 'bg-gray-100 text-gray-800',
        };
        return colors[status || ''] || 'bg-gray-100 text-gray-800';
    };

    const formatDateTime = (dateStr: string | null) => {
        if (!dateStr) return 'N/A';
        try {
            return format(new Date(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
        } catch {
            return dateStr;
        }
    };

    const formatElapsed = (start: string, end: string) => {
        try {
            const seconds = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000);
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = seconds % 60;
            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        } catch {
            return 'N/A';
        }
    };

    // Dados de localização
    const clientLocation = (appointment?.latitude && appointment?.longitude)
        ? { lat: parseFloat(appointment.latitude), lng: parseFloat(appointment.longitude) }
        : undefined;

    const executionEnd = (() => {
        if (!appointment?.executionEndLocation) return undefined;
        const loc = appointment.executionEndLocation;
        // Handle both naming conventions: lat/lng or latitude/longitude
        const lat = parseFloat(loc.lat ?? loc.latitude);
        const lng = parseFloat(loc.lng ?? loc.longitude);
        if (isNaN(lat) || isNaN(lng)) return undefined;
        return { lat, lng, timestamp: loc.timestamp };
    })();

    // Mostrar aba do mapa se houver QUALQUER dado de localização (mesmo se inválido para exibição)
    const hasLocationData = !!clientLocation || !!executionEnd || !!appointment?.executionEndLocation;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Detalhes do Atendimento
                    </DialogTitle>
                    <DialogDescription>
                        Visualize todas as informações coletadas pelo prestador
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
                    </div>
                ) : !appointment ? (
                    <div className="text-center py-8 text-gray-500">Agendamento não encontrado</div>
                ) : (
                    <Tabs defaultValue="current" className="flex-1 overflow-hidden flex flex-col">
                        <TabsList className={`grid w-full grid-cols-${2 + (hasLocationData ? 1 : 0)}`}>
                            <TabsTrigger value="current">Dados Atuais</TabsTrigger>
                            <TabsTrigger value="photos" className="flex items-center gap-2">
                                <Image className="w-4 h-4" />
                                Fotos/Assinatura
                            </TabsTrigger>
                            {hasLocationData && (
                                <TabsTrigger value="map" className="flex items-center gap-2">
                                    <MapPin className="w-4 h-4" />
                                    Mapa
                                </TabsTrigger>
                            )}
                            <TabsTrigger value="history" className="flex items-center gap-2">
                                <History className="w-4 h-4" />
                                Histórico ({history.length})
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="current" className="flex-1 overflow-auto">
                            <ScrollArea className="h-full pr-4">
                                <div className="space-y-6 p-1">
                                    {appointment.executionStatus && (
                                        <div>
                                            <Label className="text-base font-semibold mb-2 block">Status</Label>
                                            <Badge className={`${getStatusColor(appointment.executionStatus)} text-sm px-3 py-1`}>
                                                {getStatusLabel(appointment.executionStatus)}
                                            </Badge>
                                        </div>
                                    )}

                                    {appointment.executionNotes && (
                                        <>
                                            <Separator />
                                            <div>
                                                <Label className="text-base font-semibold mb-2 block">Observações</Label>
                                                <div className="p-4 bg-gray-50 rounded-lg border text-sm whitespace-pre-wrap">
                                                    {appointment.executionNotes}
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {(appointment.executionStartedAt || appointment.executionFinishedAt) && (
                                        <>
                                            <Separator />
                                            <div>
                                                <Label className="text-base font-semibold mb-3 block flex items-center gap-2">
                                                    <Clock className="w-4 h-4" />
                                                    Tempos
                                                </Label>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    {appointment.executionStartedAt && (
                                                        <div className="p-3 bg-blue-50 rounded-lg">
                                                            <div className="text-xs text-blue-600 font-medium">Início</div>
                                                            <div className="text-sm font-semibold mt-1">{formatDateTime(appointment.executionStartedAt)}</div>
                                                        </div>
                                                    )}
                                                    {appointment.executionFinishedAt && (
                                                        <div className="p-3 bg-green-50 rounded-lg">
                                                            <div className="text-xs text-green-600 font-medium">Término</div>
                                                            <div className="text-sm font-semibold mt-1">{formatDateTime(appointment.executionFinishedAt)}</div>
                                                        </div>
                                                    )}
                                                </div>
                                                {appointment.executionStartedAt && appointment.executionFinishedAt && (
                                                    <div className="mt-3 p-3 bg-purple-50 rounded-lg">
                                                        <div className="text-xs text-purple-600 font-medium">Duração</div>
                                                        <div className="text-sm font-semibold mt-1">
                                                            {formatElapsed(appointment.executionStartedAt, appointment.executionFinishedAt)}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </ScrollArea>
                        </TabsContent>

                        <TabsContent value="photos" className="flex-1 overflow-auto">
                            <ScrollArea className="h-full pr-4">
                                <div className="space-y-6 p-1">
                                    {(() => {
                                        let photos: string[] = [];
                                        try {
                                            if (Array.isArray(appointment.photos)) {
                                                photos = appointment.photos;
                                            } else if (typeof appointment.photos === 'string') {
                                                const raw = appointment.photos.trim();
                                                if (raw.startsWith('[') && raw.endsWith(']')) {
                                                    try {
                                                        const parsed = JSON.parse(raw);
                                                        if (Array.isArray(parsed)) photos = parsed;
                                                    } catch (err) {
                                                        console.warn("Failed to parse photos JSON:", err);
                                                        // Fallback? If it looks like JSON but failed, maybe it's corrupted.
                                                    }
                                                } else if (raw.length > 0) {
                                                    // Treat as single URL
                                                    photos = [raw];
                                                }
                                            }
                                        } catch (e) {
                                            console.error("Critical error handling photos:", e);
                                            photos = [];
                                        }

                                        if (!photos || photos.length === 0) return null;

                                        return (
                                            <>
                                                <div>
                                                    <Label className="text-base font-semibold mb-3 block flex items-center gap-2">
                                                        <Image className="w-4 h-4" />
                                                        Fotos ({photos.length})
                                                    </Label>
                                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                        {photos.map((photo: string, idx: number) => (
                                                            <a
                                                                key={idx}
                                                                href={photo}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="relative aspect-square rounded-lg overflow-hidden border group"
                                                            >
                                                                <img src={photo} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-sm font-medium">
                                                                    Abrir
                                                                </div>
                                                            </a>
                                                        ))}
                                                    </div>
                                                </div>
                                            </>
                                        );
                                    })()}

                                    {appointment.signature && (
                                        <>
                                            <Separator />
                                            <div>
                                                <Label className="text-base font-semibold mb-3 block flex items-center gap-2">
                                                    <PenTool className="w-4 h-4" />
                                                    Assinatura
                                                </Label>
                                                <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-4 inline-block">
                                                    <img src={appointment.signature} alt="Assinatura" className="max-w-full h-auto max-h-40" />
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </ScrollArea>
                        </TabsContent>

                        {hasLocationData && (
                            <TabsContent value="map" className="mt-0 h-full">
                                <ScrollArea className="h-full">
                                    <div className="p-4 space-y-4">
                                        <div className="bg-blue-50 p-4 rounded-lg mb-4">
                                            <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                                                <MapPin className="w-5 h-5" />
                                                Registro de Localização
                                            </h3>
                                            <p className="text-sm text-blue-700">
                                                O mapa mostra a comparação entre o endereço cadastrado do cliente (Azul) e o local onde o serviço foi finalizado (Verde).
                                            </p>
                                        </div>

                                        <AppointmentLocationMap
                                            clientLocation={clientLocation}
                                            executionEnd={executionEnd}
                                            height="400px"
                                        />

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                            {clientLocation && (
                                                <div className="bg-gray-50 p-3 rounded border">
                                                    <span className="text-xs text-gray-500 block">Endereço Cadastrado</span>
                                                    <span className="text-sm font-medium">{appointment.clientAddress || 'Endereço não informado'}</span>
                                                </div>
                                            )}
                                            {executionEnd && (
                                                <div className="bg-gray-50 p-3 rounded border">
                                                    <span className="text-xs text-gray-500 block">Local da Finalização (GPS)</span>
                                                    <span className="text-sm font-medium">Lat: {Number(executionEnd.lat).toFixed(5)}, Lng: {Number(executionEnd.lng).toFixed(5)}</span>
                                                    <span className="text-xs text-gray-400 block mt-1">
                                                        Precisão: {appointment.executionEndLocation?.accuracy ? `±${Math.round(appointment.executionEndLocation.accuracy)}m` : 'N/A'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </ScrollArea>
                            </TabsContent>
                        )}

                        <TabsContent value="history" className="mt-0 h-full">
                            <ScrollArea className="h-full pr-4">
                                <div className="space-y-4 p-1">
                                    {history.length === 0 ? (
                                        <div className="text-center py-8 text-gray-500">
                                            <History className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                                            Nenhuma alteração registrada
                                        </div>
                                    ) : (
                                        history.map((item: any) => (
                                            <div key={item.id} className="border rounded-lg p-4 bg-gray-50">
                                                <div className="flex items-start justify-between mb-2">
                                                    <div>
                                                        <div className="font-semibold text-sm">{item.changedByName}</div>
                                                        <div className="text-xs text-gray-500">{formatDateTime(item.changedAt)}</div>
                                                    </div>
                                                    <Badge variant="outline" className="text-xs">{item.changeType}</Badge>
                                                </div>
                                                {item.reason && (
                                                    <div className="text-sm text-gray-700 mb-2">
                                                        <strong>Motivo:</strong> {item.reason}
                                                    </div>
                                                )}
                                                {item.previousData && (
                                                    <details className="mt-2">
                                                        <summary className="cursor-pointer text-sm font-medium text-blue-600">
                                                            Ver dados anteriores
                                                        </summary>
                                                        <div className="mt-2 p-3 bg-white rounded border text-xs overflow-auto max-h-[200px]">
                                                            <pre className="whitespace-pre-wrap">{JSON.stringify(item.previousData, null, 2)}</pre>
                                                        </div>
                                                    </details>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </ScrollArea>
                        </TabsContent>
                    </Tabs>
                )}
            </DialogContent>
        </Dialog>
    );
}
