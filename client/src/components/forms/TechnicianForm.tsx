import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { insertTechnicianSchema, type InsertTechnician, type Technician } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserCog, Mail, Phone, Wrench } from "lucide-react";

interface TechnicianFormProps {
  technician?: Technician | null;
  onClose: () => void;
}

export default function TechnicianForm({ technician, onClose }: TechnicianFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const form = useForm<InsertTechnician>({
    resolver: zodResolver(insertTechnicianSchema),
    defaultValues: technician ? {
      name: technician.name,
      email: technician.email || "",
      phone: technician.phone,
      specialization: technician.specialization || "",
      isActive: technician.isActive,
    } : {
      name: "",
      email: "",
      phone: "",
      specialization: "",
      isActive: true,
    },
  });

  const createTechnicianMutation = useMutation({
    mutationFn: async (data: InsertTechnician) => {
      const response = await apiRequest("POST", "/api/technicians", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/technicians"] });
      toast({
        title: "Sucesso",
        description: "Técnico criado com sucesso",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar técnico",
        variant: "destructive",
      });
    },
  });

  const updateTechnicianMutation = useMutation({
    mutationFn: async (data: InsertTechnician) => {
      const response = await apiRequest("PUT", `/api/technicians/${technician!.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/technicians"] });
      toast({
        title: "Sucesso",
        description: "Técnico atualizado com sucesso",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar técnico",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertTechnician) => {
    if (technician) {
      updateTechnicianMutation.mutate(data);
    } else {
      createTechnicianMutation.mutate(data);
    }
  };

  const isLoading = createTechnicianMutation.isPending || updateTechnicianMutation.isPending;

  return (
    <div className="space-y-6">
      <DialogHeader>
        <DialogTitle className="flex items-center">
          <UserCog className="h-5 w-5 mr-2 text-burnt-yellow" />
          {technician ? "Editar Técnico" : "Novo Técnico"}
        </DialogTitle>
      </DialogHeader>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="name">Nome *</Label>
          <Input
            {...form.register("name")}
            placeholder="Nome completo do técnico"
            className="mt-1"
          />
          {form.formState.errors.name && (
            <p className="text-sm text-red-600 mt-1">{form.formState.errors.name.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="email" className="flex items-center">
            <Mail className="h-4 w-4 mr-1" />
            Email
          </Label>
          <Input
            {...form.register("email")}
            type="email"
            placeholder="email@exemplo.com"
            className="mt-1"
          />
          {form.formState.errors.email && (
            <p className="text-sm text-red-600 mt-1">{form.formState.errors.email.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="phone" className="flex items-center">
            <Phone className="h-4 w-4 mr-1" />
            Telefone *
          </Label>
          <Input
            {...form.register("phone")}
            placeholder="(11) 99999-9999"
            className="mt-1"
          />
          {form.formState.errors.phone && (
            <p className="text-sm text-red-600 mt-1">{form.formState.errors.phone.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="specialization" className="flex items-center">
            <Wrench className="h-4 w-4 mr-1" />
            Especialização
          </Label>
          <Input
            {...form.register("specialization")}
            placeholder="Ex: Eletricista, Encanador, Ar Condicionado"
            className="mt-1"
          />
          {form.formState.errors.specialization && (
            <p className="text-sm text-red-600 mt-1">{form.formState.errors.specialization.message}</p>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="isActive"
            checked={form.watch("isActive")}
            onCheckedChange={(checked) => form.setValue("isActive", checked)}
          />
          <Label htmlFor="isActive">Técnico ativo</Label>
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
            {technician ? "Atualizar" : "Criar"} Técnico
          </Button>
        </div>
      </form>
    </div>
  );
}
