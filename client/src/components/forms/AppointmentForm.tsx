import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { extendedInsertAppointmentSchema, type InsertAppointment, type Appointment, type Client, type Service, type Technician } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, Clock, MapPin, UserPlus, Upload, FileSpreadsheet } from "lucide-react";
import NewClientDialog from "./NewClientDialog";

interface AppointmentFormProps {
  appointment?: Appointment | null;
  clients: Client[];
  services: Service[];
  technicians: Technician[];
  onClose: () => void;
}

export default function AppointmentForm({ 
  appointment, 
  clients, 
  services, 
  technicians, 
  onClose 
}: AppointmentFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const form = useForm<InsertAppointment>({
    resolver: zodResolver(insertAppointmentSchema),
    defaultValues: appointment ? {
      clientId: appointment.clientId,
      serviceId: appointment.serviceId,
      technicianId: appointment.technicianId,
      scheduledDate: new Date(appointment.scheduledDate),
      status: appointment.status,
      priority: appointment.priority,
      notes: appointment.notes || "",
      address: appointment.address,
    } : {
      status: "scheduled",
      priority: "normal",
      notes: "",
      address: "",
    },
  });

  const createAppointmentMutation = useMutation({
    mutationFn: async (data: InsertAppointment) => {
      const response = await apiRequest("POST", "/api/appointments", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      toast({
        title: "Sucesso",
        description: "Agendamento criado com sucesso",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar agendamento",
        variant: "destructive",
      });
    },
  });

  const updateAppointmentMutation = useMutation({
    mutationFn: async (data: InsertAppointment) => {
      const response = await apiRequest("PUT", `/api/appointments/${appointment!.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      toast({
        title: "Sucesso",
        description: "Agendamento atualizado com sucesso",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar agendamento",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertAppointment) => {
    if (appointment) {
      updateAppointmentMutation.mutate(data);
    } else {
      createAppointmentMutation.mutate(data);
    }
  };

  const isLoading = createAppointmentMutation.isPending || updateAppointmentMutation.isPending;

  return (
    <div className="space-y-6">
      <DialogHeader>
        <DialogTitle className="flex items-center">
          <Calendar className="h-5 w-5 mr-2 text-burnt-yellow" />
          {appointment ? "Editar Agendamento" : "Novo Agendamento"}
        </DialogTitle>
      </DialogHeader>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="clientId">Cliente *</Label>
            <Select 
              value={form.watch("clientId")?.toString() || ""} 
              onValueChange={(value) => form.setValue("clientId", parseInt(value))}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione o cliente" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id.toString()}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.clientId && (
              <p className="text-sm text-red-600 mt-1">{form.formState.errors.clientId.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="serviceId">Serviço *</Label>
            <Select 
              value={form.watch("serviceId")?.toString() || ""} 
              onValueChange={(value) => form.setValue("serviceId", parseInt(value))}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione o serviço" />
              </SelectTrigger>
              <SelectContent>
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.id.toString()}>
                    {service.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.serviceId && (
              <p className="text-sm text-red-600 mt-1">{form.formState.errors.serviceId.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="technicianId">Técnico *</Label>
            <Select 
              value={form.watch("technicianId")?.toString() || ""} 
              onValueChange={(value) => form.setValue("technicianId", parseInt(value))}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione o técnico" />
              </SelectTrigger>
              <SelectContent>
                {technicians.filter(t => t.isActive).map((technician) => (
                  <SelectItem key={technician.id} value={technician.id.toString()}>
                    {technician.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.technicianId && (
              <p className="text-sm text-red-600 mt-1">{form.formState.errors.technicianId.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="scheduledDate">Data e Hora *</Label>
            <Input
              type="datetime-local"
              {...form.register("scheduledDate", { 
                valueAsDate: true,
                setValueAs: (value) => value ? new Date(value) : undefined
              })}
              className="mt-1"
            />
            {form.formState.errors.scheduledDate && (
              <p className="text-sm text-red-600 mt-1">{form.formState.errors.scheduledDate.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <Select 
              value={form.watch("status")} 
              onValueChange={(value) => form.setValue("status", value as any)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">Agendado</SelectItem>
                <SelectItem value="in_progress">Em Andamento</SelectItem>
                <SelectItem value="completed">Concluído</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="priority">Prioridade</Label>
            <Select 
              value={form.watch("priority")} 
              onValueChange={(value) => form.setValue("priority", value as any)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="urgent">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="address" className="flex items-center">
            <MapPin className="h-4 w-4 mr-1" />
            Endereço *
          </Label>
          <Input
            {...form.register("address")}
            placeholder="Endereço completo do atendimento"
            className="mt-1"
          />
          {form.formState.errors.address && (
            <p className="text-sm text-red-600 mt-1">{form.formState.errors.address.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="notes">Observações</Label>
          <Textarea
            {...form.register("notes")}
            placeholder="Observações adicionais sobre o atendimento"
            rows={3}
            className="mt-1"
          />
        </div>

        <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
          <Button 
            type="button" 
            variant="outline"
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button 
            type="submit" 
            disabled={isLoading}
            className="bg-black text-white hover:bg-gray-800"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
            ) : null}
            {appointment ? "Atualizar" : "Criar"} Agendamento
          </Button>
        </div>
      </form>
    </div>
  );
}
