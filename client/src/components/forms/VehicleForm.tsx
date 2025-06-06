import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { insertVehicleSchema, type InsertVehicle, type Vehicle, type Technician } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Car, Calendar, User } from "lucide-react";

interface VehicleFormProps {
  vehicle?: Vehicle | null;
  technicians: Technician[];
  onClose: () => void;
}

export default function VehicleForm({ vehicle, technicians, onClose }: VehicleFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const form = useForm<InsertVehicle>({
    resolver: zodResolver(insertVehicleSchema),
    defaultValues: vehicle ? {
      plate: vehicle.plate,
      model: vehicle.model,
      brand: vehicle.brand,
      year: vehicle.year,
      technicianId: vehicle.technicianId || undefined,
    } : {
      plate: "",
      model: "",
      brand: "",
      year: new Date().getFullYear(),
      technicianId: undefined,
    },
  });

  const createVehicleMutation = useMutation({
    mutationFn: async (data: InsertVehicle) => {
      const response = await apiRequest("POST", "/api/vehicles", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      toast({
        title: "Sucesso",
        description: "Veículo criado com sucesso",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar veículo",
        variant: "destructive",
      });
    },
  });

  const updateVehicleMutation = useMutation({
    mutationFn: async (data: InsertVehicle) => {
      const response = await apiRequest("PUT", `/api/vehicles/${vehicle!.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      toast({
        title: "Sucesso",
        description: "Veículo atualizado com sucesso",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar veículo",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertVehicle) => {
    if (vehicle) {
      updateVehicleMutation.mutate(data);
    } else {
      createVehicleMutation.mutate(data);
    }
  };

  const isLoading = createVehicleMutation.isPending || updateVehicleMutation.isPending;

  return (
    <div className="space-y-6">
      <DialogHeader>
        <DialogTitle className="flex items-center">
          <Car className="h-5 w-5 mr-2 text-burnt-yellow" />
          {vehicle ? "Editar Veículo" : "Novo Veículo"}
        </DialogTitle>
      </DialogHeader>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="plate">Placa *</Label>
          <Input
            {...form.register("plate")}
            placeholder="ABC-1234"
            className="mt-1"
            style={{ textTransform: 'uppercase' }}
          />
          {form.formState.errors.plate && (
            <p className="text-sm text-red-600 mt-1">{form.formState.errors.plate.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="brand">Marca *</Label>
            <Input
              {...form.register("brand")}
              placeholder="Ex: Ford, Volkswagen"
              className="mt-1"
            />
            {form.formState.errors.brand && (
              <p className="text-sm text-red-600 mt-1">{form.formState.errors.brand.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="model">Modelo *</Label>
            <Input
              {...form.register("model")}
              placeholder="Ex: Fiesta, Gol"
              className="mt-1"
            />
            {form.formState.errors.model && (
              <p className="text-sm text-red-600 mt-1">{form.formState.errors.model.message}</p>
            )}
          </div>
        </div>

        <div>
          <Label htmlFor="year" className="flex items-center">
            <Calendar className="h-4 w-4 mr-1" />
            Ano *
          </Label>
          <Input
            {...form.register("year", { valueAsNumber: true })}
            type="number"
            min="1900"
            max={new Date().getFullYear() + 1}
            placeholder="2020"
            className="mt-1"
          />
          {form.formState.errors.year && (
            <p className="text-sm text-red-600 mt-1">{form.formState.errors.year.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="technicianId" className="flex items-center">
            <User className="h-4 w-4 mr-1" />
            Técnico Responsável
          </Label>
          <Select 
            value={form.watch("technicianId")?.toString() || "none"} 
            onValueChange={(value) => 
              form.setValue("technicianId", value === "none" ? null : parseInt(value))
            }
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Selecione um técnico (opcional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum técnico atribuído</SelectItem>
              {technicians.filter(t => t.isActive).map((technician) => (
                <SelectItem key={technician.id} value={technician.id.toString()}>
                  {technician.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
            {vehicle ? "Atualizar" : "Criar"} Veículo
          </Button>
        </div>
      </form>
    </div>
  );
}
