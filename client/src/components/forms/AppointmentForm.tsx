import { useState, useEffect } from "react";
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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Verificar se o formulário foi aberto a partir do fluxo "Ache uma Data"
  const isFromFindDate = !!prefilledData && !appointment;
  console.log("📝 [DEBUG] AppointmentForm - isFromFindDate:", isFromFindDate);

  // Effect to update address fields whenever the selected client changes or clients data is updated
  useEffect(() => {
    if (selectedClient && appointment) {
      const currentClient = clients.find(c => c.id === selectedClient);
      if (currentClient) {
        console.log("🔄 [DEBUG] Atualizando campos de endereço automaticamente:", currentClient);
        form.setValue("cep", currentClient.cep);
        form.setValue("logradouro", currentClient.logradouro);
        form.setValue("numero", currentClient.numero);
        form.setValue("complemento", currentClient.complemento || "");
        form.setValue("bairro", currentClient.bairro || "Não informado");
        form.setValue("cidade", currentClient.cidade || "Não informado");
      }
    }
  }, [selectedClient, clients, form, appointment]);
  
  const form = useForm<InsertAppointment>({
    resolver: zodResolver(extendedInsertAppointmentSchema),
    defaultValues: appointment ? {
      clientId: appointment.clientId,
      serviceId: appointment.serviceId,
      technicianId: appointment.technicianId,
      teamId: appointment.teamId,
      scheduledDate: new Date(appointment.scheduledDate),
      status: appointment.status,
      priority: appointment.priority,
      notes: appointment.notes || "",
      cep: appointment.cep,
      logradouro: appointment.logradouro,
      numero: appointment.numero,
      complemento: appointment.complemento || "",
      bairro: appointment.bairro || "Não informado",
      cidade: appointment.cidade || "Não informado",
    } : prefilledData ? {
      clientId: prefilledData.clientId ? parseInt(prefilledData.clientId) : 0,
      serviceId: prefilledData.serviceId ? parseInt(prefilledData.serviceId) : 0,
      technicianId: prefilledData.technicianId ? parseInt(prefilledData.technicianId) : 0,
      teamId: prefilledData.teamId ? parseInt(prefilledData.teamId) : undefined,
      scheduledDate: prefilledData.date ? new Date(prefilledData.date) : new Date(),
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
    } : {
      clientId: 0,
      serviceId: 0,
      technicianId: 0,
      teamId: undefined,
      scheduledDate: new Date(),
      status: "scheduled",
      priority: "normal",
      notes: "",
      cep: "",
      logradouro: "",
      numero: "",
      complemento: "",
      bairro: "Não informado",
      cidade: "Não informado",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertAppointment) => {
      const response = await fetch("/api/appointments", {
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
      const response = await fetch(`/api/appointments/${appointment?.id}`, {
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
    
    const formData = {
      ...data,
      scheduledDate: processedDate
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

  const handleClientCreated = (client: Client) => {
    setSelectedClient(client.id);
    form.setValue("clientId", client.id);
    // Auto-fill address fields from client
    form.setValue("cep", client.cep);
    form.setValue("logradouro", client.logradouro);
    form.setValue("numero", client.numero);
    form.setValue("complemento", client.complemento || "");
    form.setValue("bairro", client.bairro || "Não informado");
    form.setValue("cidade", client.cidade || "Não informado");
  };

  const handleClientChange = (clientId: string) => {
    const client = clients.find(c => c.id === parseInt(clientId));
    if (client) {
      setSelectedClient(client.id);
      // Auto-fill address fields from selected client
      form.setValue("cep", client.cep);
      form.setValue("logradouro", client.logradouro);
      form.setValue("numero", client.numero);
      form.setValue("complemento", client.complemento || "");
      form.setValue("bairro", client.bairro || "Não informado");
      form.setValue("cidade", client.cidade || "Não informado");
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



  return (
    <div className="space-y-6">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          {appointment ? "Editar Agendamento" : "Novo Agendamento"}
        </DialogTitle>
      </DialogHeader>

      <div className="flex gap-2 mb-4">
        <NewClientDialog onClientCreated={handleClientCreated}>
          <Button variant="outline" size="sm" className="text-green-600 border-green-600 hover:bg-green-50">
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
                      if (!isFromFindDate) {
                        field.onChange(value ?? undefined);
                        if (value) {
                          handleClientChange(value.toString());
                        }
                      }
                    }}
                    placeholder="Pesquisar por nome ou CPF"
                    disabled={isFromFindDate}
                  />
                </FormControl>
                {isFromFindDate && (
                  <p className="text-sm text-blue-600">Cliente selecionado a partir da busca "Ache uma data" - não pode ser alterado</p>
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
                      if (!isFromFindDate) {
                        field.onChange(parseInt(value));
                      }
                    }} 
                    value={field.value?.toString()}
                    disabled={isFromFindDate}
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
                    <p className="text-sm text-blue-600">Serviço selecionado a partir da busca "Ache uma data" - não pode ser alterado</p>
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
                      if (!isFromFindDate) {
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
                    disabled={isFromFindDate}
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
                    <p className="text-sm text-blue-600">Técnico/Equipe selecionado a partir da busca "Ache uma data" - não pode ser alterado</p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Date and Time */}
          <FormField
            control={form.control}
            name="scheduledDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data e Hora *</FormLabel>
                <FormControl>
                  <Input
                    type="datetime-local"
                    {...field}
                    value={field.value ? new Date(field.value.getTime() - field.value.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""}
                    onChange={(e) => field.onChange(new Date(e.target.value))}
                    disabled={!!prefilledData?.date}
                  />
                </FormControl>
                {prefilledData?.date && (
                  <p className="text-sm text-blue-600">Data selecionada a partir da busca "Ache uma data" - não pode ser alterada</p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

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
                          }
                        }}
                        onClick={appointment ? handleAddressFieldClick : undefined}
                        disabled={!!prefilledData?.cep || !!appointment}
                        readOnly={!!appointment}
                        className={appointment ? "bg-gray-50 cursor-not-allowed" : ""}
                      />
                    </FormControl>
                    {prefilledData?.cep && (
                      <p className="text-sm text-blue-600">CEP selecionado a partir da busca "Ache uma data" - não pode ser alterado</p>
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
                      <p className="text-sm text-blue-600">Número selecionado a partir da busca "Ache uma data" - não pode ser alterado</p>
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
                        disabled={isFromFindDate || !!appointment}
                        readOnly={!!appointment}
                        className={appointment ? "bg-gray-50 cursor-not-allowed" : ""}
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
                        disabled={isFromFindDate || !!appointment}
                        readOnly={!!appointment}
                        className={appointment ? "bg-gray-50 cursor-not-allowed" : ""}
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
                        disabled={isFromFindDate || !!appointment}
                        readOnly={!!appointment}
                        className={appointment ? "bg-gray-50 cursor-not-allowed" : ""}
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
                        disabled={isFromFindDate || !!appointment}
                        readOnly={!!appointment}
                        className={appointment ? "bg-gray-50 cursor-not-allowed" : ""}
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
                  <Select onValueChange={field.onChange} value={field.value}>
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
                  <Select onValueChange={field.onChange} value={field.value}>
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
              disabled={createMutation.isPending || updateMutation.isPending}
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