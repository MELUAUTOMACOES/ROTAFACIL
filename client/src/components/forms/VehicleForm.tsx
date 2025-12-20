import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  insertVehicleSchema,
  type InsertVehicle,
  type Vehicle,
  type Technician,
  type Team,
} from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Car, Calendar, User, Users, FileText } from "lucide-react";
import VehicleDocumentsSection from "./VehicleDocumentsSection";

interface VehicleFormProps {
  vehicle?: Vehicle | null;
  technicians: Technician[];
  teams: Team[];
  vehicles: Vehicle[];
  onClose: () => void;
}

export default function VehicleForm({
  vehicle,
  technicians,
  teams,
  vehicles,
  onClose,
}: VehicleFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("dados");
  const [assignmentType, setAssignmentType] = useState<"technician" | "team">(
    vehicle?.technicianId
      ? "technician"
      : vehicle?.teamId
        ? "team"
        : "technician",
  );

  const form = useForm<InsertVehicle>({
    resolver: zodResolver(insertVehicleSchema),
    defaultValues: vehicle
      ? {
        plate: vehicle.plate,
        model: vehicle.model,
        brand: vehicle.brand,
        year: vehicle.year,
        technicianId: vehicle.technicianId || undefined,
        teamId: vehicle.teamId || undefined,
      }
      : {
        plate: "",
        model: "",
        brand: "",
        year: new Date().getFullYear(),
        technicianId: undefined,
        teamId: undefined,
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
      const response = await apiRequest(
        "PUT",
        `/api/vehicles/${vehicle!.id}`,
        data,
      );
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

  const isLoading =
    createVehicleMutation.isPending || updateVehicleMutation.isPending;

  return (
    <div className="space-y-6">
      <DialogHeader>
        <DialogTitle className="flex items-center">
          <Car className="h-5 w-5 mr-2 text-burnt-yellow" />
          {vehicle ? "Editar Veículo" : "Novo Veículo"}
        </DialogTitle>
      </DialogHeader>

      {/* Se estiver editando, mostra abas */}
      {vehicle ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="dados" className="flex items-center">
              <Car className="h-4 w-4 mr-2" />
              Dados
            </TabsTrigger>
            <TabsTrigger value="documentos" className="flex items-center">
              <FileText className="h-4 w-4 mr-2" />
              Documentos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dados" className="mt-4">
            {renderVehicleForm()}
          </TabsContent>

          <TabsContent value="documentos" className="mt-4">
            <VehicleDocumentsSection vehicleId={vehicle.id} />
          </TabsContent>
        </Tabs>
      ) : (
        // Se estiver criando, mostra apenas o formulário
        renderVehicleForm()
      )}
    </div>
  );

  function renderVehicleForm() {
    return (
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="plate">Placa *</Label>
          <Input
            placeholder="AAA-1234 ou AAA1A23"
            className="mt-1"
            style={{ textTransform: "uppercase" }}
            value={form.watch("plate") || ""}
            onChange={(e) => {
              let v = e.target.value
                .toUpperCase()
                // remove qualquer caracter que não seja letra ou número
                .replace(/[^A-Z0-9]/g, "");

              // corta sempre para 7 chars (AAA1234 ou AAA1A23 têm 7 caracteres)
              v = v.slice(0, 7);

              // Se for EXATAMENTE 3 letras + 4 números, insere hífen: AAA-1234
              if (/^[A-Z]{3}[0-9]{4}$/.test(v)) {
                v = `${v.slice(0, 3)}-${v.slice(3)}`;
              }

              // atualiza o valor no RHF, disparando validação
              form.setValue("plate", v, { shouldValidate: true });
            }}
          />
          {form.formState.errors.plate && (
            <p className="text-sm text-red-600 mt-1">
              {form.formState.errors.plate.message}
            </p>
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
              <p className="text-sm text-red-600 mt-1">
                {form.formState.errors.brand.message}
              </p>
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
              <p className="text-sm text-red-600 mt-1">
                {form.formState.errors.model.message}
              </p>
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
            <p className="text-sm text-red-600 mt-1">
              {form.formState.errors.year.message}
            </p>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-base font-medium">
              Responsável pelo Veículo *
            </Label>
            <p className="text-sm text-gray-600">
              Selecione um técnico individual ou uma equipe
            </p>
          </div>

          <RadioGroup
            value={assignmentType}
            onValueChange={(value: "technician" | "team") => {
              setAssignmentType(value);
              // Limpar campos opostos quando trocar tipo
              if (value === "technician") {
                form.setValue("teamId", undefined, { shouldValidate: false });
              } else {
                form.setValue("technicianId", undefined, { shouldValidate: false });
              }
            }}
            className="flex gap-6"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="technician" id="technician" />
              <Label
                htmlFor="technician"
                className="flex items-center cursor-pointer"
              >
                <User className="h-4 w-4 mr-2" />
                Técnico Individual
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="team" id="team" />
              <Label
                htmlFor="team"
                className="flex items-center cursor-pointer"
              >
                <Users className="h-4 w-4 mr-2" />
                Equipe
              </Label>
            </div>
          </RadioGroup>

          {assignmentType === "technician" ? (
            <div>
              <Label htmlFor="technicianId">Técnico Responsável *</Label>
              <Select
                value={form.watch("technicianId")?.toString() || ""}
                onValueChange={(value) =>
                  form.setValue(
                    "technicianId",
                    value ? parseInt(value) : undefined,
                    { shouldValidate: true }
                  )
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione um técnico" />
                </SelectTrigger>
                <SelectContent>
                  {technicians
                    .filter((t) => {
                      // Filtrar técnicos ativos
                      if (!t.isActive) return false;

                      // Se estiver editando, permitir o técnico atual
                      if (vehicle?.technicianId === t.id) return true;

                      // Filtrar técnicos já vinculados a outros veículos
                      const isLinked = vehicles.some(
                        (v) => v.technicianId === t.id && v.id !== vehicle?.id
                      );
                      return !isLinked;
                    })
                    .map((technician) => (
                      <SelectItem
                        key={technician.id}
                        value={technician.id.toString()}
                      >
                        {technician.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {form.formState.errors.technicianId && (
                <p className="text-sm text-red-600 mt-1">
                  {form.formState.errors.technicianId.message}
                </p>
              )}
            </div>
          ) : (
            <div>
              <Label htmlFor="teamId">Equipe Responsável *</Label>
              <Select
                value={form.watch("teamId")?.toString() || ""}
                onValueChange={(value) =>
                  form.setValue("teamId", value ? parseInt(value) : undefined, { shouldValidate: true })
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione uma equipe" />
                </SelectTrigger>
                <SelectContent>
                  {teams
                    .filter((team) => {
                      // Se estiver editando, permitir a equipe atual
                      if (vehicle?.teamId === team.id) return true;

                      // Filtrar equipes já vinculadas a outros veículos
                      const isLinked = vehicles.some(
                        (v) => v.teamId === team.id && v.id !== vehicle?.id
                      );
                      return !isLinked;
                    })
                    .map((team) => (
                      <SelectItem key={team.id} value={team.id.toString()}>
                        {team.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {form.formState.errors.teamId && (
                <p className="text-sm text-red-600 mt-1">
                  {form.formState.errors.teamId.message}
                </p>
              )}
              {assignmentType === "team" && form.watch("teamId") && (
                <p className="text-xs text-blue-600 mt-1">
                  ℹ️ Todos os técnicos desta equipe terão acesso a este veículo
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
          <Button type="button" variant="outline" onClick={onClose}>
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
    );
  }
}
