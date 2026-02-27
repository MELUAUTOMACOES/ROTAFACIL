import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  insertVehicleSchema,
  fuelTypeLabels,
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
import { Car, Calendar, User, Users, FileText, Fuel, Gauge, CheckSquare, Shield } from "lucide-react";
import VehicleDocumentsSection from "./VehicleDocumentsSection";
import { Checkbox } from "@/components/ui/checkbox";

interface VehicleFormProps {
  vehicle?: Vehicle | null;
  technicians: Technician[];
  teams: Team[];
  vehicles: Vehicle[];
  onClose: () => void;
  initialTab?: string;
}

interface VehicleWithAssignments extends Vehicle {
  authorizedTechnicianIds?: number[];
  authorizedTeamIds?: number[];
}

type FuelTypeKey = "gasolina" | "etanol" | "diesel_s500" | "diesel_s10" | "eletrico" | "hibrido";

interface InitialFormValues {
  plate: string;
  model: string;
  brand: string;
  year: number;
  fuelType: FuelTypeKey;
  fuelConsumption: string | undefined;
  tankCapacity: number | undefined;
  technicianId: number | undefined;
  teamId: number | undefined;
  assignmentType: "technician" | "team";
}

// Helper para processar valores iniciais do veículo
function getInitialValues(vehicle: Vehicle | null | undefined): InitialFormValues {
  if (!vehicle) {
    return {
      plate: "",
      model: "",
      brand: "",
      year: new Date().getFullYear(),
      fuelType: "gasolina",
      fuelConsumption: undefined,
      tankCapacity: undefined,
      technicianId: undefined,
      teamId: undefined,
      assignmentType: "technician",
    };
  }

  // Normalizar fuelType para lowercase
  let fuelTypeRaw: string = vehicle.fuelType || "gasolina";
  fuelTypeRaw = fuelTypeRaw.trim().toLowerCase();

  const validFuelTypes: FuelTypeKey[] = ["gasolina", "etanol", "diesel_s500", "diesel_s10", "eletrico", "hibrido"];
  const fuelType: FuelTypeKey = validFuelTypes.includes(fuelTypeRaw as FuelTypeKey)
    ? (fuelTypeRaw as FuelTypeKey)
    : "gasolina";

  // Garantir IDs numéricos válidos
  let technicianId: number | undefined = undefined;
  if (vehicle.technicianId != null) {
    const n = Number(vehicle.technicianId);
    if (Number.isFinite(n) && n > 0) technicianId = n;
  }

  let teamId: number | undefined = undefined;
  if (vehicle.teamId != null) {
    const n = Number(vehicle.teamId);
    if (Number.isFinite(n) && n > 0) teamId = n;
  }

  const assignmentType: "technician" | "team" = teamId ? "team" : "technician";

  console.log("🚗 [VehicleForm] getInitialValues:", {
    vehicleId: vehicle.id,
    originalFuelType: vehicle.fuelType,
    normalizedFuelType: fuelType,
    technicianId,
    teamId,
    assignmentType,
  });

  return {
    plate: vehicle.plate,
    model: vehicle.model,
    brand: vehicle.brand,
    year: vehicle.year,
    fuelType,
    fuelConsumption: vehicle.fuelConsumption != null ? String(vehicle.fuelConsumption) : undefined,
    tankCapacity: vehicle.tankCapacity ?? undefined,
    technicianId: assignmentType === "technician" ? technicianId : undefined,
    teamId: assignmentType === "team" ? teamId : undefined,
    assignmentType,
  };
}

