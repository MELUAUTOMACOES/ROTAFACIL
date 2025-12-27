import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger, DialogHeader } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import VehicleForm from "@/components/forms/VehicleForm";
import VehicleMaintenanceForm from "@/components/forms/VehicleMaintenanceForm";
import { Plus, Car, Calendar, User, Users, Edit, Trash2, Wrench, FileText, ClipboardCheck, Search, Search as SelectIcon, Fuel } from "lucide-react";
import type { Vehicle, Technician, Team, VehicleMaintenance } from "@shared/schema";
import VehicleChecklistAuditTab from "@/components/vehicles/VehicleChecklistAuditTab";
import FuelConsumptionTab from "@/components/vehicles/FuelConsumptionTab";


export default function Vehicles() {
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("veiculos");
  const [isMaintenanceFormOpen, setIsMaintenanceFormOpen] = useState(false);
  const [selectedVehicleForMaintenance, setSelectedVehicleForMaintenance] = useState<Vehicle | null>(null);
  const [selectedMaintenance, setSelectedMaintenance] = useState<VehicleMaintenance | null>(null);
  const [initialFormTab, setInitialFormTab] = useState("dados");

  // Estados de filtro
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [vehicleResponsibility, setVehicleResponsibility] = useState<"all" | "assigned" | "unassigned">("all");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Ler hash e query params da URL
  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ["/api/vehicles"],
    queryFn: async () => {
      const response = await fetch("/api/vehicles", {
        headers: getAuthHeaders(),
      });
      return response.json();
    },
  });

  const { data: technicians = [], isLoading: isLoadingTechs } = useQuery({
    queryKey: ["/api/technicians"],
    queryFn: async () => {
      const response = await fetch("/api/technicians", {
        headers: getAuthHeaders(),
      });
      return response.json();
    },
  });

  const { data: teams = [], isLoading: isLoadingTeams } = useQuery({
    queryKey: ["/api/teams"],
    queryFn: async () => {
      const response = await fetch("/api/teams", {
        headers: getAuthHeaders(),
      });
      return response.json();
    },
  });

  // Ler hash e query params da URL
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash === "checklist") {
      setActiveTab("checklist");
    } else if (hash === "manutencao") {
      setActiveTab("manutencao");
    }

    // Verificar query params para abrir modal específico
    const params = new URLSearchParams(window.location.search);
    const openId = params.get("openId");
    const tabParam = params.get("tab");

    if (openId && vehicles.length > 0) {
      const vehicleToOpen = vehicles.find((v: Vehicle) => v.id.toString() === openId);
      if (vehicleToOpen) {
        setSelectedVehicle(vehicleToOpen);
        if (tabParam) {
          setInitialFormTab(tabParam);
        }
        setIsFormOpen(true);
        // Limpar URL para não reabrir ao atualizar
        const newUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, document.title, newUrl);
      }
    }
  }, [vehicles]);

  const getTechnician = (technicianId: number | null) => {
    if (!technicianId) return null;
    return technicians.find((t: Technician) => t.id === technicianId);
  };

  const getTeam = (teamId: number | null) => {
    if (!teamId) return null;
    return teams.find((t: Team) => t.id === teamId);
  };

  // Filtragem de veículos
  const filteredVehicles = vehicles.filter((vehicle: Vehicle) => {
    // Filtro de texto (Placa, Marca, Modelo)
    const searchLower = vehicleSearch.toLowerCase();
    const matchesSearch =
      !vehicleSearch ||
      vehicle.plate.toLowerCase().includes(searchLower) ||
      vehicle.brand.toLowerCase().includes(searchLower) ||
      vehicle.model.toLowerCase().includes(searchLower);

    // Filtro de responsabilidade
    const hasAssignment = vehicle.technicianId || vehicle.teamId;
    const matchesResponsibility =
      vehicleResponsibility === "all" ||
      (vehicleResponsibility === "assigned" && hasAssignment) ||
      (vehicleResponsibility === "unassigned" && !hasAssignment);

    return matchesSearch && matchesResponsibility;
  }).sort((a: Vehicle, b: Vehicle) => a.id - b.id);

  const deleteVehicleMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/vehicles/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      toast({
        title: "Sucesso",
        description: "Veículo excluído com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir veículo",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setInitialFormTab("dados");
    setIsFormOpen(true);
  };

  const handleDelete = async (vehicle: Vehicle) => {
    if (confirm(`Tem certeza que deseja excluir o veículo "${vehicle.plate}"?`)) {
      deleteVehicleMutation.mutate(vehicle.id);
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setSelectedVehicle(null);
    setInitialFormTab("dados"); // Resetar tab inicial
  };

  if (isLoading || isLoadingTechs || isLoadingTeams) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-burnt-yellow"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Veículos</h1>
          <p className="text-gray-600">Gerencie a frota de veículos da empresa</p>
        </div>

        <div className="flex space-x-2">
          {activeTab === "veiculos" && (
            <Button
              className="bg-burnt-yellow hover:bg-burnt-yellow-dark text-white"
              onClick={() => {
                setSelectedVehicle(null);
                setInitialFormTab("dados");
                setIsFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Veículo
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-3xl">
          <TabsTrigger value="veiculos" className="flex items-center">
            <Car className="h-4 w-4 mr-2" />
            Veículos
          </TabsTrigger>
          <TabsTrigger value="manutencao" className="flex items-center">
            <Wrench className="h-4 w-4 mr-2" />
            Manutenção
          </TabsTrigger>
          <TabsTrigger value="checklist" className="flex items-center">
            <ClipboardCheck className="h-4 w-4 mr-2" />
            Checklist Auditoria
          </TabsTrigger>
          <TabsTrigger value="consumo" className="flex items-center">
            <Fuel className="h-4 w-4 mr-2" />
            Consumo
          </TabsTrigger>
        </TabsList>

        {/* Tab: Veículos */}
        <TabsContent value="veiculos" className="mt-4 space-y-4">

          {/* Filtros de Veículos */}
          <Card className="p-4 bg-white">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <SelectIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por placa, marca ou modelo..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-burnt-yellow focus:border-transparent"
                  value={vehicleSearch}
                  onChange={(e) => setVehicleSearch(e.target.value)}
                />
              </div>
              <div className="w-full md:w-48">
                <select
                  className="w-full h-full p-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-burnt-yellow focus:border-transparent bg-white"
                  value={vehicleResponsibility}
                  onChange={(e) => setVehicleResponsibility(e.target.value as any)}
                >
                  <option value="all">Todos os veículos</option>
                  <option value="assigned">Com Responsável</option>
                  <option value="unassigned">Sem Responsável</option>
                </select>
              </div>
            </div>
          </Card>

          {filteredVehicles.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Car className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {vehicleSearch || vehicleResponsibility !== 'all' ? "Nenhum veículo encontrado" : "Nenhum veículo cadastrado"}
                </h3>
                <p className="text-gray-600 text-center mb-6">
                  {vehicleSearch || vehicleResponsibility !== 'all'
                    ? "Tente ajustar os filtros de busca."
                    : "Adicione veículos à sua frota para otimizar os atendimentos técnicos."}
                </p>
                {!vehicleSearch && vehicleResponsibility === 'all' && (
                  <Button
                    className="bg-burnt-yellow hover:bg-burnt-yellow-dark text-white"
                    onClick={() => {
                      setSelectedVehicle(null);
                      setInitialFormTab("dados");
                      setIsFormOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Primeiro Veículo
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredVehicles.map((vehicle: Vehicle) => {
                const assignedTechnician = getTechnician(vehicle.technicianId);
                const assignedTeam = getTeam(vehicle.teamId);
                const hasAssignment = assignedTechnician || assignedTeam;

                return (
                  <Card key={vehicle.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="border-b border-gray-100">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{vehicle.plate}</CardTitle>
                        <div className="flex space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedVehicleForMaintenance(vehicle);
                              setActiveTab("manutencao");
                            }}
                            title="Ver Manutenções"
                          >
                            <Wrench className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(vehicle)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(vehicle)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <Badge className={hasAssignment ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                        {hasAssignment ? "Atribuído" : "Sem Responsável"}
                      </Badge>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="space-y-3">
                        <div className="text-lg font-medium text-gray-900">
                          {vehicle.brand} {vehicle.model}
                        </div>

                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <Calendar className="h-4 w-4" />
                          <span>Ano: {vehicle.year}</span>
                        </div>

                        {assignedTechnician && (
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <User className="h-4 w-4" />
                            <span>Técnico: {assignedTechnician.name}</span>
                          </div>
                        )}

                        {assignedTeam && (
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <Users className="h-4 w-4" />
                            <span>Equipe: {assignedTeam.name}</span>
                          </div>
                        )}

                        {!hasAssignment && (
                          <div className="flex items-center space-x-2 text-sm text-red-600">
                            <User className="h-4 w-4" />
                            <span>Nenhum responsável atribuído</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <p className="text-xs text-gray-500">
                          Cadastrado em {new Date(vehicle.createdAt).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Tab: Manutenção */}
        <TabsContent value="manutencao" className="mt-4">
          <MaintenanceTab
            vehicles={vehicles}
            selectedVehicle={selectedVehicleForMaintenance}
            onSelectVehicle={setSelectedVehicleForMaintenance}
            onNewMaintenance={() => {
              setSelectedMaintenance(null);
              setIsMaintenanceFormOpen(true);
            }}
            onEditMaintenance={(maintenance: VehicleMaintenance) => {
              setSelectedMaintenance(maintenance);
              setIsMaintenanceFormOpen(true);
            }}
          />
        </TabsContent>

        {/* Tab: Checklist Auditoria */}
        {/* Tab: Checklist Auditoria */}
        <TabsContent value="checklist" className="mt-4">
          <VehicleChecklistAuditTab />
        </TabsContent>

        {/* Tab: Consumo */}
        <TabsContent value="consumo" className="mt-4">
          <FuelConsumptionTab vehicles={vehicles} />
        </TabsContent>
      </Tabs>

      {/* Dialog para Formulário de Veículo */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl">
          <VehicleForm
            key={selectedVehicle?.id || 'new'}
            vehicle={selectedVehicle}
            technicians={technicians}
            teams={teams}
            vehicles={vehicles}
            onClose={handleFormClose}
            initialTab={initialFormTab}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog para Formulário de Manutenção */}
      <Dialog open={isMaintenanceFormOpen} onOpenChange={setIsMaintenanceFormOpen}>
        <DialogContent className="max-w-3xl max-h-[95vh] flex flex-col p-0">
          <div className="overflow-y-auto p-6">
            <VehicleMaintenanceForm
              vehicleId={selectedVehicleForMaintenance?.id}
              vehiclePlate={selectedVehicleForMaintenance?.plate}
              vehicles={vehicles}
              maintenance={selectedMaintenance}
              onClose={() => {
                setIsMaintenanceFormOpen(false);
                setSelectedMaintenance(null);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Componente para a aba de manutenção
function MaintenanceTab({
  vehicles,
  selectedVehicle,
  onSelectVehicle,
  onNewMaintenance,
  onEditMaintenance,
}: {
  vehicles: Vehicle[];
  selectedVehicle: Vehicle | null;
  onSelectVehicle: (vehicle: Vehicle | null) => void;
  onNewMaintenance: () => void;
  onEditMaintenance: (maintenance: VehicleMaintenance) => void;
}) {
  const [filters, setFilters] = useState({
    vehicleId: "",
    status: "all",
    maintenanceType: "all",
    category: "all",
    idSearch: "",
  });

  // Buscar TODAS as manutenções do usuário
  const { data: allMaintenances = [], isLoading } = useQuery<VehicleMaintenance[]>({
    queryKey: ["/api/vehicle-maintenances"],
    queryFn: async () => {
      const response = await fetch("/api/vehicle-maintenances", {
        headers: getAuthHeaders(),
      });
      return response.json();
    },
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/vehicle-maintenances/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicle-maintenances"] });
      toast({ title: "Sucesso", description: "Manutenção excluída com sucesso" });
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const handleDelete = (maintenance: VehicleMaintenance) => {
    if (confirm("Tem certeza que deseja excluir esta manutenção?")) {
      deleteMutation.mutate(maintenance.id);
    }
  };

  const MAINTENANCE_CATEGORIES: Record<string, string> = {
    motor: "Motor",
    suspensao: "Suspensão",
    freios: "Freios",
    eletrica: "Elétrica",
    pneus: "Pneus",
    documentacao: "Documentação",
    funilaria_pintura: "Funilaria/Pintura",
  };

  const MAINTENANCE_TYPES: Record<string, { label: string; color: string }> = {
    preventiva: { label: "Preventiva", color: "bg-blue-100 text-blue-800" },
    corretiva: { label: "Corretiva", color: "bg-yellow-100 text-yellow-800" },
    urgente: { label: "Urgente", color: "bg-red-100 text-red-800" },
    revisao: { label: "Revisão", color: "bg-green-100 text-green-800" },
  };

  // Filtrar manutenções
  const filteredMaintenances = allMaintenances.filter((m: any) => {
    if (filters.vehicleId && m.vehicleId !== parseInt(filters.vehicleId)) return false;
    if (filters.status !== "all" && m.status !== filters.status) return false;
    if (filters.maintenanceType !== "all" && m.maintenanceType !== filters.maintenanceType) return false;
    if (filters.category !== "all" && m.category !== filters.category) return false;
    if (filters.idSearch && !m.id.toString().includes(filters.idSearch)) return false;
    return true;
  });

  // Ordenar: agendadas primeiro (por data), depois concluídas (por data mais recente)
  const sortedMaintenances = [...filteredMaintenances].sort((a: any, b: any) => {
    if (a.status === "agendada" && b.status !== "agendada") return -1;
    if (a.status !== "agendada" && b.status === "agendada") return 1;
    if (a.status === "agendada" && b.status === "agendada") {
      return new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime();
    }
    return new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime();
  });

  const getVehicle = (vehicleId: number) => vehicles.find((v) => v.id === vehicleId);

  const hasFilters = filters.vehicleId || filters.status !== "all" || filters.maintenanceType !== "all" || filters.category !== "all" || filters.idSearch;

  return (
    <div className="space-y-4">
      {/* Barra de Filtros */}
      <Card className="p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-32">
            <Label htmlFor="filter-id" className="text-xs">Buscar por ID</Label>
            <div className="relative mt-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                id="filter-id"
                className="pl-9 h-9"
                placeholder="Ex: 123"
                value={filters.idSearch}
                onChange={(e) => setFilters({ ...filters, idSearch: e.target.value })}
              />
            </div>
          </div>

          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filter-vehicle" className="text-xs">Veículo</Label>
            <select
              id="filter-vehicle"
              className="w-full mt-1 rounded-md border border-gray-300 px-2 h-9 text-sm focus:border-burnt-yellow focus:outline-none bg-white"
              value={filters.vehicleId}
              onChange={(e) => setFilters({ ...filters, vehicleId: e.target.value })}
            >
              <option value="">Todos os veículos</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id.toString()}>
                  {v.plate} - {v.brand} {v.model}
                </option>
              ))}
            </select>
          </div>

          <div className="w-32">
            <Label htmlFor="filter-status" className="text-xs">Status</Label>
            <select
              id="filter-status"
              className="w-full mt-1 rounded-md border border-gray-300 px-2 h-9 text-sm focus:border-burnt-yellow focus:outline-none bg-white"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="all">Todos</option>
              <option value="agendada">Agendada</option>
              <option value="concluida">Concluída</option>
            </select>
          </div>

          <div className="w-32">
            <Label htmlFor="filter-type" className="text-xs">Tipo</Label>
            <select
              id="filter-type"
              className="w-full mt-1 rounded-md border border-gray-300 px-2 h-9 text-sm focus:border-burnt-yellow focus:outline-none bg-white"
              value={filters.maintenanceType}
              onChange={(e) => setFilters({ ...filters, maintenanceType: e.target.value })}
            >
              <option value="all">Todos</option>
              <option value="preventiva">Preventiva</option>
              <option value="corretiva">Corretiva</option>
              <option value="urgente">Urgente</option>
              <option value="revisao">Revisão</option>
            </select>
          </div>

          <div className="w-40">
            <Label htmlFor="filter-category" className="text-xs">Categoria</Label>
            <select
              id="filter-category"
              className="w-full mt-1 rounded-md border border-gray-300 px-2 h-9 text-sm focus:border-burnt-yellow focus:outline-none bg-white"
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            >
              <option value="all">Todas</option>
              {Object.entries(MAINTENANCE_CATEGORIES).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 min-w-fit">
            {hasFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilters({ vehicleId: "", status: "all", maintenanceType: "all", category: "all", idSearch: "" })}
              >
                Limpar
              </Button>
            )}
            <Button
              size="sm"
              className="bg-burnt-yellow hover:bg-burnt-yellow-dark text-white whitespace-nowrap"
              onClick={() => {
                if (filters.vehicleId) {
                  const v = vehicles.find((v) => v.id.toString() === filters.vehicleId);
                  if (v) onSelectVehicle(v);
                }
                onNewMaintenance();
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova Manutenção
            </Button>
          </div>
        </div>
      </Card>

      {/* Lista de manutenções */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-burnt-yellow"></div>
        </div>
      ) : sortedMaintenances.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Wrench className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {hasFilters ? "Nenhuma manutenção encontrada com esses filtros" : "Nenhuma manutenção registrada"}
            </h3>
            <p className="text-gray-600">
              {hasFilters ? "Tente ajustar os filtros" : "Cadastre a primeira manutenção clicando no botão acima"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedMaintenances.map((maintenance: any) => {
            const vehicle = getVehicle(maintenance.vehicleId);
            const isAgendada = maintenance.status === "agendada";

            return (
              <Card key={maintenance.id} className={isAgendada ? "border-blue-300 border-2" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      {/* ID e Status */}
                      <div className="flex items-center space-x-2 flex-wrap gap-2">
                        <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                          #{maintenance.id}
                        </span>
                        <Badge className={isAgendada ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"}>
                          {isAgendada ? "📅 Agendada" : "✅ Concluída"}
                        </Badge>
                        <Badge className={MAINTENANCE_TYPES[maintenance.maintenanceType]?.color || "bg-gray-100"}>
                          {MAINTENANCE_TYPES[maintenance.maintenanceType]?.label || maintenance.maintenanceType}
                        </Badge>
                        <Badge variant="outline">
                          {MAINTENANCE_CATEGORIES[maintenance.category] || maintenance.category}
                        </Badge>
                      </div>

                      {/* Veículo */}
                      {vehicle && (
                        <p className="text-sm font-medium text-gray-700">
                          🚗 {vehicle.plate} - {vehicle.brand} {vehicle.model}
                        </p>
                      )}

                      {/* Descrição */}
                      <p className="font-medium">{maintenance.description}</p>

                      {/* Detalhes */}
                      <div className="flex items-center flex-wrap gap-4 text-sm text-gray-500">
                        <span>📍 {maintenance.workshop}</span>
                        <span>🔧 {maintenance.vehicleKm?.toLocaleString() || 0} km</span>
                        {isAgendada && maintenance.scheduledDate && (
                          <span className="text-blue-600 font-medium">
                            📅 Agendada: {new Date(maintenance.scheduledDate).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                        {!isAgendada && (
                          <span>📅 {new Date(maintenance.entryDate).toLocaleDateString("pt-BR")}</span>
                        )}
                      </div>

                      {/* Custo */}
                      {parseFloat(String(maintenance.totalCost || 0)) > 0 && (
                        <p className="text-sm font-medium text-green-600">
                          💰 R$ {parseFloat(String(maintenance.totalCost)).toFixed(2)}
                        </p>
                      )}
                    </div>

                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const v = vehicles.find((v) => v.id === maintenance.vehicleId);
                          if (v) onSelectVehicle(v);
                          onEditMaintenance(maintenance);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(maintenance)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
