import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SignaturePad } from './SignaturePad';
import { Camera, PenTool, CheckCircle, XCircle, Clock, Save, MapPin, AlertTriangle, HelpCircle, PlayCircle, Timer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AppointmentExecutionModalProps {
    isOpen: boolean;
    onClose: () => void;
    appointment: any;
    onSave: (data: any) => Promise<void>;
    onStartExecution?: (appointmentId: number) => Promise<void>; // Salvar no banco
}

export function AppointmentExecutionModal({ isOpen, onClose, appointment, onSave, onStartExecution }: AppointmentExecutionModalProps) {
    const { toast } = useToast();
    const [executionStatus, setExecutionStatus] = useState(appointment?.executionStatus || ''); // status da execução
    const [executionNotes, setExecutionNotes] = useState(appointment?.executionNotes || ''); // notas do prestador
    const [showSignaturePad, setShowSignaturePad] = useState(false);
    const [signature, setSignature] = useState<string | null>(appointment?.signature || null);
    const [photos, setPhotos] = useState<string[]>(appointment?.photos || []);
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ⏱️ Estado para controlar fluxo de 2 etapas
    const [isStarted, setIsStarted] = useState<boolean>(() => {
        // Se já tem executionStartedAt, considera iniciado
        return !!appointment?.executionStartedAt;
    });
    const [elapsedSeconds, setElapsedSeconds] = useState(0);

    // Registrar hora de início quando o atendimento é iniciado
    const [executionStartedAt, setExecutionStartedAt] = useState<string | null>(() => {
        return appointment?.executionStartedAt || null;
    });

    // 🆕 Effect: Sincroniza estado local se a prop appointment mudar
    // IMPORTANTE: Só sincroniza se o valor do servidor for mais "completo" que o local
    // para evitar resetar estado após o usuário clicar em "Iniciar"
    useEffect(() => {
        if (appointment) {
            // Se o servidor tem executionStartedAt e o local não, sincroniza
            // Se o local já tem executionStartedAt, mantém (pode ser mais recente que o servidor)
            if (appointment.executionStartedAt && !executionStartedAt) {
                setIsStarted(true);
                setExecutionStartedAt(appointment.executionStartedAt);
            } else if (!appointment.executionStartedAt && !executionStartedAt) {
                // Ambos null - garante estado inicial consistente
                setIsStarted(false);
            }
            // Se executionStartedAt local já existe, NÃO sobrescreve com null do servidor
        }
    }, [appointment?.executionStartedAt, appointment?.id]);

    // Timer para mostrar tempo decorrido
    useEffect(() => {
        if (!isStarted || !executionStartedAt) return;

        const startTime = new Date(executionStartedAt).getTime();

        const updateTimer = () => {
            const now = Date.now();
            const elapsed = Math.floor((now - startTime) / 1000);
            setElapsedSeconds(elapsed);
        };

        updateTimer(); // Atualiza imediatamente
        const interval = setInterval(updateTimer, 1000);

        return () => clearInterval(interval);
    }, [isStarted, executionStartedAt]);

    // Formatar tempo como MM:SS ou HH:MM:SS
    const formatTime = (seconds: number) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hrs > 0) {
            return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Handler para iniciar atendimento
    const [isStarting, setIsStarting] = useState(false);

    const handleStartExecution = async () => {
        try {
            setIsStarting(true);
            const now = new Date().toISOString();

            // Se tiver callback, salvar no banco primeiro
            if (onStartExecution && appointment?.id) {
                await onStartExecution(appointment.id);
            }

            setExecutionStartedAt(now);
            setIsStarted(true);
            toast({
                title: "Atendimento iniciado!",
                description: "O cronômetro começou. Registre o resultado quando terminar.",
            });
        } catch (error) {
            toast({
                title: "Erro ao iniciar",
                description: "Não foi possível iniciar o atendimento.",
                variant: "destructive",
            });
        } finally {
            setIsStarting(false);
        }
    };

    // Opções de status de execução
    const executionOptions = [
        { value: 'concluido', label: 'Concluído', icon: CheckCircle, color: 'text-green-600 bg-green-50 border-green-200' },
        { value: 'nao_realizado_cliente_ausente', label: 'Cliente Ausente', icon: XCircle, color: 'text-red-600 bg-red-50 border-red-200' },
        { value: 'nao_realizado_cliente_pediu_remarcacao', label: 'Pediu Remarcação', icon: Clock, color: 'text-orange-600 bg-orange-50 border-orange-200' },
        { value: 'nao_realizado_problema_tecnico', label: 'Problema Técnico', icon: AlertTriangle, color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
        { value: 'nao_realizado_endereco_incorreto', label: 'Endereço Incorreto', icon: MapPin, color: 'text-purple-600 bg-purple-50 border-purple-200' },
        { value: 'nao_realizado_cliente_recusou', label: 'Cliente Recusou', icon: XCircle, color: 'text-red-600 bg-red-50 border-red-200' },
        { value: 'nao_realizado_outro', label: 'Outro Motivo', icon: HelpCircle, color: 'text-gray-600 bg-gray-50 border-gray-200' },
    ];

    const handleSave = async () => {
        try {
            if (!executionStatus) {
                toast({ title: "Status obrigatório", description: "Selecione o resultado da visita.", variant: "destructive" });
                return;
            }

            // Se não for concluído, notas são obrigatórias
            if (executionStatus !== 'concluido' && (!executionNotes || executionNotes.trim().length < 5)) {
                toast({ title: "Motivo obrigatório", description: "Descreva o motivo/detalhes do que aconteceu.", variant: "destructive" });
                return;
            }

            // Se for concluído, assinatura é obrigatória
            if (executionStatus === 'concluido' && !signature) {
                toast({ title: "Assinatura obrigatória", description: "Colete a assinatura do cliente para concluir.", variant: "destructive" });
                return;
            }

            setIsSaving(true);

            // Mapeia status de execução para status administrativo (simplificado)
            // Backend pode refinar isso, mas vamos mandar algo coerente
            let adminStatus = 'in_progress';
            if (executionStatus === 'concluido') adminStatus = 'completed';
            else adminStatus = 'scheduled'; // Fica pendente para o administrativo resolver (ou cancelled?)

            await onSave({
                status: adminStatus,
                executionStatus,
                executionNotes,
                signature,
                photos,
                // Registrar tempos de execução para métricas do dashboard
                executionStartedAt,
                executionFinishedAt: new Date().toISOString(),
            });

            toast({
                title: "Sucesso",
                description: "Apontamento salvo com sucesso!",
                variant: "default",
            });
            onClose();
        } catch (error) {
            console.error(error);
            toast({
                title: "Erro",
                description: "Erro ao salvar agendamento.",
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSignatureSave = (sigData: string) => {
        setSignature(sigData);
        setShowSignaturePad(false);
    };

    // Upload de foto real (convertendo para Base64)
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                setPhotos([...photos, base64String]);
                toast({
                    title: "Foto adicionada",
                    description: "Foto carregada com sucesso.",
                });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAddPhoto = () => {
        fileInputRef.current?.click();
    };

    if (showSignaturePad) {
        return (
            <Dialog open={true} onOpenChange={() => setShowSignaturePad(false)}>
                <DialogContent className="max-w-full h-screen p-0 flex flex-col sm:max-w-lg sm:h-auto sm:rounded-lg">
                    <div className="p-2 border-b flex justify-between items-center bg-gray-50">
                        <DialogTitle className="text-lg font-semibold pl-2">Coletar Assinatura</DialogTitle>
                        <DialogDescription className="sr-only">Desenhe sua assinatura abaixo</DialogDescription>
                    </div>
                    <div className="flex-1 bg-gray-100 min-h-[300px]">
                        <SignaturePad onSave={handleSignatureSave} onCancel={() => setShowSignaturePad(false)} />
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
            />
            <DialogContent className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {isStarted ? 'Registrar Visita' : 'Iniciar Atendimento'}
                    </DialogTitle>
                    <DialogDescription className="sr-only">Preencha os detalhes da execução do serviço</DialogDescription>
                </DialogHeader>

                {/* Info do Cliente */}
                <div className="bg-gray-50 p-3 rounded-lg mb-4">
                    <p className="font-semibold text-gray-900">{appointment?.clientName}</p>
                    <p className="text-sm text-gray-600">{appointment?.serviceName}</p>
                </div>

                {!isStarted ? (
                    /* ETAPA 1: Botão de Iniciar Atendimento + Foto opcional */
                    <div className="flex flex-col items-center justify-center py-6 space-y-4">
                        <div className="w-20 h-20 bg-[#DAA520]/10 rounded-full flex items-center justify-center">
                            <PlayCircle className="w-10 h-10 text-[#DAA520]" />
                        </div>
                        <div className="text-center">
                            <h3 className="text-lg font-semibold text-gray-900 mb-1">Pronto para iniciar?</h3>
                            <p className="text-sm text-gray-500">O cronômetro começará ao clicar em iniciar.</p>
                        </div>

                        {/* Fotos da chegada (opcional) */}
                        {photos.length > 0 && (
                            <div className="w-full">
                                <Label className="text-sm text-gray-600 mb-2 block">Fotos da chegada:</Label>
                                <div className="flex flex-wrap gap-2">
                                    {photos.map((photo, idx) => (
                                        <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border">
                                            <img src={photo} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                                            <button
                                                onClick={() => setPhotos(photos.filter((_, i) => i !== idx))}
                                                className="absolute top-0 right-0 bg-red-500 text-white rounded-bl-lg p-0.5"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3 w-full max-w-xs">
                            {/* Botão de foto na chegada */}
                            <Button
                                variant="outline"
                                onClick={handleAddPhoto}
                                className="flex-1 h-12"
                            >
                                <Camera className="w-5 h-5 mr-1" />
                                Foto
                            </Button>

                            {/* Botão de iniciar */}
                            <Button
                                onClick={handleStartExecution}
                                disabled={isStarting}
                                className="flex-[2] h-12 text-lg bg-[#DAA520] hover:bg-[#B8860B] text-white"
                            >
                                <PlayCircle className="w-5 h-5 mr-1" />
                                {isStarting ? 'Iniciando...' : 'Iniciar'}
                            </Button>
                        </div>

                        <p className="text-xs text-gray-400 text-center">
                            A foto é opcional - registre a chegada ao local
                        </p>
                    </div>
                ) : (
                    /* ETAPA 2: Formulário de Registro */
                    <>
                        {/* Timer */}
                        <div className="flex items-center justify-center py-3 bg-blue-50 rounded-lg mb-4">
                            <Timer className="w-5 h-5 text-blue-600 mr-2" />
                            <span className="text-2xl font-mono font-bold text-blue-600">{formatTime(elapsedSeconds)}</span>
                        </div>

                        <div className="space-y-6">
                            {/* Status Execution Selector */}
                            <div className="space-y-3">
                                <Label className="text-base">O que aconteceu na visita?</Label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {executionOptions.map((opt) => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setExecutionStatus(opt.value)}
                                            className={`
                                        flex items-center p-3 rounded-lg border-2 transition-all text-left
                                        ${executionStatus === opt.value
                                                    ? `border-current ring-1 ring-offset-0 ${opt.color}`
                                                    : 'border-gray-200 hover:border-gray-300 text-gray-600 bg-white'}
                                    `}
                                        >
                                            <opt.icon className="w-5 h-5 mr-3 flex-shrink-0" />
                                            <span className="font-medium">{opt.label}</span>
                                            {executionStatus === opt.value && <CheckCircle className="w-4 h-4 ml-auto" />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Execution Notes */}
                            <div className="space-y-2">
                                <Label className="flex justify-between">
                                    <span>Relato / Observações</span>
                                    {executionStatus !== 'concluido' && executionStatus !== '' && (
                                        <span className="text-red-500 text-xs font-bold uppercase tracking-wide">Obrigatório</span>
                                    )}
                                </Label>
                                <Textarea
                                    placeholder={executionStatus === 'concluido' ? "Observações opcionais..." : "Descreva o motivo de não ter realizado o serviço..."}
                                    value={executionNotes}
                                    onChange={(e) => setExecutionNotes(e.target.value)}
                                    className="min-h-[100px]"
                                />
                            </div>

                            {/* Photos & Signature */}
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <Button variant="outline" onClick={handleAddPhoto} className="h-auto py-4 flex flex-col gap-2">
                                    <Camera className="w-6 h-6" />
                                    <span>Adicionar Foto ({photos.length})</span>
                                </Button>

                                {executionStatus === 'concluido' && (
                                    <Button
                                        variant="outline"
                                        onClick={() => setShowSignaturePad(true)}
                                        className={`h-auto py-4 flex flex-col gap-2 ${signature ? 'border-green-500 bg-green-50 text-green-700' : ''}`}
                                    >
                                        <PenTool className="w-6 h-6" />
                                        <span>{signature ? 'Assinatura Coletada' : 'Coletar Assinatura'}</span>
                                    </Button>
                                )}
                            </div>
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0 sticky bottom-0 bg-white pt-2 border-t mt-4">
                            <Button variant="outline" onClick={onClose}>Cancelar</Button>
                            <Button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="bg-[#DAA520] hover:bg-[#B8860B] text-white"
                            >
                                <Save className="w-4 h-4 mr-2" />
                                {isSaving ? 'Salvando...' : 'Confirmar Registro'}
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
