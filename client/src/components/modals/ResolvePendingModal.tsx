import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Checkbox } from "../ui/checkbox";
import { AlertCircle, Check, Phone } from "lucide-react";
import { Alert, AlertDescription } from "../ui/alert";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type PendingReasonType =
    | 'nao_realizado_cliente_ausente'
    | 'nao_realizado_cliente_pediu_remarcacao'
    | 'nao_realizado_problema_tecnico'
    | 'nao_realizado_endereco_incorreto'
    | 'nao_realizado_cliente_recusou'
    | 'nao_realizado_falta_material'
    | 'nao_realizado_outro'
    | 'payment_pending' // 💰 Novo: pendĂȘncia de pagamento
    | (string & {});
type ResolutionActionType = 'rescheduled' | 'cancelled' | 'resolved_by_provider' | 'awaiting' | 'payment_confirmed'; // 💰 Novo: pagamento confirmado

interface PendingAppointment {
    id: number;
    clientName?: string;
    clientPhone?: string;
    serviceName?: string;
    servicePrice?: number | null; // 💰 Preço do serviço
    originalDate?: string | Date; // Can be string from API or Date object
    providerName?: string;
    executionNotes?: string;
    paymentNotes?: string; // 💰 Notas de pagamento
    clientId?: number;
    clientAddress?: {
        cep: string;
        logradouro: string;
        numero: string;
        complemento?: string;
        bairro: string;
        cidade: string;
        estado: string;
    };
    technicianId?: number;
    teamId?: number;
    rescheduleCount?: number;
    pendingType?: 'execution' | 'payment'; // 💰 Tipo de pendĂȘncia
}

interface ResolvePendingModalProps {
    isOpen: boolean;
    onClose: () => void;
    appointment: PendingAppointment;
    pendingReason: PendingReasonType;
    onResolve: (resolutionData: any) => Promise<void>;
}

const pendingReasonLabels: Record<string, string> = {
    nao_realizado_cliente_ausente: "Cliente ausente",
    nao_realizado_cliente_pediu_remarcacao: "Pediu remarcação",
    nao_realizado_problema_tecnico: "Problema técnico",
    nao_realizado_endereco_incorreto: "Endereço incorreto",
    nao_realizado_cliente_recusou: "Cliente recusou",
    nao_realizado_falta_material: "Falta de material",
    nao_realizado_outro: "Outro motivo",
    payment_pending: "Falta de pagamento", // 💰 Novo label
};

const actionLabels: Record<ResolutionActionType, string> = {
    rescheduled: "Reagendar",
    cancelled: "Cancelar definitivamente",
    resolved_by_provider: "Resolvido pelo prestador",
    awaiting: "Aguardando retorno",
    payment_confirmed: "Confirmar pagamento", // 💰 Novo label
};

