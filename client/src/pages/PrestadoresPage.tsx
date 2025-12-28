import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
    MapPin, Calendar, Navigation, CheckCircle, Clock,
    AlertTriangle, ChevronRight, QrCode, LogOut, Map as MapIcon, ClipboardCheck, PlayCircle, Home, UserCheck, Timer, Coffee, Wrench, Fuel, FileWarning, DollarSign, Loader2
} from 'lucide-react';
import QRCode from "react-qr-code";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { useLocationTracker } from "@/hooks/useLocationTracker";

export default function PrestadoresPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Alterado para usar ID para evitar estado stale
    const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | number | null>(null);
    const [showFinalizeModal, setShowFinalizeModal] = useState(false);
    const [showQRModal, setShowQRModal] = useState(false);
    const [finalizeStatus, setFinalizeStatus] = useState('finalizado');
    const [finalizeMotivo, setFinalizeMotivo] = useState('');
    const [routeEndLocation, setRouteEndLocation] = useState<'last_client' | 'company_home'>('last_client');

    // Estado para modal de ocorrência
    const [showOccurrenceModal, setShowOccurrenceModal] = useState(false);
    const [occurrenceType, setOccurrenceType] = useState<string>('');
    const [occurrenceNotes, setOccurrenceNotes] = useState('');
    const [occurrenceTime, setOccurrenceTime] = useState(''); // Horário aproximado HH:mm
    const [occurrenceDuration, setOccurrenceDuration] = useState(''); // Duração em minutos

    // Estados para abastecimento (quando tipo === 'abastecimento')
    const [fuelVehicleId, setFuelVehicleId] = useState<number | null>(null);
    const [fuelType, setFuelType] = useState<string>('gasolina');
    const [fuelLiters, setFuelLiters] = useState('');
    const [fuelPricePerLiter, setFuelPricePerLiter] = useState('');
    const [fuelTotalCost, setFuelTotalCost] = useState('');
    const [fuelOdometerKm, setFuelOdometerKm] = useState('');

    const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

    // Buscar veículos para select de abastecimento
    const { data: vehiclesData } = useQuery({
        queryKey: ['/api/vehicles'],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/vehicles");
            return res.json();
        }
    });

    // Buscar lista de prestadores ativos (apenas admin)
    const { data: activeProviders } = useQuery({
        queryKey: ['/api/provider/active-today'],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/provider/active-today");
            return res.json();
        },
        enabled: user?.role === 'admin'
    });

    // Buscar regras de negócio para mensagem WhatsApp
    const { data: businessRules } = useQuery({
        queryKey: ['/api/business-rules'],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/business-rules");
            return res.json();
        }
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

    // 🆕 Derived State: Garante que os dados do modal estejam sempre frescos vindo do React Query
    const selectedAppointmentData = React.useMemo(() => {
        if (!selectedAppointmentId || !routeData?.stops) return null;
        // The ID stored might be the stop.id (UUID) or appointment.id (number)
        return routeData.stops.find((s: any) => s.id === selectedAppointmentId || s.appointment?.id === selectedAppointmentId) || null;
    }, [selectedAppointmentId, routeData?.stops]);

    // Hook de rastreamento de localização
    const tracker = useLocationTracker({
        // Adicionando suporte a em_andamento (DB), in_progress (Legado) ou Confirmado com Start (Atual)
        enabled: (user?.role === 'provider' || user?.role === 'driver' || user?.role === 'admin') &&
            !!routeData?.route &&
            (
                routeData.route.status === 'em_andamento' ||
                routeData.route.status === 'in_progress' ||
                (routeData.route.status === 'confirmado' && !!routeData.route.routeStartedAt)
            ),
        userId: user?.id,
        routeId: routeData?.route?.id
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
        mutationFn: async ({ id, startLocationData }: { id: string, startLocationData?: any }) => {
            const res = await apiRequest("PATCH", `/api/routes/${id}/start`, { startLocationData });
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

    const createOccurrenceMutation = useMutation({
        mutationFn: async ({ routeId, type, notes, approximateTime, durationMinutes, fuelData }: {
            routeId: string;
            type: string;
            notes: string;
            approximateTime?: string;
            durationMinutes?: number;
            fuelData?: {
                vehicleId: number;
                fuelType: string;
                liters: string;
                pricePerLiter: string;
                totalCost: string;
                odometerKm?: string;
            };
        }) => {
            // Criar ocorrência
            const occurrenceRes = await apiRequest("POST", `/api/provider/route/${routeId}/occurrence`, {
                type,
                notes,
                approximateTime,
                durationMinutes
            });
            const occurrence = await occurrenceRes.json();

            // Se for abastecimento com dados válidos, criar registro de abastecimento
            if (type === 'abastecimento' && fuelData && fuelData.vehicleId && fuelData.liters && fuelData.pricePerLiter && fuelData.totalCost) {
                await apiRequest("POST", "/api/fuel-records", {
                    vehicleId: fuelData.vehicleId,
                    fuelType: fuelData.fuelType,
                    liters: fuelData.liters,
                    pricePerLiter: fuelData.pricePerLiter,
                    totalCost: fuelData.totalCost,
                    odometerKm: fuelData.odometerKm ? parseInt(fuelData.odometerKm) : null,
                    notes: notes || null,
                    occurrenceId: occurrence.id
                });
            }

            return occurrence;
        },
        onSuccess: () => {
            setShowOccurrenceModal(false);
            setOccurrenceType('');
            setOccurrenceNotes('');
            setOccurrenceTime('');
            setOccurrenceDuration('');
            // Reset campos de abastecimento
            setFuelVehicleId(null);
            setFuelType('gasolina');
            setFuelLiters('');
            setFuelPricePerLiter('');
            setFuelTotalCost('');
            setFuelOdometerKm('');
            toast({
                title: "Ocorrência registrada!",
                description: occurrenceType === 'abastecimento'
                    ? "Abastecimento registrado com sucesso."
                    : "A pausa foi registrada com sucesso.",
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

    // Gerar link WhatsApp com mensagem personalizada
    const generateWhatsAppLink = (phone: string, appointment: any) => {
        // Limpar telefone (remover caracteres não numéricos)
        const cleanPhone = phone?.replace(/\D/g, '') || '';
        if (!cleanPhone) return null;

        // Adicionar código do Brasil se não tiver
        const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

        // Template padrão ou da configuração
        let message = businessRules?.whatsappMessageTemplate ||
            "Olá, {nome_cliente}! Sou da {nome_empresa}, estou a caminho para realizar o serviço {nome_servico}. Previsão de chegada: {horario_estimado}.";

        // Substituir variáveis
        message = message
            .replace(/{nome_cliente}/g, appointment?.clientName || 'Cliente')
            .replace(/{nome_empresa}/g, (user as any)?.companyName || user?.name || 'Empresa')
            .replace(/{nome_servico}/g, appointment?.serviceName || 'serviço')
            .replace(/{data_agendamento}/g, appointment?.scheduledDate ? format(new Date(appointment.scheduledDate), 'dd/MM/yyyy') : '')
            .replace(/{horario_estimado}/g, appointment?.scheduledTime || 'em breve')
            .replace(/{endereco}/g, appointment?.clientAddress || '');

        // Adicionar assinatura fixa
        message += "\n\nFeito por, RotaFácil Frotas.";

        return `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
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
        // Usando ID ao invés do objeto direto
        setSelectedAppointmentId(apt.id);
    };

    const handleStartRoute = async () => {
        if (routeData?.route?.id) {
            let location = null;
            try {
                location = await tracker.getCurrentLocation();
            } catch (e) {
                console.warn("Não foi possível obter localização ao iniciar rota", e);
            }
            await startRouteMutation.mutateAsync({
                id: routeData.route.id,
                startLocationData: location
            });
        }
    };

    const handleSaveAppointment = async (data: any) => {
        if (selectedAppointmentData) {
            // Se for conclusão ou falha, tenta pegar localização final
            let endLocation = undefined;
            if (data.executionStatus && ['concluido', 'nao_realizado_cliente_ausente', 'nao_realizado_cliente_pediu_remarcacao', 'nao_realizado_problema_tecnico', 'nao_realizado_endereco_incorreto', 'nao_realizado_cliente_recusou', 'nao_realizado_falta_material', 'nao_realizado_outro'].includes(data.executionStatus)) {
                try {
                    endLocation = await tracker.getCurrentLocation();
                } catch (e) {
                    console.warn("Sem localização de fim de atendimento");
                }
            }

            await updateAppointmentMutation.mutateAsync({
                id: selectedAppointmentData.appointment.id,
                data: {
                    ...data,
                    executionEndLocation: endLocation
                }
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

            let routeEndLocationData = null;
            try {
                routeEndLocationData = await tracker.getCurrentLocation();
            } catch (e) {
                console.warn("Não foi possível obter localização ao finalizar rota", e);
            }

            await finalizeRouteMutation.mutateAsync({
                id: routeData.route.id,
                data: {
                    status: finalStatus,
                    motivo: finalMotivo,
                    routeEndLocation: routeEndLocation, // Onde finalizou o dia (tipo)
                    endLocationData: routeEndLocationData // Coordenadas GPS
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
            case 'nao_realizado_falta_material': return 'Falta Material';
            case 'nao_realizado_outro': return 'Outro';
            default: return 'Pendente';
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
            <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-gray-50 dark:bg-zinc-950">
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
                <h2 className="text-xl font-bold mb-2 dark:text-zinc-100">Nenhuma rota ativa encontrada</h2>
                <p className="text-gray-500 dark:text-zinc-400 mb-6">
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

    // Contar agendamentos sem status de execução
    const pendingAppointments = stops?.filter((s: any) => !s.appointment?.executionStatus)?.length || 0;
    const canCloseRoute = pendingAppointments === 0 && !isRouteFinalized;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 pb-20">
            {/* Header */}
            <header className="bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 sticky top-0 z-10 px-4 py-3 shadow-sm">
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
                            <h1 className="text-lg font-bold text-gray-900 dark:text-zinc-100">{route.title}</h1>
                            <p className="text-sm text-gray-500 dark:text-zinc-400 capitalize">
                                {format(new Date(route.date.toString().split('T')[0] + 'T12:00:00'), "EEEE, d 'de' MMMM", { locale: ptBR })}
                            </p>
                        </div>
                        <Badge variant={isRouteFinalized ? "secondary" : "default"} className={isRouteFinalized ? "" : "bg-[#DAA520]"}>
                            {route.status === 'confirmado' ? 'Ativa' : route.status}
                        </Badge>
                    </div>
                </div>

                {/* Summary Stats */}
                <div className="flex gap-4 text-sm text-gray-600 dark:text-zinc-400 bg-gray-50 dark:bg-zinc-800 p-2 rounded-lg">
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
                    <div className="p-4 grid grid-cols-3 gap-2">
                        <Button variant="outline" className="w-full text-xs" onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${stops[0]?.lat},${stops[0]?.lng}`, '_blank')}>
                            <MapIcon className="w-4 h-4 mr-1" />
                            Mapa
                        </Button>
                        <Button variant="outline" className="w-full text-xs" onClick={() => setShowQRModal(true)}>
                            <QrCode className="w-4 h-4 mr-1" />
                            QR Code
                        </Button>
                        {route.routeStartedAt && !isRouteFinalized && (
                            <Button
                                variant="outline"
                                className="w-full text-xs border-orange-300 text-orange-600 hover:bg-orange-50"
                                onClick={() => setShowOccurrenceModal(true)}
                            >
                                <FileWarning className="w-4 h-4 mr-1" />
                                Ocorrência
                            </Button>
                        )}
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
                                                <span className="font-semibold text-gray-900 dark:text-zinc-100 line-clamp-1">
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

                                            <p className="text-sm text-gray-600 dark:text-zinc-400 mb-1 line-clamp-1">{stop.appointment?.serviceName}</p>

                                            {/* 💵 Aviso de pagamento "No Ato" */}
                                            {stop.appointment?.paymentType === 'no_ato' && !stop.appointment?.paymentStatus && (
                                                <div className="flex items-center gap-2 bg-amber-100 border border-amber-300 rounded px-2 py-1 mb-1">
                                                    <DollarSign className="w-4 h-4 text-amber-700" />
                                                    <span className="text-xs font-bold text-amber-800">
                                                        COBRAR: R$ {(Number(stop.appointment?.servicePrice || 0) + Number(stop.appointment?.additionalValue || 0)).toFixed(2)}
                                                    </span>
                                                </div>
                                            )}
                                            {stop.appointment?.paymentType === 'antecipado' && (
                                                <div className="flex items-center gap-1 text-xs text-green-600 mb-1">
                                                    <CheckCircle className="w-3 h-3" />
                                                    <span>Pago Antecipado</span>
                                                </div>
                                            )}

                                            <div className="flex items-center justify-between mt-2">
                                                <div className="flex items-start gap-1 text-xs text-gray-500 flex-1">
                                                    <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                                    <span className="line-clamp-1">{stop.address}</span>
                                                </div>

                                                {/* Botões WhatsApp */}
                                                <div className="flex gap-2 ml-2" onClick={(e) => e.stopPropagation()}>
                                                    {/* Botão Google Maps */}
                                                    <a
                                                        href={`https://www.google.com/maps/dir/?api=1&destination=${stop.lat && stop.lng ? `${stop.lat},${stop.lng}` : encodeURIComponent(stop.address || stop.appointment?.address || '')}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-2 rounded-full bg-blue-500 hover:bg-blue-600 text-white transition-colors shadow-sm"
                                                        title="Abrir no Google Maps"
                                                    >
                                                        <MapIcon size={18} />
                                                    </a>

                                                    {stop.appointment?.phone1 && generateWhatsAppLink(stop.appointment.phone1, stop.appointment) && (
                                                        <a
                                                            href={generateWhatsAppLink(stop.appointment.phone1, stop.appointment)!}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="p-2 rounded-full bg-green-500 hover:bg-green-600 text-white transition-colors shadow-sm"
                                                            title={`WhatsApp: ${stop.appointment.phone1}`}
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                                            </svg>
                                                        </a>
                                                    )}
                                                    {stop.appointment?.phone2 && generateWhatsAppLink(stop.appointment.phone2, stop.appointment) && (
                                                        <a
                                                            href={generateWhatsAppLink(stop.appointment.phone2, stop.appointment)!}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="p-2 rounded-full bg-green-500 hover:bg-green-600 text-white transition-colors shadow-sm"
                                                            title={`WhatsApp: ${stop.appointment.phone2}`}
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                                            </svg>
                                                        </a>
                                                    )}
                                                </div>
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

                    {/* Footer for Start/End Route */}
                    <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-zinc-900 border-t dark:border-zinc-800 shadow-lg z-20">
                        {(!route.routeStartedAt) ? (
                            // Rota não iniciada - mostrar botão Iniciar
                            <Button
                                className="w-full bg-[#DAA520] hover:bg-[#B8860B] text-white h-12 text-lg"
                                onClick={handleStartRoute}
                                disabled={startRouteMutation.isPending}
                            >
                                {startRouteMutation.isPending ? (
                                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                ) : (
                                    <PlayCircle className="w-5 h-5 mr-2" />
                                )}
                                {startRouteMutation.isPending ? 'Iniciando...' : 'Iniciar Rota'}
                            </Button>
                        ) : (
                            // Rota iniciada - mostrar botão Fechar Romaneio
                            <div className="flex flex-col gap-2">
                                <Button
                                    className={`w-full h-12 text-lg ${canCloseRoute ? 'bg-gray-900 hover:bg-gray-800' : 'bg-gray-400 cursor-not-allowed'} text-white`}
                                    onClick={handleOpenFinalizeModal}
                                    disabled={!canCloseRoute || finalizeRouteMutation.isPending}
                                    type="button"
                                >
                                    {finalizeRouteMutation.isPending ? (
                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                    ) : (
                                        <CheckCircle className="w-5 h-5 mr-2" />
                                    )}
                                    {finalizeRouteMutation.isPending ? 'Finalizando...' : 'Fechar Romaneio'}
                                </Button>
                                {!canCloseRoute && (
                                    <p className="text-center text-sm text-orange-600">
                                        {isRouteFinalized
                                            ? '✓ Romaneio já foi encerrado'
                                            : `⚠️ Finalize ${pendingAppointments} atendimento${pendingAppointments > 1 ? 's' : ''} pendente${pendingAppointments > 1 ? 's' : ''}`
                                        }
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="checklist" className="mt-0">
                    <VehicleChecklistTab />
                </TabsContent>
            </Tabs>

            {/* Appointment Execution Modal */}
            {
                selectedAppointmentData && (
                    <AppointmentExecutionModal
                        isOpen={!!selectedAppointmentData}
                        onClose={() => setSelectedAppointmentId(null)}
                        appointment={selectedAppointmentData.appointment}
                        onSave={handleSaveAppointment}
                        onStartExecution={async (appointmentId: number) => {
                            // Persistir executionStartedAt no banco + Location
                            let startLocation = undefined;
                            try {
                                startLocation = await tracker.getCurrentLocation();
                            } catch (e) { console.warn("Sem localização de inicio"); }

                            await updateAppointmentMutation.mutateAsync({
                                id: appointmentId,
                                data: {
                                    executionStartedAt: new Date().toISOString(),
                                    executionStartLocation: startLocation
                                }
                            });
                        }}
                    />
                )
            }

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
                        <Button variant="outline" onClick={() => setShowFinalizeModal(false)} disabled={finalizeRouteMutation.isPending}>Cancelar</Button>
                        <Button
                            onClick={handleFinalizeRoute}
                            className="bg-[#DAA520] hover:bg-[#B8860B] text-white"
                            disabled={finalizeRouteMutation.isPending}
                        >
                            {finalizeRouteMutation.isPending ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Finalizando...
                                </>
                            ) : (
                                'Confirmar Fechamento'
                            )}
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

            {/* Occurrence Modal */}
            <Dialog open={showOccurrenceModal} onOpenChange={setShowOccurrenceModal}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileWarning className="w-5 h-5 text-orange-500" />
                            Registrar Ocorrência
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <Label className="font-medium">Tipo de Ocorrência</Label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setOccurrenceType('almoco')}
                                className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${occurrenceType === 'almoco'
                                    ? 'border-orange-500 bg-orange-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <Coffee className={`w-8 h-8 mb-2 ${occurrenceType === 'almoco' ? 'text-orange-500' : 'text-gray-400'}`} />
                                <span className={`text-sm font-medium ${occurrenceType === 'almoco' ? 'text-orange-600' : 'text-gray-600'}`}>
                                    Almoço
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setOccurrenceType('problema_tecnico')}
                                className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${occurrenceType === 'problema_tecnico'
                                    ? 'border-orange-500 bg-orange-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <Wrench className={`w-8 h-8 mb-2 ${occurrenceType === 'problema_tecnico' ? 'text-orange-500' : 'text-gray-400'}`} />
                                <span className={`text-sm font-medium ${occurrenceType === 'problema_tecnico' ? 'text-orange-600' : 'text-gray-600'}`}>
                                    Problema Técnico
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setOccurrenceType('abastecimento')}
                                className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${occurrenceType === 'abastecimento'
                                    ? 'border-orange-500 bg-orange-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <Fuel className={`w-8 h-8 mb-2 ${occurrenceType === 'abastecimento' ? 'text-orange-500' : 'text-gray-400'}`} />
                                <span className={`text-sm font-medium ${occurrenceType === 'abastecimento' ? 'text-orange-600' : 'text-gray-600'}`}>
                                    Abastecimento
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setOccurrenceType('outro')}
                                className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${occurrenceType === 'outro'
                                    ? 'border-orange-500 bg-orange-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <AlertTriangle className={`w-8 h-8 mb-2 ${occurrenceType === 'outro' ? 'text-orange-500' : 'text-gray-400'}`} />
                                <span className={`text-sm font-medium ${occurrenceType === 'outro' ? 'text-orange-600' : 'text-gray-600'}`}>
                                    Outro
                                </span>
                            </button>
                        </div>

                        {occurrenceType === 'abastecimento' && (
                            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200 space-y-3 animate-in fade-in slide-in-from-top-2">
                                <h4 className="font-semibold text-orange-800 text-sm flex items-center gap-2">
                                    <Fuel className="w-4 h-4" /> Dados do Abastecimento
                                </h4>

                                <div className="space-y-2">
                                    <Label>Veículo</Label>
                                    <Select value={fuelVehicleId?.toString()} onValueChange={(val) => setFuelVehicleId(parseInt(val))}>
                                        <SelectTrigger className="bg-white">
                                            <SelectValue placeholder="Selecione o veículo" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {vehiclesData?.map((v: any) => (
                                                <SelectItem key={v.id} value={v.id.toString()}>
                                                    {v.plate} - {v.model} {v.brand}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <Label>Tipo</Label>
                                        <Select value={fuelType} onValueChange={setFuelType}>
                                            <SelectTrigger className="bg-white">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="gasolina">Gasolina</SelectItem>
                                                <SelectItem value="etanol">Etanol</SelectItem>
                                                <SelectItem value="diesel_s10">Diesel S10</SelectItem>
                                                <SelectItem value="diesel_s500">Diesel S500</SelectItem>
                                                <SelectItem value="gnv">GNV</SelectItem>
                                                <SelectItem value="eletrico">Elétrico</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Odômetro (km)</Label>
                                        <Input type="number" value={fuelOdometerKm} onChange={(e) => setFuelOdometerKm(e.target.value)} className="bg-white" placeholder="Ex: 15400" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                    <div className="space-y-2">
                                        <Label>Litros</Label>
                                        <Input
                                            type="number"
                                            value={fuelLiters}
                                            onChange={(e) => {
                                                const l = e.target.value;
                                                setFuelLiters(l);
                                                if (l && fuelPricePerLiter) {
                                                    setFuelTotalCost((parseFloat(l) * parseFloat(fuelPricePerLiter)).toFixed(2));
                                                }
                                            }}
                                            className="bg-white"
                                            placeholder="0.00"
                                            step="0.01"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Preço/L</Label>
                                        <Input
                                            type="number"
                                            value={fuelPricePerLiter}
                                            onChange={(e) => {
                                                const p = e.target.value;
                                                setFuelPricePerLiter(p);
                                                if (fuelLiters && p) {
                                                    setFuelTotalCost((parseFloat(fuelLiters) * parseFloat(p)).toFixed(2));
                                                }
                                            }}
                                            className="bg-white"
                                            placeholder="0.00"
                                            step="0.001"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Total R$</Label>
                                        <Input
                                            type="number"
                                            value={fuelTotalCost}
                                            onChange={(e) => setFuelTotalCost(e.target.value)}
                                            className="bg-white"
                                            placeholder="0.00"
                                            step="0.01"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label>Horário Aproximado</Label>
                                <Input
                                    type="time"
                                    value={occurrenceTime}
                                    onChange={(e) => setOccurrenceTime(e.target.value)}
                                    placeholder="HH:mm"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Duração (minutos)</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={occurrenceDuration}
                                    onChange={(e) => setOccurrenceDuration(e.target.value)}
                                    placeholder="Ex: 60"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Observações (opcional)</Label>
                            <Textarea
                                placeholder="Descreva a ocorrência..."
                                value={occurrenceNotes}
                                onChange={(e) => setOccurrenceNotes(e.target.value)}
                                rows={3}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowOccurrenceModal(false)}>Cancelar</Button>
                        <Button
                            onClick={() => {
                                const durationNum = occurrenceDuration ? parseInt(occurrenceDuration) : undefined;
                                createOccurrenceMutation.mutate({
                                    routeId: routeData?.route?.id,
                                    type: occurrenceType,
                                    notes: occurrenceNotes,
                                    approximateTime: occurrenceTime || undefined,
                                    durationMinutes: durationNum,
                                    fuelData: occurrenceType === 'abastecimento' ? {
                                        vehicleId: fuelVehicleId!,
                                        fuelType,
                                        liters: fuelLiters,
                                        pricePerLiter: fuelPricePerLiter,
                                        totalCost: fuelTotalCost,
                                        odometerKm: fuelOdometerKm || undefined
                                    } : undefined
                                });
                            }}
                            disabled={!occurrenceType || createOccurrenceMutation.isPending || (occurrenceType === 'abastecimento' && (!fuelVehicleId || !fuelLiters || !fuelTotalCost))}
                            className="bg-orange-500 hover:bg-orange-600 text-white"
                        >
                            {createOccurrenceMutation.isPending ? 'Registrando...' : 'Registrar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
}
