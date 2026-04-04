import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { extendedInsertAppointmentSchema, type InsertAppointment, type Appointment, type Client, type Service, type Technician, type Team } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClientSearch } from "@/components/ui/client-search";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, MapPin, UserPlus, Edit3, AlertCircle } from "lucide-react";
import NewClientDialog from "./NewClientDialog";
import ClientForm from "./ClientForm";
import { buscarEnderecoPorCep } from "@/lib/cep";
import { buildApiUrl } from "@/lib/api-config";

// 💵 Utilitários para máscara de moeda (BRL)
const formatCurrencyBRL = (value: string | number | null | undefined) => {
  if (value === undefined || value === null || value === "") return "";

  // Se for número, converter para representação de centavos
  // Se for string, pegar apenas os dígitos
  const numericValue = typeof value === "number"
    ? (Math.round(value * 100)).toString()
    : value.toString().replace(/\D/g, "");

  if (!numericValue) return "";

  const formatted = (Number(numericValue) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `R$ ${formatted}`;
};

const parseBRLToNumberString = (value: string) => {
  if (!value) return null;
  // "1.234,56" -> "1234.56"
  const cleaned = value.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
  return cleaned;
};

interface AppointmentFormProps {
  appointment?: Appointment | null;
  clients: Client[];
  services: Service[];
  technicians: Technician[];
  teams: Team[];
  onClose: () => void;
  prefilledData?: {
    date?: string;
    cep?: string;
    numero?: string;
    serviceId?: string;
    technicianId?: string;
    teamId?: string;
    clientId?: string;
  } | null;
}

export default function AppointmentForm({
  appointment,
  clients,
  services,
  technicians,
  teams,
  onClose,
  prefilledData
}: AppointmentFormProps) {
  console.log("📝 [DEBUG] AppointmentForm - prefilledData:", prefilledData);
  console.log("📝 [DEBUG] AppointmentForm - appointment:", appointment);

  const [selectedClient, setSelectedClient] = useState<number | null>(
    appointment?.clientId || (prefilledData?.clientId ? parseInt(prefilledData.clientId) : null)
  );
  const [isEditClientOpen, setIsEditClientOpen] = useState(false);
  const [isAllDay, setIsAllDay] = useState(appointment?.allDay || false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Estados para múltiplos endereços
  const [clientAddresses, setClientAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);

  // Verificar se o formulário foi aberto a partir do fluxo "Encontre uma Data"
  const isFromFindDate = !!prefilledData && !appointment;
  console.log("📝 [DEBUG] AppointmentForm - isFromFindDate:", isFromFindDate);

  // Verificar se o agendamento está em romaneio confirmado/finalizado
  const routeInfo = (appointment as any)?.routeInfo;
  const isInConfirmedRoute = routeInfo && (routeInfo.status === 'confirmado' || routeInfo.status === 'finalizado');

  // Verificar se o status do agendamento permite edição
  // Apenas agendamentos com status 'scheduled' ou 'rescheduled' podem ser editados
  const editableStatuses = ['scheduled', 'rescheduled'];
  const isStatusEditable = !appointment || editableStatuses.includes(appointment.status);
  const isStatusBlocked = appointment && !isStatusEditable;

  const isReadOnly = isInConfirmedRoute || isStatusBlocked || false;


  const form = useForm<InsertAppointment>({
    resolver: zodResolver(extendedInsertAppointmentSchema),
    defaultValues: appointment ? {
      clientId: appointment.clientId,
      serviceId: appointment.serviceId,
      technicianId: appointment.technicianId,
      teamId: appointment.teamId,
      scheduledDate: new Date(appointment.scheduledDate),
      allDay: appointment.allDay || false,
      status: appointment.status,
      priority: appointment.priority,
      notes: appointment.notes || "",
      cep: appointment.cep,
      logradouro: appointment.logradouro,
      numero: appointment.numero,
      complemento: appointment.complemento || "",
      bairro: appointment.bairro || "Não informado",
      cidade: appointment.cidade || "Não informado",
      paymentType: (appointment.paymentType || "antecipado") as "no_ato" | "antecipado",
      additionalValue: appointment.additionalValue || "",
    } : prefilledData ? {
      clientId: prefilledData.clientId ? parseInt(prefilledData.clientId) : 0,
      serviceId: prefilledData.serviceId ? parseInt(prefilledData.serviceId) : 0,
      technicianId: prefilledData.technicianId ? parseInt(prefilledData.technicianId) : 0,
      teamId: prefilledData.teamId ? parseInt(prefilledData.teamId) : undefined,
      scheduledDate: prefilledData.date ? new Date(prefilledData.date) : new Date(),
      allDay: false,
      status: "scheduled",
      priority: "normal",
      notes: "",
      cep: prefilledData.cep || "",
      logradouro: prefilledData.clientId ?
        (clients.find(c => c.id === parseInt(prefilledData.clientId!))?.logradouro || "") : "",
      numero: prefilledData.numero || "",
      complemento: prefilledData.clientId ?
        (clients.find(c => c.id === parseInt(prefilledData.clientId!))?.complemento || "") : "",
      bairro: prefilledData.clientId ?
        (clients.find(c => c.id === parseInt(prefilledData.clientId!))?.bairro || "Não informado") : "Não informado",
      cidade: prefilledData.clientId ?
        (clients.find(c => c.id === parseInt(prefilledData.clientId!))?.cidade || "Não informado") : "Não informado",
      paymentType: "antecipado",
      additionalValue: "",
    } : {
      clientId: 0,
      serviceId: 0,
      technicianId: 0,
      teamId: undefined,
      scheduledDate: new Date(),
      allDay: false,
      status: "scheduled",
      priority: "normal",
      notes: "",
      cep: "",
      logradouro: "",
      numero: "",
      complemento: "",
      bairro: "Não informado",
      cidade: "Não informado",
      paymentType: "antecipado",
      additionalValue: "",
    },
  });

  const selectedServiceId = form.watch("serviceId");
  const selectedService = services.find((s) => s.id === selectedServiceId);

  // Buscar endereços do cliente ao abrir agendamento existente
  useEffect(() => {
    const loadClientAddresses = async () => {
      if (appointment && selectedClient) {
        try {
          const response = await fetch(buildApiUrl(`/api/clients/${selectedClient}`), {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
          });
          
          if (response.ok) {
            const clientData = await response.json();
            const addresses = clientData.addresses || [];
            setClientAddresses(addresses);
            
            // Detectar qual endereço está sendo usado no agendamento
            const appointmentAddress = addresses.find((addr: any) => 
              addr.cep === appointment.cep &&
              addr.logradouro === appointment.logradouro &&
              addr.numero === appointment.numero
            );
            
            if (appointmentAddress) {
              setSelectedAddressId(appointmentAddress.id);
              console.log("✅ Endereço do agendamento detectado:", appointmentAddress.label || appointmentAddress.logradouro);
            } else {
              // Fallback: usar endereço principal
              const primaryAddress = addresses.find((addr: any) => addr.isPrimary);
              if (primaryAddress) {
                setSelectedAddressId(primaryAddress.id);
                console.log("⚠️ Endereço não encontrado, usando principal:", primaryAddress.label || primaryAddress.logradouro);
              }
            }
          }
        } catch (error) {
          console.error("❌ Erro ao buscar endereços do agendamento:", error);
        }
      }
    };
    
    loadClientAddresses();
  }, [appointment, selectedClient]);

  const createMutation = useMutation({
    mutationFn: async (data: InsertAppointment) => {
      const response = await fetch(buildApiUrl("/api/appointments"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(localStorage.getItem("token") && {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          }),
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao criar agendamento");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      onClose();
      toast({
        title: "Sucesso",
        description: "Agendamento criado com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar agendamento.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InsertAppointment) => {
      const response = await fetch(buildApiUrl(`/api/appointments/${appointment?.id}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(localStorage.getItem("token") && {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          }),
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao atualizar agendamento");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      onClose();
      toast({
        title: "Sucesso",
        description: "Agendamento atualizado com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar agendamento.",
        variant: "destructive",
      });
    },
  });

  // Validar se a data selecionada está nos dias de trabalho do técnico/equipe
  const workScheduleWarning = useMemo(() => {
    const scheduledDate = form.watch('scheduledDate');
    const technicianId = form.watch('technicianId');
    const teamId = form.watch('teamId');

    if (!scheduledDate) return null;

    // 🐛 FIX: Validar se scheduledDate é uma Date válida
    const date = scheduledDate instanceof Date ? scheduledDate : new Date(scheduledDate);

    // Se a data for inválida, retornar null ao invés de quebrar
    if (isNaN(date.getTime())) {
      return null;
    }

    const dayOfWeek = date.getDay(); // 0 = domingo, 1 = segunda, ..., 6 = sábado
    const dayNames = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const dayName = dayNames[dayOfWeek];

    // 🐛 FIX: Validar se dayName existe antes de chamar charAt
    if (!dayName) return null;

    const dayNameDisplay = dayName.charAt(0).toUpperCase() + dayName.slice(1);

    // Verificar técnico
    if (technicianId) {
      const technician = technicians.find(t => t.id === technicianId);
      if (technician) {
        const workDays = technician.diasTrabalho || ['segunda', 'terca', 'quarta', 'quinta', 'sexta'];
        if (!workDays.includes(dayName)) {
          return {
            type: 'technician',
            name: technician.name,
            dayName: dayNameDisplay,
            workDays: workDays.join(', ')
          };
        }
      }
    }

    // Verificar equipe
    if (teamId) {
      const team = teams.find(t => t.id === teamId);
      if (team) {
        const workDays = team.diasTrabalho || ['segunda', 'terca', 'quarta', 'quinta', 'sexta'];
        if (!workDays.includes(dayName)) {
          return {
            type: 'team',
            name: team.name,
            dayName: dayNameDisplay,
            workDays: workDays.join(', ')
          };
        }
      }
    }

    return null;
  }, [form.watch('scheduledDate'), form.watch('technicianId'), form.watch('teamId'), technicians, teams]);

  const onSubmit = (data: InsertAppointment) => {
    console.log("📝 [DEBUG] onSubmit - Dados recebidos do form:", data);
    console.log("📝 [DEBUG] onSubmit - Tipo de scheduledDate:", typeof data.scheduledDate, data.scheduledDate);

    // Convert scheduledDate to Date object for the mutations
    let processedDate;
    try {
      if (data.scheduledDate instanceof Date) {
        processedDate = data.scheduledDate;
        console.log("📝 [DEBUG] onSubmit - scheduledDate já é Date:", processedDate);
      } else {
        processedDate = new Date(data.scheduledDate);
        console.log("📝 [DEBUG] onSubmit - scheduledDate convertido para Date:", processedDate);
      }

      // Verificar se a data é válida
      if (isNaN(processedDate.getTime())) {
        throw new Error(`Data inválida: ${data.scheduledDate}`);
      }
    } catch (error) {
      console.error("❌ [DEBUG] onSubmit - Erro ao processar data:", error);
      toast({
        title: "Erro",
        description: "Data inválida. Verifique o formato da data.",
        variant: "destructive",
      });
      return;
    }

    // --- Validação de data retroativa (apenas para NOVOS agendamentos) ---
    if (!appointment) {
      const now = new Date();
      // Converte a data atual para o fuso brasileiro para pegar o "dia de hoje" no Brasil independentemente de onde o servidor esteja
      const brTimeStr = now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
      const brTime = new Date(brTimeStr);
      const todayDay = new Date(brTime.getFullYear(), brTime.getMonth(), brTime.getDate());
      
      const scheduledBRTimeStr = processedDate.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
      const scheduledBRTime = new Date(scheduledBRTimeStr);
      const scheduledDay = new Date(scheduledBRTime.getFullYear(), scheduledBRTime.getMonth(), scheduledBRTime.getDate());

      if (scheduledDay.getTime() < todayDay.getTime()) {
        toast({
          title: "Erro de Validação",
          description: "Não é permitido criar um agendamento com data retroativa. Selecione a data de hoje ou uma data futura.",
          variant: "destructive",
        });
        return;
      }
    }
    // ----------------------------------------------------------------------

    const formData = {
      ...data,
      scheduledDate: processedDate,
      additionalValue: data.additionalValue ? parseBRLToNumberString(formatCurrencyBRL(data.additionalValue)) : null
    };

    // Ensure proper handling of technician vs team assignment
    if (formData.teamId) {
      // If teamId is set, clear technicianId to avoid foreign key conflicts
      formData.technicianId = null;
      console.log("📝 [DEBUG] onSubmit - Usando equipe, technicianId limpo");
    } else if (formData.technicianId) {
      // If technicianId is set, clear teamId
      formData.teamId = undefined;
      console.log("📝 [DEBUG] onSubmit - Usando técnico, teamId limpo");
    }

    console.log("📝 [DEBUG] onSubmit - Dados finais para envio:", formData);

    if (appointment) {
      console.log("📝 [DEBUG] onSubmit - Atualizando agendamento ID:", appointment.id);
      updateMutation.mutate(formData);
    } else {
      console.log("📝 [DEBUG] onSubmit - Criando novo agendamento");
      createMutation.mutate(formData);
    }
  };

  const handleClientCreated = async (client: Client) => {
    setSelectedClient(client.id);
    form.setValue("clientId", client.id);
    
    // Buscar endereços do cliente recém-criado
    try {
      const response = await fetch(buildApiUrl(`/api/clients/${client.id}`), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (response.ok) {
        const clientData = await response.json();
        const addresses = clientData.addresses || [];
        setClientAddresses(addresses);
        
        const primaryAddress = addresses.find((addr: any) => addr.isPrimary);
        const addressToUse = primaryAddress || addresses[0];
        
        if (addressToUse) {
          setSelectedAddressId(addressToUse.id || null);
          fillAddressFields(addressToUse);
        }
      }
    } catch (error) {
      console.error("❌ Erro ao buscar endereços do cliente criado:", error);
    }
  };

  const handleClientChange = async (clientId: string) => {
    const client = clients.find(c => c.id === parseInt(clientId));
    if (client) {
      console.log("📋 [AUTO-FILL] Cliente selecionado:", client.id, client.name);
      setSelectedClient(client.id);
      
      // Buscar endereços do cliente
      try {
        const response = await fetch(buildApiUrl(`/api/clients/${client.id}`), {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });
        
        if (response.ok) {
          const clientData = await response.json();
          const addresses = clientData.addresses || [];
          
          console.log("📋 [ADDRESSES] Endereços do cliente:", addresses.length);
          setClientAddresses(addresses);
          
          // Selecionar endereço principal por padrão
          const primaryAddress = addresses.find((addr: any) => addr.isPrimary);
          const addressToUse = primaryAddress || addresses[0];
          
          if (addressToUse) {
            setSelectedAddressId(addressToUse.id || null);
            fillAddressFields(addressToUse);
          }
        }
      } catch (error) {
        console.error("❌ [ADDRESSES] Erro ao buscar endereços:", error);
        // Fallback para campos legados
        const cepValue = client.cep || "";
        const logradouroValue = client.logradouro || "";
        const numeroValue = client.numero || "";
        const complementoValue = client.complemento || "";
        const bairroValue = client.bairro || "Não informado";
        const cidadeValue = client.cidade || "Não informado";
        
        form.setValue("cep", cepValue);
        form.setValue("logradouro", logradouroValue);
        form.setValue("numero", numeroValue);
        form.setValue("complemento", complementoValue);
        form.setValue("bairro", bairroValue);
        form.setValue("cidade", cidadeValue);
      }
    } else {
      console.warn("⚠️ [AUTO-FILL] Cliente não encontrado para ID:", clientId);
    }
  };

  const fillAddressFields = (address: any) => {
    console.log("📋 [AUTO-FILL] Preenchendo campos com endereço:", address);
    
    form.setValue("cep", address.cep || "");
    form.setValue("logradouro", address.logradouro || "");
    form.setValue("numero", address.numero || "");
    form.setValue("complemento", address.complemento || "");
    form.setValue("bairro", address.bairro || "Não informado");
    form.setValue("cidade", address.cidade || "Não informado");
  };

  const handleAddressChange = (addressId: string) => {
    const address = clientAddresses.find(addr => addr.id === parseInt(addressId));
    if (address) {
      setSelectedAddressId(address.id);
      fillAddressFields(address);
    }
  };

  const handleClientUpdated = async () => {
    // Close the edit client dialog first
    setIsEditClientOpen(false);

    // Invalidate clients query to get updated data
    await queryClient.invalidateQueries({ queryKey: ['/api/clients'] });

    // Force refetch of clients data to get the latest information
    await queryClient.refetchQueries({ queryKey: ['/api/clients'] });

    // Update address fields with the updated client data
    if (selectedClient) {
      // Wait a bit longer to ensure the query has completed
      setTimeout(() => {
        const updatedClient = clients.find(c => c.id === selectedClient);
        if (updatedClient) {
          console.log("🔄 [DEBUG] Atualizando campos de endereço com dados do cliente:", updatedClient);
          form.setValue("cep", updatedClient.cep);
          form.setValue("logradouro", updatedClient.logradouro);
          form.setValue("numero", updatedClient.numero);
          form.setValue("complemento", updatedClient.complemento || "");
          form.setValue("bairro", updatedClient.bairro || "Não informado");
          form.setValue("cidade", updatedClient.cidade || "Não informado");
        }
      }, 300);
    }
  };

  const handleAddressFieldClick = () => {
    toast({
      title: "Endereço somente leitura",
      description: "Para alterar o endereço do cliente, edite o cadastro do cliente.",
      variant: "default",
    });
  };

  const getCurrentClient = () => {
    return clients.find(c => c.id === selectedClient);
  };

  // Obter data mínima (hoje no fuso do Brasil) para bloquear dias anteriores no calendário (apenas novos agendamentos)
  const todayMinString = useMemo(() => {
    if (appointment) return undefined;
    
    const now = new Date();
    const brTimeStr = now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
    const brTime = new Date(brTimeStr);
    
    const year = brTime.getFullYear();
    const month = String(brTime.getMonth() + 1).padStart(2, '0');
    const day = String(brTime.getDate()).padStart(2, '0');
    
    return {
      dateOnly: `${year}-${month}-${day}`,
      dateTime: `${year}-${month}-${day}T00:00`
    };
  }, [appointment]);

  return (
    <div className="space-y-6">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          {appointment ? "Editar Agendamento" : "Novo Agendamento"}
        </DialogTitle>
      </DialogHeader>

      {/* Alerta de Romaneio Confirmado/Finalizado */}
      {isInConfirmedRoute && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h4 className="font-semibold text-orange-900 mb-1">
              🚚 Romaneio {routeInfo.status === 'confirmado' ? 'Confirmado' : 'Finalizado'} #{routeInfo.displayNumber}
            </h4>
            <p className="text-sm text-orange-800">
              Este agendamento está em um romaneio {routeInfo.status === 'confirmado' ? 'confirmado' : 'finalizado'} e não pode ser editado.
              Para alterar este agendamento, você precisa ir na tela de <strong>Romaneios - Histórico de Rotas</strong> e alterar o status do romaneio.
            </p>
          </div>
        </div>
      )}

      {/* Alerta de Status não editável */}
      {isStatusBlocked && !isInConfirmedRoute && (
        <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-gray-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900 mb-1">
              🔒 Agendamento não editável
            </h4>
            <p className="text-sm text-gray-700">
              Este agendamento está com status <strong>"{appointment?.status === 'completed' ? 'Concluído' : appointment?.status === 'cancelled' ? 'Cancelado' : appointment?.status === 'in_progress' ? 'Em Andamento' : appointment?.status}"</strong> e não pode ser editado.
              Apenas agendamentos com status "Agendado" ou "Remarcado" podem ser alterados.
            </p>
          </div>
        </div>
      )}


      <div className="flex gap-2 mb-4">
        <NewClientDialog onClientCreated={handleClientCreated}>
          <Button variant="outline" size="sm" className="text-green-600 border-green-600 hover:bg-green-50" disabled={isReadOnly}>
            <UserPlus className="h-4 w-4 mr-2" />
            Novo Cliente
          </Button>
        </NewClientDialog>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Client Selection */}
          <FormField
            control={form.control}
            name="clientId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cliente *</FormLabel>
                <FormControl>
                  <ClientSearch
                    value={field.value}
                    onValueChange={(value) => {
                      if (!isFromFindDate && !isReadOnly) {
                        field.onChange(value ?? undefined);
                        if (value) {
                          handleClientChange(value.toString());
                        }
                      }
                    }}
                    placeholder="Pesquisar por nome ou CPF"
                    disabled={isFromFindDate || isReadOnly}
                  />
                </FormControl>
                {isFromFindDate && (
                  <p className="text-sm text-blue-600">Cliente selecionado a partir da busca "Encontre uma data" - não pode ser alterado</p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Service and Technician */}
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="serviceId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Serviço *</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      if (!isFromFindDate && !isReadOnly) {
                        field.onChange(parseInt(value));
                      }
                    }}
                    value={field.value?.toString()}
                    disabled={isFromFindDate || isReadOnly}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um serviço" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {services.map((service) => (
                        <SelectItem key={service.id} value={service.id.toString()}>
                          {service.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isFromFindDate && (
                    <p className="text-sm text-blue-600">Serviço selecionado a partir da busca "Encontre uma data" - não pode ser alterado</p>
                  )}
                  {selectedService && (
                    <p className="text-base font-semibold text-gray-700 flex items-center gap-1 mt-1">
                      <Clock className="h-3 w-3" />
                      <span>Duração: {selectedService.duration} min</span>
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="technicianId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Técnico/Equipe *</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      if (!isFromFindDate && !isReadOnly) {
                        console.log("Seleção alterada para:", value);

                        if (value.startsWith('tech-')) {
                          // É um técnico
                          const technicianId = parseInt(value.split('-')[1]);
                          console.log("Técnico selecionado ID:", technicianId);
                          field.onChange(technicianId);
                          // Limpar teamId no formulário
                          form.setValue("teamId", undefined);
                        } else if (value.startsWith('team-')) {
                          // É uma equipe
                          const teamId = parseInt(value.split('-')[1]);
                          console.log("Equipe selecionada ID:", teamId);
                          field.onChange(undefined); // Limpar technicianId
                          // Definir teamId no formulário
                          form.setValue("teamId", teamId);
                        }
                      }
                    }}
                    value={
                      field.value ? `tech-${field.value}` :
                        form.getValues("teamId") ? `team-${form.getValues("teamId")}` : ""
                    }
                    disabled={isFromFindDate || isReadOnly}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um técnico ou equipe" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {technicians.map((technician) => (
                        <SelectItem key={`technician-${technician.id}`} value={`tech-${technician.id}`}>
                          👤 {technician.name}
                        </SelectItem>
                      ))}
                      {teams && teams.map((team) => (
                        <SelectItem key={`team-${team.id}`} value={`team-${team.id}`}>
                          👥 {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isFromFindDate && (
                    <p className="text-sm text-blue-600">Técnico/Equipe selecionado a partir da busca "Encontre uma data" - não pode ser alterado</p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Date and Time */}
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="scheduledDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{isAllDay ? "Data *" : "Data e Hora *"}</FormLabel>
                  <FormControl>
                    <Input
                      type={isAllDay ? "date" : "datetime-local"}
                      {...field}
                      value={(() => {
                        // 🐛 FIX: Validar se field.value é uma Date válida antes de formatar
                        if (!field.value) return "";

                        const date = field.value instanceof Date ? field.value : new Date(field.value);

                        // Se a data for inválida, retornar string vazia para não quebrar o input
                        if (isNaN(date.getTime())) return "";

                        try {
                          if (isAllDay) {
                            // Para "dia todo", usar a data local sem ajuste de timezone
                            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                          } else {
                            // Para horário específico, aplicar ajuste de timezone
                            const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
                            return adjusted.toISOString().slice(0, 16);
                          }
                        } catch (e) {
                          // Em caso de qualquer erro, retornar string vazia
                          return "";
                        }
                      })()}
                      onChange={(e) => {
                        if (isAllDay) {
                          // Para "dia todo", criar data às 12:00 do dia local para evitar problemas de timezone
                          const [year, month, day] = e.target.value.split('-').map(Number);
                          field.onChange(new Date(year, month - 1, day, 12, 0, 0));
                        } else {
                          field.onChange(new Date(e.target.value));
                        }
                      }}
                      disabled={!!prefilledData?.date || isReadOnly}
                      min={!appointment ? (isAllDay ? todayMinString?.dateOnly : todayMinString?.dateTime) : undefined}
                    />
                  </FormControl>
                  {prefilledData?.date && (
                    <p className="text-sm text-blue-600">Data selecionada a partir da busca "Encontre uma data" - não pode ser alterada</p>
                  )}
                  {workScheduleWarning && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
                      <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-amber-800">
                        <p className="font-semibold">Atenção: Dia não disponível</p>
                        <p>
                          {workScheduleWarning.type === 'technician' ? 'O técnico' : 'A equipe'} <strong>{workScheduleWarning.name}</strong> não trabalha em <strong>{workScheduleWarning.dayName}</strong>.
                        </p>
                        <p className="text-xs mt-1">Dias de trabalho: {workScheduleWarning.workDays}</p>
                      </div>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* All Day Checkbox */}
            <FormField
              control={form.control}
              name="allDay"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        field.onChange(checked);
                        setIsAllDay(checked);
                      }}
                      className="mt-1"
                      disabled={isReadOnly}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="text-sm font-normal">
                      Dia todo
                    </FormLabel>
                    <p className="text-xs text-gray-500">
                      Marque para agendamentos que duram o dia inteiro
                    </p>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Address Fields */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-gray-500" />
                <h3 className="text-lg font-medium">Endereço do Atendimento</h3>
              </div>
              {appointment && selectedClient && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditClientOpen(true)}
                  className="text-blue-600 border-blue-600 hover:bg-blue-50"
                >
                  <Edit3 className="h-4 w-4 mr-2" />
                  Editar cadastro do cliente
                </Button>
              )}
            </div>

            {appointment && !selectedClient && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <p className="text-sm text-amber-800">
                  Selecione um cliente para ver o endereço do atendimento
                </p>
              </div>
            )}

            {/* Seletor de Endereço (apenas se cliente tiver 2+ endereços) */}
            {selectedClient && clientAddresses.length > 1 && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Endereço para este atendimento *
                </label>
                <Select
                  value={selectedAddressId?.toString() || ""}
                  onValueChange={handleAddressChange}
                  disabled={isReadOnly}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o endereço" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientAddresses.map((addr: any) => (
                      <SelectItem key={addr.id} value={addr.id.toString()}>
                        {addr.isPrimary && "✓ "}
                        {addr.label || "Endereço"} - {addr.logradouro}, {addr.numero}
                        {addr.isPrimary && " (Principal)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  {clientAddresses.length} endereços cadastrados. Selecione o endereço onde será realizado este atendimento.
                </p>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="cep"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CEP *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="00000-000"
                        maxLength={9}
                        {...field}
                        onChange={(e) => {
                          if (!appointment && !prefilledData?.cep) {
                            let value = e.target.value.replace(/\D/g, '');
                            if (value.length > 5) {
                              value = value.slice(0, 5) + '-' + value.slice(5, 8);
                            }
                            field.onChange(value);

                            // Auto-search when CEP is complete
                            if (value.replace(/\D/g, '').length === 8) {
                              buscarEnderecoPorCep(value)
                                .then((endereco) => {
                                  form.setValue("logradouro", endereco.logradouro || "");
                                  form.setValue("bairro", endereco.bairro || "");
                                  form.setValue("cidade", endereco.localidade || "");
                                  form.setFocus("numero");
                                })
                                .catch(() => {
                                  toast({
                                    title: "CEP não encontrado",
                                    description: "Não foi possível encontrar o endereço automaticamente.",
                                    variant: "destructive",
                                  });
                                });
                            }
                          }
                        }}
                        onClick={appointment ? handleAddressFieldClick : undefined}
                        disabled={!!prefilledData?.cep || !!appointment}
                        readOnly={!!appointment}
                        className={appointment ? "bg-gray-50 cursor-not-allowed" : ""}
                      />
                    </FormControl>
                    {prefilledData?.cep && (
                      <p className="text-sm text-blue-600">CEP selecionado a partir da busca "Encontre uma data" - não pode ser alterado</p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="numero"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="123"
                        {...field}
                        onChange={(e) => {
                          if (!appointment && !prefilledData?.numero) {
                            const value = e.target.value.replace(/\D/g, '');
                            field.onChange(value);
                          }
                        }}
                        onClick={appointment ? handleAddressFieldClick : undefined}
                        disabled={!!prefilledData?.numero || !!appointment}
                        readOnly={!!appointment}
                        className={appointment ? "bg-gray-50 cursor-not-allowed" : ""}
                      />
                    </FormControl>
                    {prefilledData?.numero && (
                      <p className="text-sm text-blue-600">Número selecionado a partir da busca "Encontre uma data" - não pode ser alterado</p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="logradouro"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Logradouro *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Rua das Flores"
                        {...field}
                        onClick={appointment ? handleAddressFieldClick : undefined}
                        disabled={isFromFindDate || !!appointment || isReadOnly}
                        readOnly={!!appointment || isReadOnly}
                        className={(appointment || isReadOnly) ? "bg-gray-50 cursor-not-allowed" : ""}
                      />
                    </FormControl>
                    {isFromFindDate && (
                      <p className="text-sm text-blue-600">Logradouro do cliente selecionado - não pode ser alterado</p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="complemento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Complemento</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Apto 123"
                        {...field}
                        value={field.value || ""}
                        onClick={appointment ? handleAddressFieldClick : undefined}
                        disabled={isFromFindDate || !!appointment || isReadOnly}
                        readOnly={!!appointment || isReadOnly}
                        className={(appointment || isReadOnly) ? "bg-gray-50 cursor-not-allowed" : ""}
                      />
                    </FormControl>
                    {isFromFindDate && (
                      <p className="text-sm text-blue-600">Complemento do cliente selecionado - não pode ser alterado</p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bairro"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bairro *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Centro"
                        {...field}
                        value={field.value || ""}
                        onClick={appointment ? handleAddressFieldClick : undefined}
                        disabled={isFromFindDate || !!appointment || isReadOnly}
                        readOnly={!!appointment || isReadOnly}
                        className={(appointment || isReadOnly) ? "bg-gray-50 cursor-not-allowed" : ""}
                      />
                    </FormControl>
                    {isFromFindDate && (
                      <p className="text-sm text-blue-600">Bairro do cliente selecionado - não pode ser alterado</p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cidade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cidade *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="São Paulo"
                        {...field}
                        value={field.value || ""}
                        onClick={appointment ? handleAddressFieldClick : undefined}
                        disabled={isFromFindDate || !!appointment || isReadOnly}
                        readOnly={!!appointment || isReadOnly}
                        className={(appointment || isReadOnly) ? "bg-gray-50 cursor-not-allowed" : ""}
                      />
                    </FormControl>
                    {isFromFindDate && (
                      <p className="text-sm text-blue-600">Cidade do cliente selecionado - não pode ser alterada</p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Status, Priority, and Notes */}
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isReadOnly}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="scheduled">Agendado</SelectItem>
                      <SelectItem value="in_progress">Em Andamento</SelectItem>
                      <SelectItem value="completed">Concluído</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prioridade</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isReadOnly}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="urgent">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Seção de Pagamento */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-lg font-medium">💵 Pagamento</span>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="paymentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Pagamento *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "antecipado"} disabled={isReadOnly}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="antecipado">✅ Antecipado (já pago antecipado)</SelectItem>
                        <SelectItem value="no_ato">🤝 No Ato (cobrar na hora)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Valor do Serviço - somente leitura */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Valor do Serviço</label>
                <div className="flex h-10 w-full rounded-md border border-input bg-gray-50 px-3 py-2 text-sm">
                  {selectedService?.price ? `R$ ${Number(selectedService.price).toFixed(2)}` : "Selecione um serviço"}
                </div>
              </div>

              <FormField
                control={form.control}
                name="additionalValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Adicional</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="0,00"
                        {...field}
                        value={formatCurrencyBRL(field.value)}
                        className={isReadOnly || form.watch("paymentType") === "antecipado" ? "bg-gray-50 cursor-not-allowed" : "bg-white"}
                        onChange={(e) => {
                          // Pegar apenas os números
                          const rawValue = e.target.value.replace(/\D/g, '');
                          field.onChange(rawValue);
                        }}
                        disabled={isReadOnly || form.watch("paymentType") === "antecipado"}
                      />
                    </FormControl>
                    <p className="text-xs text-gray-500">
                      {form.watch("paymentType") === "antecipado"
                        ? "Valor adicional não aplicável em pagamento antecipado"
                        : "Valor extra além do serviço"
                      }
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Observações</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Observações sobre o agendamento..."
                    className="min-h-[80px]"
                    {...field}
                    value={field.value || ""}
                    disabled={isReadOnly}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending || isReadOnly}
              className="bg-burnt-yellow hover:bg-burnt-yellow-dark text-white"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              )}
              {appointment ? "Atualizar" : "Criar"} Agendamento
            </Button>
          </div>
        </form>
      </Form>

      {/* Modal de Edição do Cliente */}
      <Dialog open={isEditClientOpen} onOpenChange={setIsEditClientOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          {selectedClient && (
            <ClientForm
              client={getCurrentClient()}
              onClose={handleClientUpdated}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}