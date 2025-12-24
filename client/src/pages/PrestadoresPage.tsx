import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
    MapPin, Calendar, Navigation, CheckCircle, Clock,
    AlertTriangle, ChevronRight, QrCode, LogOut, Map as MapIcon, ClipboardCheck, PlayCircle, Home, UserCheck, Timer
} from 'lucide-react';
import QRCode from "react-qr-code";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { AppointmentExecutionModal } from "@/components/provider/AppointmentExecutionModal";
import VehicleChecklistTab from "@/components/provider/VehicleChecklistTab";
import { useAuth } from "@/lib/auth";

export default function PrestadoresPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
    const [showFinalizeModal, setShowFinalizeModal] = useState(false);
    const [showQRModal, setShowQRModal] = useState(false);
    const [finalizeStatus, setFinalizeStatus] = useState('finalizado');
    const [finalizeMotivo, setFinalizeMotivo] = useState('');
    const [routeEndLocation, setRouteEndLocation] = useState<'last_client' | 'company_home'>('last_client');

    const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

    // Buscar lista de prestadores ativos (apenas admin)
    const { data: activeProviders } = useQuery({
        queryKey: ['/api/provider/active-today'],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/provider/active-today");
            return res.json();
        },
        enabled: user?.role === 'admin'
    });

    // Se for admin e tiver prestadores, seleciona o primeiro automaticamente se nenhum selecionado
    React.useEffect(() => {
        if (user?.role === 'admin' && activeProviders?.length > 0 && !selectedRouteId) {
            setSelectedRouteId(activeProviders[0].id);
        }
    }, [activeProviders, user?.role, selectedRouteId]);

    // Buscar rota ativa do dia (ou a selecionada pelo admin)
    const { data: routeData, isLoading } = useQuery({
        queryKey: ['/api/provider/route', selectedRouteId],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (selectedRouteId) {
                params.append('routeId', selectedRouteId);
            }
            const res = await apiRequest("GET", `/api/provider/route?${params.toString()}`);
            return res.json();
        },
        enabled: user?.role !== 'admin' || !!selectedRouteId // Admin só busca se tiver selecionado
    });

    // Mutation para atualizar agendamento
    const updateAppointmentMutation = useMutation({
        mutationFn: async ({ id, data }: { id: number, data: any }) => {
            const res = await apiRequest("PUT", `/api/provider/appointments/${id}`, data);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/provider/route'] });
        }
    });

    // Mutation para finalizar rota
    const finalizeRouteMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string, data: any }) => {
            const res = await apiRequest("POST", `/api/provider/route/${id}/finalize`, data);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/provider/route'] });
            queryClient.invalidateQueries({ queryKey: ['/api/routes'] }); // Atualiza a lista geral de romaneios
            queryClient.invalidateQueries({ queryKey: ['/api/provider/active-today'] }); // Atualiza lista de ativos
            queryClient.invalidateQueries({ queryKey: ['/api/pending-appointments'] }); // Atualiza lista de pendências
            setShowFinalizeModal(false);
            toast({
                title: "Rota finalizada",
                description: "A rota foi encerrada com sucesso.",
            });
        },
        onError: (error: any) => {
            toast({
                title: "Erro",
                description: error.message,
                variant: "destructive",
            });
        }
    });

    // Mutation para iniciar rota
    const startRouteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await apiRequest("PATCH", `/api/routes/${id}/start`);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/provider/route'] });
            toast({
                title: "Rota iniciada!",
                description: "Bom trabalho! Agora você pode registrar os atendimentos.",
            });
        },
        onError: (error: any) => {
            toast({
                title: "Erro",
                description: error.message,
                variant: "destructive",
            });
        }
    });

    // Verificar se há algum atendimento em andamento (iniciou mas não finalizou)
    const inProgressAppointment = routeData?.stops?.find((s: any) =>
        s.appointment?.executionStartedAt && !s.appointment?.executionFinishedAt && !s.appointment?.executionStatus
    );

    // Timer global para atendimento em andamento
    const [elapsedSeconds, setElapsedSeconds] = useState(0);

    // Timer para tempo total da rota (desde routeStartedAt)
    const [routeElapsedSeconds, setRouteElapsedSeconds] = useState(0);

    useEffect(() => {
        if (!routeData?.route?.routeStartedAt) {
            setRouteElapsedSeconds(0);
            return;
        }

        const startTime = new Date(routeData.route.routeStartedAt).getTime();

        const updateTimer = () => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            setRouteElapsedSeconds(elapsed);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [routeData?.route?.routeStartedAt]);

    useEffect(() => {
        if (!inProgressAppointment?.appointment?.executionStartedAt) {
            setElapsedSeconds(0);
            return;
        }

        const startTime = new Date(inProgressAppointment.appointment.executionStartedAt).getTime();

        const updateTimer = () => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            setElapsedSeconds(elapsed);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [inProgressAppointment?.appointment?.executionStartedAt]);

    const formatTime = (seconds: number) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hrs > 0) {
            return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleAppointmentClick = (apt: any) => {
        // Se a rota já estiver finalizada, não permite editar
        if (routeData?.route?.status === 'finalizado' || routeData?.route?.status === 'cancelado') {
            return;
        }
        // Se a rota não foi iniciada, não permite abrir agendamentos
        if (!routeData?.route?.routeStartedAt) {
            toast({
                title: "Rota não iniciada",
                description: "Clique em 'Iniciar Rota' para começar os atendimentos.",
                variant: "destructive",
            });
            return;
        }
        // Bloquear se há outro atendimento em andamento (exceto se for o mesmo)
        if (inProgressAppointment && inProgressAppointment.appointment?.id !== apt.appointment?.id) {
            toast({
                title: "Atendimento em andamento",
                description: `Finalize o atendimento de "${inProgressAppointment.appointment?.clientName}" antes de iniciar outro.`,
                variant: "destructive",
            });
            return;
        }
        setSelectedAppointment(apt);
    };

    const handleStartRoute = async () => {
        if (routeData?.route?.id) {
            await startRouteMutation.mutateAsync(routeData.route.id);
        }
    };

    const handleSaveAppointment = async (data: any) => {
        if (selectedAppointment) {
            await updateAppointmentMutation.mutateAsync({
                id: selectedAppointment.appointment.id,
                data
            });
        }
    };

    const handleFinalizeRoute = async () => {
        if (routeData?.route?.id) {
            // Se o usuário selecionou "Finalizado com Pendências", salvamos como "finalizado" no banco (para travar edição)
            // mas adicionamos essa informação no motivo.
            let finalStatus = finalizeStatus;
            let finalMotivo = finalizeMotivo;

            if (finalizeStatus === 'incompleto') {
                finalStatus = 'finalizado';
                finalMotivo = finalizeMotivo ? `[Finalizado com Pendências] ${finalizeMotivo}` : '[Finalizado com Pendências]';
            }

            await finalizeRouteMutation.mutateAsync({
                id: routeData.route.id,
                data: {
                    status: finalStatus,
                    motivo: finalMotivo,
                    routeEndLocation: routeEndLocation // Onde finalizou o dia
                }
            });
        }
    };

    const getExecutionStatusColor = (status: string | null) => {
        if (!status) return 'bg-gray-100 text-gray-800 border-gray-200';
        if (status === 'concluido') return 'bg-green-100 text-green-800 border-green-200';
        return 'bg-red-100 text-red-800 border-red-200'; // Qualquer não realizado
    };

    const getExecutionStatusLabel = (status: string | null) => {
        if (!status) return 'Pendente';
        switch (status) {
            case 'concluido': return 'Concluído';
            case 'nao_realizado_cliente_ausente': return 'Ausente';
            case 'nao_realizado_cliente_pediu_remarcacao': return 'Remarcar';
            case 'nao_realizado_problema_tecnico': return 'Prob. Técnico';
            case 'nao_realizado_endereco_incorreto': return 'End. Incorreto';
            case 'nao_realizado_cliente_recusou': return 'Recusou';
            case 'nao_realizado_outro': return 'Outro';
            default: return 'Pendente';
        }
    };

    // Antigos helpers mantidos para compatibilidade se necessário, ou removidos se não usados
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'bg-green-100 text-green-800 border-green-200';
            case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
            case 'rescheduled': return 'bg-orange-100 text-orange-800 border-orange-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'completed': return 'Concluído';
            case 'in_progress': return 'Em Andamento';
            case 'cancelled': return 'Cancelado';
            case 'rescheduled': return 'Remarcado';
            case 'scheduled': return 'Pendente';
            default: return status;
        }
    };

    const handleOpenFinalizeModal = () => {
        // Validação no frontend: Verifica se todos os stops possuem executionStatus
        // Para stops sem appointment (raro), ignora.
        const pendingStops = stops.filter((s: any) => s.appointment && !s.appointment.executionStatus);

        if (pendingStops.length > 0) {
            toast({
                title: "Ação bloqueada",
                description: `Você possui ${pendingStops.length} atendimentos sem registro de execução. Preencha todos antes de fechar o romaneio.`,
                variant: "destructive"
            });
            return;
        }
        setShowFinalizeModal(true);
    };

    if (isLoading) {
        return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;
    }

    if (!routeData) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-gray-50">
                {user?.role === 'admin' && (
                    <div className="w-full max-w-md mb-8">
                        <Label className="mb-2 block text-left">Selecionar Prestador/Rota</Label>
                        <Select value={selectedRouteId || ''} onValueChange={setSelectedRouteId}>
                            <SelectTrigger className="bg-white">
                                <SelectValue placeholder="Selecione um prestador..." />
                            </SelectTrigger>
                            <SelectContent>
                                {activeProviders?.map((p: any) => (
                                    <SelectItem key={p.id} value={p.id} className="flex items-center justify-between">
                                        <span className="flex items-center gap-2">
                                            {p.responsibleName} - {p.title}
                                            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${p.status === 'finalizado' ? 'bg-green-100 text-green-800' :
                                                p.status === 'confirmado' ? 'bg-blue-100 text-blue-800' :
                                                    p.status === 'cancelado' ? 'bg-red-100 text-red-800' :
                                                        'bg-gray-100 text-gray-800'
                                                }`}>
                                                {p.status === 'finalizado' ? 'Finalizado' :
                                                    p.status === 'confirmado' ? 'Ativo' :
                                                        p.status === 'cancelado' ? 'Cancelado' :
                                                            p.status === 'draft' ? 'Rascunho' : p.status}
                                            </span>
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                <div className="bg-yellow-100 p-4 rounded-full mb-4">
                    <Calendar className="w-8 h-8 text-[#B8860B]" />
                </div>
                <h2 className="text-xl font-bold mb-2">Nenhuma rota ativa encontrada</h2>
                <p className="text-gray-500 mb-6">
                    {user?.role === 'admin'
                        ? "Selecione um prestador acima ou verifique se há rotas criadas para hoje."
                        : "Você não possui romaneios confirmados para a data de hoje."}
                </p>
                <Button variant="outline" onClick={() => window.location.reload()}>Atualizar</Button>
            </div>
        );
    }

    const { route, stops, summary } = routeData;
    const isRouteFinalized = ['finalizado', 'cancelado', 'incompleto'].includes(route.status);

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <header className="bg-white border-b sticky top-0 z-10 px-4 py-3 shadow-sm">
                <div className="flex flex-col gap-2 mb-2">
                    {user?.role === 'admin' && (
                        <div className="w-full">
                            <Select value={selectedRouteId || ''} onValueChange={setSelectedRouteId}>
                                <SelectTrigger className="h-8 text-xs bg-gray-50 border-gray-200">
                                    <SelectValue placeholder="Trocar prestador..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {activeProviders?.map((p: any) => (
                                        <SelectItem key={p.id} value={p.id} className="flex items-center">
                                            <span className="flex items-center gap-2">
                                                {p.responsibleName} - {p.title}
                                                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${p.status === 'finalizado' ? 'bg-green-100 text-green-800' :
                                                    p.status === 'confirmado' ? 'bg-blue-100 text-blue-800' :
                                                        p.status === 'cancelado' ? 'bg-red-100 text-red-800' :
                                                            'bg-gray-100 text-gray-800'
                                                    }`}>
                                                    {p.status === 'finalizado' ? 'Finalizado' :
                                                        p.status === 'confirmado' ? 'Ativo' :
                                                            p.status === 'cancelado' ? 'Cancelado' :
                                                                p.status === 'draft' ? 'Rascunho' : p.status}
                                                </span>
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-lg font-bold text-gray-900">{route.title}</h1>
                            <p className="text-sm text-gray-500 capitalize">
                                {format(new Date(route.date.toString().split('T')[0] + 'T12:00:00'), "EEEE, d 'de' MMMM", { locale: ptBR })}
                            </p>
                        </div>
                        <Badge variant={isRouteFinalized ? "secondary" : "default"} className={isRouteFinalized ? "" : "bg-[#DAA520]"}>
                            {route.status === 'confirmado' ? 'Ativa' : route.status}
                        </Badge>
                    </div>
                </div>

                {/* Summary Stats */}
                <div className="flex gap-4 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg">
                    <div className="flex items-center gap-1">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span>{summary.completedStops}/{summary.totalStops}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Navigation className="w-4 h-4 text-blue-600" />
                        <span>{(route.distanceTotal / 1000).toFixed(1)} km</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4 text-orange-600" />
                        <span>{Math.round(route.durationTotal / 60)} min</span>
                    </div>
                    {route.routeStartedAt && !isRouteFinalized && (
                        <div className="flex items-center gap-1 ml-auto">
                            <Timer className="w-4 h-4 text-purple-600" />
                            <span className="font-mono font-semibold text-purple-600">{formatTime(routeElapsedSeconds)}</span>
                        </div>
                    )}
                </div>
            </header>

            {/* Tabs: Rotas do Dia e Checklist */}
            <Tabs defaultValue="routes" className="w-full">
                <TabsList className="w-full grid grid-cols-2 mx-4 my-2">
                    <TabsTrigger value="routes" className="flex items-center gap-2">
                        <MapIcon className="w-4 h-4" />
                        Rotas do Dia
                    </TabsTrigger>
                    <TabsTrigger value="checklist" className="flex items-center gap-2">
                        <ClipboardCheck className="w-4 h-4" />
                        Checklist Veiculo
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="routes" className="mt-0">
                    {/* Map Actions */}
                    <div className="p-4 grid grid-cols-2 gap-3">
                        <Button variant="outline" className="w-full" onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${stops[0]?.lat},${stops[0]?.lng}`, '_blank')}>
                            <MapIcon className="w-4 h-4 mr-2" />
                            Abrir Mapa
                        </Button>
                        <Button variant="outline" className="w-full" onClick={() => setShowQRModal(true)}>
                            <QrCode className="w-4 h-4 mr-2" />
                            Ver QR Code
                        </Button>
                    </div>

                    {/* Stops List */}
                    <div className="px-4 space-y-3">
                        {stops.map((stop: any, index: number) => {
                            const isInProgress = stop.appointment?.executionStartedAt && !stop.appointment?.executionFinishedAt && !stop.appointment?.executionStatus;

                            return (
                                <Card
                                    key={stop.id}
                                    className={`overflow-hidden transition-all active:scale-[0.98] ${stop.appointment?.status === 'completed' ? 'opacity-75' : ''} ${isInProgress ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}
                                    onClick={() => handleAppointmentClick(stop)}
                                >
                                    <div className="flex">
                                        {/* Order Indicator */}
                                        <div className={`w-10 flex items-center justify-center border-r font-bold ${isInProgress ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                                            #{stop.order}
                                        </div>

                                        <div className="flex-1 p-3">
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="font-semibold text-gray-900 line-clamp-1">
                                                    {stop.appointment?.clientName}
                                                </span>
                                                {/* Timer se em andamento, senão status */}
                                                {isInProgress ? (
                                                    <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-mono font-bold animate-pulse">
                                                        <Timer className="w-3 h-3" />
                                                        {formatTime(elapsedSeconds)}
                                                    </div>
                                                ) : (
                                                    <Badge variant="outline" className={`text-xs ${getExecutionStatusColor(stop.appointment?.executionStatus)}`}>
                                                        {getExecutionStatusLabel(stop.appointment?.executionStatus)}
                                                    </Badge>
                                                )}
                                            </div>

                                            <p className="text-sm text-gray-600 mb-1 line-clamp-1">{stop.appointment?.serviceName}</p>

                                            <div className="flex items-start gap-1 text-xs text-gray-500 mt-2">
                                                <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                                <span className="line-clamp-2">{stop.address}</span>
                                            </div>
                                        </div>

                                        {!isRouteFinalized && (
                                            <div className="flex items-center px-2 text-gray-300">
                                                <ChevronRight className="w-5 h-5" />
                                            </div>
                                        )}
                                    </div>
                                </Card>
                            );
                        })}
                    </div>

                    {/* Footer Actions */}
                    {!isRouteFinalized && (
                        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg">
                            {!route.routeStartedAt ? (
                                // Rota não iniciada - mostrar botão Iniciar
                                <Button
                                    className="w-full bg-[#DAA520] hover:bg-[#B8860B] text-white h-12 text-lg"
                                    onClick={handleStartRoute}
                                    disabled={startRouteMutation.isPending}
                                >
                                    <PlayCircle className="w-5 h-5 mr-2" />
                                    {startRouteMutation.isPending ? 'Iniciando...' : 'Iniciar Rota'}
                                </Button>
                            ) : (
                                // Rota iniciada - mostrar botão Fechar Romaneio
                                <Button
                                    className="w-full bg-gray-900 hover:bg-gray-800 text-white h-12 text-lg"
                                    onClick={handleOpenFinalizeModal}
                                >
                                    <CheckCircle className="w-5 h-5 mr-2" />
                                    Fechar Romaneio
                                </Button>
                            )}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="checklist" className="mt-0">
                    <VehicleChecklistTab />
                </TabsContent>
            </Tabs>

            {/* Appointment Execution Modal */}
            {selectedAppointment && (
                <AppointmentExecutionModal
                    isOpen={!!selectedAppointment}
                    onClose={() => setSelectedAppointment(null)}
                    appointment={selectedAppointment.appointment}
                    onSave={handleSaveAppointment}
                    onStartExecution={async (appointmentId: number) => {
                        // Persistir executionStartedAt no banco
                        await updateAppointmentMutation.mutateAsync({
                            id: appointmentId,
                            data: { executionStartedAt: new Date().toISOString() }
                        });
                    }}
                />
            )}

            {/* Finalize Route Modal */}
            <Dialog open={showFinalizeModal} onOpenChange={setShowFinalizeModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Fechar Romaneio</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Status Final</Label>
                            <Select value={finalizeStatus} onValueChange={setFinalizeStatus}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {/* Só mostra "Finalizado (Tudo certo)" se TODOS os agendamentos tiverem status "concluido" */}
                                    {stops.every((s: any) => s.appointment?.executionStatus === 'concluido') && (
                                        <SelectItem value="finalizado">Finalizado (Tudo certo)</SelectItem>
                                    )}
                                    <SelectItem value="incompleto">Finalizado com Pendências</SelectItem>
                                    <SelectItem value="cancelado">Cancelado</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Observações / Motivo</Label>
                            <Textarea
                                value={finalizeMotivo}
                                onChange={(e) => setFinalizeMotivo(e.target.value)}
                                placeholder="Se houve algum problema, descreva aqui..."
                            />
                        </div>

                        {/* Opção de local de finalização */}
                        <div className="space-y-3 pt-2">
                            <Label className="font-medium">Onde você finalizou o dia?</Label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setRouteEndLocation('last_client')}
                                    className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${routeEndLocation === 'last_client'
                                        ? 'border-[#DAA520] bg-[#DAA520]/10'
                                        : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    <UserCheck className={`w-8 h-8 mb-2 ${routeEndLocation === 'last_client' ? 'text-[#DAA520]' : 'text-gray-400'}`} />
                                    <span className={`text-sm font-medium ${routeEndLocation === 'last_client' ? 'text-[#DAA520]' : 'text-gray-600'}`}>
                                        Último Cliente
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setRouteEndLocation('company_home')}
                                    className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${routeEndLocation === 'company_home'
                                        ? 'border-[#DAA520] bg-[#DAA520]/10'
                                        : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    <Home className={`w-8 h-8 mb-2 ${routeEndLocation === 'company_home' ? 'text-[#DAA520]' : 'text-gray-400'}`} />
                                    <span className={`text-sm font-medium ${routeEndLocation === 'company_home' ? 'text-[#DAA520]' : 'text-gray-600'}`}>
                                        Empresa/Casa
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowFinalizeModal(false)}>Cancelar</Button>
                        <Button onClick={handleFinalizeRoute} className="bg-[#DAA520] hover:bg-[#B8860B] text-white">
                            Confirmar Fechamento
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* QR Code Modal */}
            <Dialog open={showQRModal} onOpenChange={setShowQRModal}>
                <DialogContent className="sm:max-w-md flex flex-col items-center justify-center">
                    <DialogHeader>
                        <DialogTitle>QR Code da Rota</DialogTitle>
                    </DialogHeader>
                    <div className="p-6 bg-white rounded-lg shadow-sm">
                        {stops && stops.length > 0 ? (
                            <QRCode
                                value={`https://www.google.com/maps/dir/?api=1&destination=${stops[stops.length - 1]?.lat},${stops[stops.length - 1]?.lng}&waypoints=${stops.slice(0, -1).map((s: any) => `${s.lat},${s.lng}`).join('|')}`}
                                size={256}
                            />
                        ) : (
                            <p>Nenhuma parada encontrada.</p>
                        )}
                    </div>
                    <p className="text-sm text-gray-500 text-center mt-2">
                        Escaneie para abrir no Google Maps
                    </p>
                </DialogContent>
            </Dialog>
        </div>
    );
}