export default function VehicleForm({
  vehicle,
  technicians,
  teams,
  vehicles,
  onClose,
  initialTab = "dados",
}: VehicleFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(initialTab);

  // Calcular valores iniciais uma vez na montagem
  const initialValues = getInitialValues(vehicle);

  const [assignmentType, setAssignmentType] = useState<"technician" | "team">(
    initialValues.assignmentType
  );

  // 🆕 Estados para autorizações (múltiplos técnicos/equipes)
  const vehicleWithAssignments = vehicle as VehicleWithAssignments | null | undefined;
  const [authorizedTechnicianIds, setAuthorizedTechnicianIds] = useState<number[]>(
    vehicleWithAssignments?.authorizedTechnicianIds || []
  );
  const [authorizedTeamIds, setAuthorizedTeamIds] = useState<number[]>(
    vehicleWithAssignments?.authorizedTeamIds || []
  );

  const form = useForm<InsertVehicle>({
    resolver: zodResolver(insertVehicleSchema),
    defaultValues: {
      plate: initialValues.plate,
      model: initialValues.model,
      brand: initialValues.brand,
      year: initialValues.year,
      fuelType: initialValues.fuelType,
      fuelConsumption: initialValues.fuelConsumption,
      tankCapacity: initialValues.tankCapacity,
      technicianId: initialValues.technicianId,
      teamId: initialValues.teamId,
    },
  });

  const createVehicleMutation = useMutation({
    mutationFn: async (data: InsertVehicle) => {
      const payload = {
        ...data,
        authorizedTechnicianIds,
        authorizedTeamIds
      };
      const response = await apiRequest("POST", "/api/vehicles", payload);
      return response.json();
    },
    onSuccess: (createdVehicle: Vehicle) => {
      queryClient.setQueryData<Vehicle[]>(["/api/vehicles"], (old) =>
        old ? [...old, createdVehicle] : [createdVehicle],
      );
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
      const payload = {
        ...data,
        authorizedTechnicianIds,
        authorizedTeamIds
      };
      const response = await apiRequest(
        "PUT",
        `/api/vehicles/${vehicle!.id}`,
        payload,
      );
      return response.json();
    },
    onSuccess: (updatedVehicle: Vehicle) => {
      queryClient.setQueryData<Vehicle[]>(["/api/vehicles"], (old) =>
        old
          ? old.map((v) => (v.id === updatedVehicle.id ? updatedVehicle : v))
          : old,
      );
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
    console.log("🚗 [VehicleForm] Submitting data:", data);
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
    // Capturar valores atuais para usar no filtro
    const currentTechnicianId = form.watch("technicianId");

    return (
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="plate">Placa *</Label>
          <Input
            placeholder="AAA-1234 ou AAA1B23"
            className="mt-1"
            style={{ textTransform: "uppercase" }}
            value={form.watch("plate") || ""}
            maxLength={8}
            onChange={(e) => {
              // Remove tudo que não for letra ou número
              let v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
              // Limitar a 7 caracteres brutos
              v = v.slice(0, 7);
              // Inserir hífen após as 3 primeiras letras se já existem 4+ chars
              if (v.length >= 4 && /^[A-Z]{3}/.test(v)) {
                v = v.slice(0, 3) + '-' + v.slice(3);
              }
              form.setValue("plate", v, { shouldValidate: true });
            }}
          />
          {form.formState.errors.plate && (
            <p className="text-sm text-red-600 mt-1">
              Informe uma placa válida: <strong>AAA-1234</strong> (padrão antigo) ou <strong>AAA1B23</strong> (Mercosul)
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

        {/* Seção de Combustível */}
        <div className="border-t pt-4 mt-4">
          <Label className="text-base font-medium flex items-center mb-3">
            <Fuel className="h-4 w-4 mr-2" />
            Combustível e Consumo
          </Label>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="fuelType">Tipo de Combustível *</Label>
              <Select
                value={form.watch("fuelType") || "gasolina"}
                onValueChange={(value) =>
                  form.setValue("fuelType", value as any, { shouldValidate: true })
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(fuelTypeLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.fuelType && (
                <p className="text-sm text-red-600 mt-1">
                  {form.formState.errors.fuelType.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="fuelConsumption" className="block mb-1">
                Consumo ({form.watch("fuelType") === "eletrico" ? "km/kWh" : "km/L"})
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  id="fuelConsumption"
                  max="100"
                  placeholder="Ex: 12.5"
                  className="mt-1"
                  value={form.watch("fuelConsumption")?.toString() || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    form.setValue("fuelConsumption", val === "" ? undefined : val, { shouldValidate: true });
                  }}
                />
              </div>
              {form.formState.errors.fuelConsumption && (
                <p className="text-sm text-red-600 mt-1">
                  {form.formState.errors.fuelConsumption.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="tankCapacity">Capacidade Tanque (L)</Label>
              <Input
                type="number"
                min="10"
                max="500"
                placeholder="Ex: 50"
                className="mt-1"
                value={form.watch("tankCapacity") || ""}
                onChange={(e) => form.setValue("tankCapacity", e.target.value ? parseInt(e.target.value) : undefined, { shouldValidate: true })}
              />
              {form.formState.errors.tankCapacity && (
                <p className="text-sm text-red-600 mt-1">
                  {form.formState.errors.tankCapacity.message}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 🆕 Seção de Prestadores Autorizados */}
        <div className="border-t pt-4 mt-4">
          <Label className="text-base font-medium flex items-center mb-3">
            <Shield className="h-4 w-4 mr-2 text-blue-600" />
            Prestadores Autorizados a Usar o Veículo
          </Label>
          <p className="text-sm text-gray-600 mb-4">
            Selecione quais técnicos e equipes podem utilizar este veículo no romaneio
          </p>

          <div className="grid grid-cols-2 gap-6">
            {/* Técnicos Autorizados */}
            <div className="space-y-3">
              <Label className="font-medium flex items-center">
                <User className="h-4 w-4 mr-2" />
                Técnicos
              </Label>
              <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                {technicians.filter(t => t.isActive).length === 0 ? (
                  <p className="text-sm text-gray-500 italic">Nenhum técnico ativo</p>
                ) : (
                  technicians
                    .filter(t => t.isActive)
                    .map((tech) => (
                      <div key={tech.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`tech-${tech.id}`}
                          checked={authorizedTechnicianIds.includes(tech.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setAuthorizedTechnicianIds([...authorizedTechnicianIds, tech.id]);
                            } else {
                              setAuthorizedTechnicianIds(
                                authorizedTechnicianIds.filter(id => id !== tech.id)
                              );
                            }
                          }}
                        />
                        <label
                          htmlFor={`tech-${tech.id}`}
                          className="text-sm cursor-pointer flex-1"
                        >
                          {tech.name}
                        </label>
                      </div>
                    ))
                )}
              </div>
              {authorizedTechnicianIds.length > 0 && (
                <p className="text-xs text-blue-600">
                  ✓ {authorizedTechnicianIds.length} técnico(s) autorizado(s)
                </p>
              )}
            </div>

            {/* Equipes Autorizadas */}
            <div className="space-y-3">
              <Label className="font-medium flex items-center">
                <Users className="h-4 w-4 mr-2" />
                Equipes
              </Label>
              <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                {teams.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">Nenhuma equipe cadastrada</p>
                ) : (
                  teams.map((team) => (
                    <div key={team.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`team-${team.id}`}
                        checked={authorizedTeamIds.includes(team.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setAuthorizedTeamIds([...authorizedTeamIds, team.id]);
                          } else {
                            setAuthorizedTeamIds(
                              authorizedTeamIds.filter(id => id !== team.id)
                            );
                          }
                        }}
                      />
                      <label
                        htmlFor={`team-${team.id}`}
                        className="text-sm cursor-pointer flex-1"
                      >
                        {team.name}
                      </label>
                    </div>
                  ))
                )}
              </div>
              {authorizedTeamIds.length > 0 && (
                <p className="text-xs text-blue-600">
                  ✓ {authorizedTeamIds.length} equipe(s) autorizada(s)
                </p>
              )}
            </div>
          </div>

          {(authorizedTechnicianIds.length === 0 && authorizedTeamIds.length === 0) && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md">
              <p className="text-sm text-amber-800">
                ⚠️ <strong>Atenção:</strong> Nenhum prestador autorizado. Este veículo não aparecerá na tela de prestadores.
              </p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-base font-medium">
              Responsável pelo Veículo * (compatibilidade)
            </Label>
            <p className="text-sm text-gray-600">
              Selecione um técnico individual ou uma equipe (campo mantido por compatibilidade)
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
                      // SEMPRE mostrar o técnico atualmente selecionado no formulário
                      if (currentTechnicianId && Number(currentTechnicianId) === t.id) return true;

                      // Filtrar técnicos ativos
                      if (!t.isActive) return false;

                      // Se estiver editando, permitir o técnico original do veículo
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
              {(form.formState.errors.teamId || form.formState.errors.technicianId) && (
                <p className="text-sm text-red-600 mt-1">
                  {(form.formState.errors.teamId || form.formState.errors.technicianId)?.message}
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


