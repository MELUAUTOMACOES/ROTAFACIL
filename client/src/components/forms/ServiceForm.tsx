import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { insertServiceSchema, type InsertService, type Service } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Wrench, Clock, DollarSign, FileText, Award } from "lucide-react";

interface ServiceFormProps {
  service?: Service | null;
  onClose: () => void;
}

export default function ServiceForm({ service, onClose }: ServiceFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const form = useForm<InsertService>({
    resolver: zodResolver(insertServiceSchema),
    defaultValues: service ? {
      name: service.name,
      description: service.description || "",
      duration: service.duration,
      price: service.price || "",
      cost: service.cost || "",
      points: service.points || undefined,
    } : {
      name: "",
      description: "",
      duration: 60,
      price: "",
      cost: "",
      points: undefined,
    },
  });

  const createServiceMutation = useMutation({
    mutationFn: async (data: InsertService) => {
      const response = await apiRequest("POST", "/api/services", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      toast({
        title: "Sucesso",
        description: "Serviço criado com sucesso",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar serviço",
        variant: "destructive",
      });
    },
  });

  const updateServiceMutation = useMutation({
    mutationFn: async (data: InsertService) => {
      const response = await apiRequest("PUT", `/api/services/${service!.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      toast({
        title: "Sucesso",
        description: "Serviço atualizado com sucesso",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar serviço",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertService) => {
    if (service) {
      updateServiceMutation.mutate(data);
    } else {
      createServiceMutation.mutate(data);
    }
  };

  const isLoading = createServiceMutation.isPending || updateServiceMutation.isPending;

  return (
    <div className="space-y-6">
      <DialogHeader>
        <DialogTitle className="flex items-center">
          <Wrench className="h-5 w-5 mr-2 text-burnt-yellow" />
          {service ? "Editar Serviço" : "Novo Serviço"}
        </DialogTitle>
      </DialogHeader>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="name">Nome do Serviço *</Label>
          <Input
            {...form.register("name")}
            placeholder="Ex: Manutenção Preventiva, Instalação"
            className="mt-1"
          />
          {form.formState.errors.name && (
            <p className="text-sm text-red-600 mt-1">{form.formState.errors.name.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="description" className="flex items-center">
            <FileText className="h-4 w-4 mr-1" />
            Descrição
          </Label>
          <Textarea
            {...form.register("description")}
            placeholder="Descreva os detalhes do serviço oferecido"
            rows={3}
            className="mt-1"
          />
          {form.formState.errors.description && (
            <p className="text-sm text-red-600 mt-1">{form.formState.errors.description.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="duration" className="flex items-center">
            <Clock className="h-4 w-4 mr-1" />
            Duração (minutos) *
          </Label>
          <Input
            {...form.register("duration", { valueAsNumber: true })}
            type="number"
            min="1"
            step="1"
            placeholder="60"
            className="mt-1"
          />
          {form.formState.errors.duration && (
            <p className="text-sm text-red-600 mt-1">{form.formState.errors.duration.message}</p>
          )}
        </div>

        {/* Campo adicionado para pontos/remuneração conforme solicitado */}
        <div>
          <Label htmlFor="points" className="flex items-center">
            <Award className="h-4 w-4 mr-1" />
            Pontos/remuneração
          </Label>
          <Input
            {...form.register("points", { valueAsNumber: true })}
            type="number"
            min="0"
            step="1"
            placeholder="100"
            className="mt-1"
          />
          {form.formState.errors.points && (
            <p className="text-sm text-red-600 mt-1">{form.formState.errors.points.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="price" className="flex items-center">
              <DollarSign className="h-4 w-4 mr-1" />
              Preço (R$)
            </Label>
            <Input
              {...form.register("price")}
              type="number"
              min="0"
              step="0.01"
              placeholder="100.00"
              className="mt-1"
            />
            {form.formState.errors.price && (
              <p className="text-sm text-red-600 mt-1">{form.formState.errors.price.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="cost" className="flex items-center">
              <DollarSign className="h-4 w-4 mr-1" />
              Custo (R$)
            </Label>
            <Input
              {...form.register("cost")}
              type="number"
              min="0"
              step="0.01"
              placeholder="50.00"
              className="mt-1"
            />
            {form.formState.errors.cost && (
              <p className="text-sm text-red-600 mt-1">{form.formState.errors.cost.message}</p>
            )}
          </div>
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
            {service ? "Atualizar" : "Criar"} Serviço
          </Button>
        </div>
      </form>
    </div>
  );
}
