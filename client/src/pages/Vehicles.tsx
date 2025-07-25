import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import VehicleForm from "@/components/forms/VehicleForm";
import { Plus, Car, Calendar, User, Users, Edit, Trash2 } from "lucide-react";
import type { Vehicle, Technician, Team } from "@shared/schema";

export default function Vehicles() {
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ["/api/vehicles"],
    queryFn: async () => {
      const response = await fetch("/api/vehicles", {
        headers: getAuthHeaders(),
      });
      return response.json();
    },
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ["/api/technicians"],
    queryFn: async () => {
      const response = await fetch("/api/technicians", {
        headers: getAuthHeaders(),
      });
      return response.json();
    },
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["/api/teams"],
    queryFn: async () => {
      const response = await fetch("/api/teams", {
        headers: getAuthHeaders(),
      });
      return response.json();
    },
  });

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
  };

  const getTechnician = (technicianId: number | null) => {
    if (!technicianId) return null;
    return technicians.find((t: Technician) => t.id === technicianId);
  };

  const getTeam = (teamId: number | null) => {
    if (!teamId) return null;
    return teams.find((t: Team) => t.id === teamId);
  };

  if (isLoading) {
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
        
        <Button 
          className="bg-burnt-yellow hover:bg-burnt-yellow-dark text-white"
          onClick={() => {
            setSelectedVehicle(null);
            setIsFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Veículo
        </Button>
      </div>

      {/* Vehicles List */}
      {vehicles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Car className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum veículo cadastrado</h3>
            <p className="text-gray-600 text-center mb-6">
              Adicione veículos à sua frota para otimizar os atendimentos técnicos.
            </p>
            <Button 
              className="bg-burnt-yellow hover:bg-burnt-yellow-dark text-white"
              onClick={() => {
                setSelectedVehicle(null);
                setIsFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Primeiro Veículo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {vehicles.map((vehicle: Vehicle) => {
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
      
      {/* Centralized Dialog for All Vehicle Forms */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <VehicleForm
            vehicle={selectedVehicle}
            technicians={technicians}
            teams={teams}
            onClose={handleFormClose}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