export function ResolvePendingModal({
    isOpen,
    onClose,
    appointment,
    pendingReason,
    onResolve,
}: ResolvePendingModalProps) {
    const [resolutionAction, setResolutionAction] = useState<ResolutionActionType>('rescheduled');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [newDate, setNewDate] = useState('');
    const [newTime, setNewTime] = useState('');
    const [cancellationReason, setCancellationReason] = useState('');
    const [providerResolutionDetails, setProviderResolutionDetails] = useState('');
    const [addressCorrected, setAddressCorrected] = useState(false);
    const [clientAddress, setClientAddress] = useState({
        cep: appointment.clientAddress?.cep || '',
        logradouro: appointment.clientAddress?.logradouro || '',
        numero: appointment.clientAddress?.numero || '',
        complemento: appointment.clientAddress?.complemento || '',
        bairro: appointment.clientAddress?.bairro || '',
        cidade: appointment.clientAddress?.cidade || '',
        estado: appointment.clientAddress?.estado || '',
    });
    const originalAddress = { ...appointment.clientAddress };
    const [contactChannel, setContactChannel] = useState('');
    // Formato correto para datetime-local considerando timezone local
    const getLocalDateTimeString = () => {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000; // offset em ms
        const localTime = new Date(now.getTime() - offset);
        return localTime.toISOString().slice(0, 16);
    };
    const [contactDate, setContactDate] = useState(getLocalDateTimeString());
    const [resolutionNotes, setResolutionNotes] = useState('');
    const [validationError, setValidationError] = useState('');

    useEffect(() => {
        const suggestedAction = getSuggestedAction(pendingReason);
        setResolutionAction(suggestedAction);
    }, [pendingReason]);

    useEffect(() => {
        const hasAddressChanged =
            clientAddress.cep !== originalAddress.cep ||
            clientAddress.logradouro !== originalAddress.logradouro ||
            clientAddress.numero !== originalAddress.numero ||
            clientAddress.complemento !== originalAddress.complemento ||
            clientAddress.bairro !== originalAddress.bairro ||
            clientAddress.cidade !== originalAddress.cidade ||
            clientAddress.estado !== originalAddress.estado;
        setAddressCorrected(hasAddressChanged);
    }, [clientAddress]);

    function getSuggestedAction(reason: string): ResolutionActionType {
        switch (reason) {
            case 'nao_realizado_cliente_ausente':
            case 'nao_realizado_cliente_pediu_remarcacao':
            case 'nao_realizado_endereco_incorreto':
                return 'rescheduled';
            case 'nao_realizado_problema_tecnico':
            case 'nao_realizado_falta_material':
                return 'resolved_by_provider';
            case 'nao_realizado_cliente_recusou':
                return 'cancelled';
            case 'payment_pending': // 💰 Sugerir confirmar pagamento
                return 'payment_confirmed';
            default:
                return 'rescheduled';
        }
    }

    function getReasonColor(reason: string): string {
        switch (reason) {
            case 'nao_realizado_cliente_ausente':
                return 'bg-yellow-500';
            case 'nao_realizado_cliente_pediu_remarcacao':
                return 'bg-blue-500';
            case 'nao_realizado_problema_tecnico':
                return 'bg-orange-500';
            case 'nao_realizado_endereco_incorreto':
                return 'bg-red-500';
            case 'nao_realizado_cliente_recusou':
                return 'bg-gray-500';
            case 'nao_realizado_falta_material':
                return 'bg-amber-500';
            case 'payment_pending': // 💰 Cor para pendĂȘncia de pagamento
                return 'bg-red-600';
            default:
                return 'bg-burnt-yellow';
        }
    }

    function getWarningMessage(): string | null {
        if (resolutionAction === 'rescheduled' && (appointment.rescheduleCount || 0) >= 3) {
            return `⚠️ Este agendamento já foi remarcado ${appointment.rescheduleCount} vezes. Considere cancelar ou investigar problema recorrente.`;
        }
        if (pendingReason === 'nao_realizado_cliente_recusou' && resolutionAction === 'rescheduled') {
            return '⚠️ O cliente recusou o serviço. Tem certeza que deseja reagendar?';
        }
        if (pendingReason === 'nao_realizado_endereco_incorreto' && resolutionAction === 'rescheduled' && !addressCorrected) {
            return '⚠️ O motivo foi "Endereço incorreto" mas nenhum campo foi alterado. Por favor, corrija o endereço.';
        }
        return null;
    }

    function validateForm(): string | null {
        const missingFields: string[] = [];

        // Validação específica por tipo de ação
        if (resolutionAction === 'rescheduled') {
            // Para reagendar: data é obrigatória
            if (!newDate) {
                missingFields.push('Nova Data');
            }
            // Se motivo foi endereço incorreto, endereço deve ter sido corrigido
            if (pendingReason === 'nao_realizado_endereco_incorreto' && !addressCorrected) {
                return '❌ É obrigatório corrigir o endereço antes de reagendar quando o motivo é "Endereço incorreto"';
            }
        } else if (resolutionAction === 'cancelled') {
            // Para cancelar: apenas motivo é obrigatório
            if (!cancellationReason || cancellationReason.trim() === '') {
                missingFields.push('Motivo do Cancelamento');
            }
        } else if (resolutionAction === 'resolved_by_provider') {
            // Para "resolvido pelo prestador": descrição é obrigatória
            if (!providerResolutionDetails || providerResolutionDetails.trim() === '') {
                missingFields.push('Descrição da Resolução');
            }
        } else if (resolutionAction === 'payment_confirmed') {
            // 💰 Para confirmar pagamento: notas de resolução são obrigatórias
            if (!resolutionNotes || resolutionNotes.trim() === '') {
                missingFields.push('Observações sobre o pagamento');
            }
        }
        // Para "awaiting" (aguardando retorno): nenhum campo obrigatório

        // Campos de contato são sempre OPCIONAIS para todas as ações
        // Não validar contactChannel e contactDate

        if (missingFields.length > 0) {
            return `❌ Campos obrigatórios não preenchidos: ${missingFields.join(', ')}`;
        }

        return null;
    }

    async function handleSubmit() {
        setValidationError('');
        const error = validateForm();
        if (error) {
            setValidationError(error);
            return;
        }

        setIsSubmitting(true);

        const resolutionData = {
            appointmentId: appointment.id,
            resolutionAction,
            originalPendingReason: pendingReason,
            ...(resolutionAction === 'rescheduled' && {
                newScheduledDate: newDate,
                newScheduledTime: newTime,
            }),
            ...(resolutionAction === 'cancelled' && {
                cancellationReason,
            }),
            ...(resolutionAction === 'resolved_by_provider' && {
                providerResolutionDetails,
            }),
            addressCorrected,
            ...(addressCorrected && { clientAddress }),
            // Campos de contato são opcionais - enviar se preenchidos
            contactedClient: !!(contactChannel || contactDate), // true se qualquer um foi preenchido
            contactChannel: contactChannel || null,
            contactDate: contactDate || null,
            resolutionNotes,
        };

        try {
            await onResolve(resolutionData);
            onClose();
        } catch (error: any) {
            setValidationError(error.message || 'Erro ao resolver pendência');
        } finally {
            setIsSubmitting(false);
        }
    }

    const warningMessage = getWarningMessage();

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-2xl">Resolver Pendência</DialogTitle>
                    <DialogDescription>
                        Tome as ações necessárias para tratar esta pendência reportada pelo prestador
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Resumo */}
                    <div className={`p-4 rounded-lg border-l-4 ${getReasonColor(pendingReason)} bg-burnt-yellow/10 dark:bg-burnt-yellow/20`}>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                                <span className="font-semibold">Cliente:</span> {appointment.clientName || 'N/A'}
                            </div>
                            <div>
                                <span className="font-semibold">Serviço:</span> {appointment.serviceName || 'N/A'}
                            </div>
                            <div>
                                <span className="font-semibold">Data do Serviço:</span>{' '}
                                {appointment.originalDate
                                    ? format(new Date(appointment.originalDate), "dd/MM/yyyy", { locale: ptBR })
                                    : 'N/A'}
                            </div>
                            <div>
                                <span className="font-semibold">Horário previsto:</span>{' '}
                                {appointment.originalDate
                                    ? format(new Date(appointment.originalDate), "HH:mm", { locale: ptBR })
                                    : 'N/A'}
                            </div>
                            <div>
                                <span className="font-semibold">Prestador:</span> {appointment.providerName || 'N/A'}
                            </div>
                            <div className="col-span-2">
                                <span className="font-semibold">⚠️ Motivo:</span> {pendingReasonLabels[pendingReason] || pendingReason}
                            </div>
                        </div>
                    </div>

                    {warningMessage && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{warningMessage}</AlertDescription>
                        </Alert>
                    )}

                    {validationError && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{validationError}</AlertDescription>
                        </Alert>
                    )}

                    {/* Seleção de Ação */}
                    <div className="space-y-3">
                        <Label className="text-base font-semibold">Ação a tomar</Label>
                        <RadioGroup value={resolutionAction} onValueChange={(v) => setResolutionAction(v as ResolutionActionType)}>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="rescheduled" id="rescheduled" />
                                <Label htmlFor="rescheduled" className="cursor-pointer font-normal">✅ Reagendar</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="cancelled" id="cancelled" />
                                <Label htmlFor="cancelled" className="cursor-pointer font-normal">❌ Cancelar</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="resolved_by_provider" id="resolved_by_provider" />
                                <Label htmlFor="resolved_by_provider" className="cursor-pointer font-normal">🎯 Resolvido pelo prestador</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="awaiting" id="awaiting" />
                                <Label htmlFor="awaiting" className="cursor-pointer font-normal">⏸️ Aguardando retorno</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="payment_confirmed" id="payment_confirmed" />
                                <Label htmlFor="payment_confirmed" className="cursor-pointer font-normal">💰 Confirmar pagamento</Label>
                            </div>
                        </RadioGroup>
                    </div>

                    {/* Campos Condicionais */}
                    {resolutionAction === 'rescheduled' && (
                        <div className="space-y-4 p-4 border rounded-lg bg-green-50 dark:bg-green-950">
                            <h3 className="font-semibold">📅 Reagendamento</h3>

                            {pendingReason === 'nao_realizado_endereco_incorreto' && (
                                <div className="space-y-3 mb-4 p-3 bg-red-50 border border-red-200 rounded">
                                    <div className="flex items-center justify-between">
                                        <Label className="font-semibold">📍 Correção de Endereço (Obrigatório)</Label>
                                        {addressCorrected && <Check className="h-5 w-5 text-green-600" />}
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <Label htmlFor="cep">CEP</Label>
                                            <Input id="cep" value={clientAddress.cep} onChange={(e) => setClientAddress({ ...clientAddress, cep: e.target.value })} />
                                        </div>
                                        <div>
                                            <Label htmlFor="logradouro">Logradouro</Label>
                                            <Input id="logradouro" value={clientAddress.logradouro} onChange={(e) => setClientAddress({ ...clientAddress, logradouro: e.target.value })} />
                                        </div>
                                        <div>
                                            <Label htmlFor="numero">Número</Label>
                                            <Input id="numero" value={clientAddress.numero} onChange={(e) => setClientAddress({ ...clientAddress, numero: e.target.value })} />
                                        </div>
                                        <div>
                                            <Label htmlFor="complemento">Complemento</Label>
                                            <Input id="complemento" value={clientAddress.complemento} onChange={(e) => setClientAddress({ ...clientAddress, complemento: e.target.value })} />
                                        </div>
                                        <div>
                                            <Label htmlFor="bairro">Bairro</Label>
                                            <Input id="bairro" value={clientAddress.bairro} onChange={(e) => setClientAddress({ ...clientAddress, bairro: e.target.value })} />
                                        </div>
                                        <div>
                                            <Label htmlFor="cidade">Cidade</Label>
                                            <Input id="cidade" value={clientAddress.cidade} onChange={(e) => setClientAddress({ ...clientAddress, cidade: e.target.value })} />
                                        </div>
                                        <div>
                                            <Label htmlFor="estado">Estado</Label>
                                            <Input id="estado" value={clientAddress.estado} onChange={(e) => setClientAddress({ ...clientAddress, estado: e.target.value })} maxLength={2} />
                                        </div>
                                    </div>
                                    {!addressCorrected && (
                                        <p className="text-sm text-red-600 font-semibold">Por favor, altere pelo menos um campo do endereço</p>
                                    )}
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label htmlFor="newDate" className="text-red-600">Nova Data *</Label>
                                    <Input
                                        id="newDate"
                                        type="date"
                                        value={newDate}
                                        onChange={(e) => setNewDate(e.target.value)}
                                        required
                                        className={!newDate && validationError ? 'border-red-500 ring-red-500' : ''}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="newTime">Horário</Label>
                                    <Input id="newTime" type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
                                </div>
                            </div>
                        </div>
                    )}

                    {resolutionAction === 'cancelled' && (
                        <div className="space-y-3 p-4 border rounded-lg bg-red-50">
                            <h3 className="font-semibold">❌ Cancelamento</h3>
                            <div>
                                <Label htmlFor="cancellationReason" className="text-red-600">Motivo do Cancelamento *</Label>
                                <Select value={cancellationReason} onValueChange={setCancellationReason}>
                                    <SelectTrigger className={!cancellationReason && validationError ? 'border-red-500 ring-red-500' : ''}>
                                        <SelectValue placeholder="Selecione o motivo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="cliente_desistiu">Cliente desistiu</SelectItem>
                                        <SelectItem value="cliente_nao_atende">Cliente não atende</SelectItem>
                                        <SelectItem value="endereco_nao_encontrado">Endereço não encontrado</SelectItem>
                                        <SelectItem value="outros">Outros</SelectItem>
                                    </SelectContent>
                                </Select>
                                {!cancellationReason && validationError && (
                                    <p className="text-sm text-red-600 mt-1">Este campo é obrigatório</p>
                                )}
                            </div>
                        </div>
                    )}

                    {resolutionAction === 'resolved_by_provider' && (
                        <div className="space-y-3 p-4 border rounded-lg bg-blue-50">
                            <h3 className="font-semibold">🎯 Resolvido pelo Prestador</h3>
                            <div>
                                <Label htmlFor="providerResolutionDetails" className="text-red-600">Descrição da Resolução *</Label>
                                <Textarea
                                    id="providerResolutionDetails"
                                    value={providerResolutionDetails}
                                    onChange={(e) => setProviderResolutionDetails(e.target.value)}
                                    rows={3}
                                    className={!providerResolutionDetails && validationError ? 'border-red-500 ring-red-500' : ''}
                                    placeholder="Descreva como o problema foi resolvido"
                                />
                                {!providerResolutionDetails && validationError && (
                                    <p className="text-sm text-red-600 mt-1">Este campo é obrigatório</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 💰 Confirmação de Pagamento */}
                    {resolutionAction === 'payment_confirmed' && (
                        <div className="space-y-3 p-4 border rounded-lg bg-green-50 dark:bg-green-950">
                            <h3 className="font-semibold">💰 Confirmação de Pagamento</h3>

                            {/* Mostrar valor do serviço */}
                            {appointment.servicePrice !== null && appointment.servicePrice !== undefined && (
                                <div className="p-3 bg-white dark:bg-zinc-900 border rounded-lg">
                                    <Label className="text-sm text-muted-foreground">Valor do Serviço</Label>
                                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                                        R$ {Number(appointment.servicePrice).toFixed(2).replace('.', ',')}
                                    </p>
                                </div>
                            )}

                            {/* Notas sobre pagamento (preenchidas pelo prestador) */}
                            {appointment.paymentNotes && (
                                <div className="p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 rounded">
                                    <Label className="text-sm font-semibold">Motivo informado pelo prestador:</Label>
                                    <p className="text-sm mt-1">{appointment.paymentNotes}</p>
                                </div>
                            )}

                            {/* Campo de observações (obrigatório) */}
                            <div>
                                <Label htmlFor="paymentResolutionNotes" className="text-red-600">
                                    Observações sobre o pagamento *
                                </Label>
                                <Textarea
                                    id="paymentResolutionNotes"
                                    value={resolutionNotes}
                                    onChange={(e) => setResolutionNotes(e.target.value)}
                                    rows={3}
                                    className={!resolutionNotes && validationError ? 'border-red-500 ring-red-500' : ''}
                                    placeholder="Ex: Pago via PIX em 28/12, Recebido em dinheiro, etc."
                                />
                                {!resolutionNotes && validationError && (
                                    <p className="text-sm text-red-600 mt-1">Este campo é obrigatório</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Contato com Cliente (Opcional) */}
                    <div className="space-y-3 p-4 border rounded-lg bg-gray-50 dark:bg-gray-900">
                        <h3 className="font-semibold flex items-center gap-2">
                            <Phone className="h-5 w-5" />
                            Contato com Cliente (Opcional)
                        </h3>
                        <p className="text-sm text-muted-foreground">Registre se houve contato com o cliente sobre esta pendência</p>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Canal</Label>
                                <Select value={contactChannel} onValueChange={setContactChannel}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione o canal (opcional)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="phone">Telefone</SelectItem>
                                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                        <SelectItem value="email">E-mail</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Data/Hora do Contato</Label>
                                <Input
                                    type="datetime-local"
                                    value={contactDate}
                                    onChange={(e) => setContactDate(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Observações */}
                    <div className="space-y-2">
                        <Label htmlFor="resolutionNotes">Observações</Label>
                        <Textarea id="resolutionNotes" value={resolutionNotes} onChange={(e) => setResolutionNotes(e.target.value)} rows={4} />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? 'Processando...' : 'Resolver Pendência'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
