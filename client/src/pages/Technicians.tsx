import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import TechnicianForm from "@/components/forms/TechnicianForm";
import { Plus, UserCog, Mail, Phone, Wrench, Edit, Trash2, CheckCircle, XCircle } from "lucide-react";
import type { Technician } from "@shared/schema";

export default function Technicians() {
  const [selectedTechnician, setSelectedTechnician] = useState<Technician | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: technicians = [], isLoading } = useQuery({
    queryKey: ["/api/technicians"],
    queryFn: async () => {
      const response = await fetch("/api/technicians", {
        headers: getAuthHeaders(),
      });
      return response.json();
    },
  });

  const deleteTechnicianMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/technicians/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/technicians"] });
      toast({
        title: "Sucesso",
        description: "Técnico excluído com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir técnico",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (technician: Technician) => {
    setSelectedTechnician(technician);
    setIsFormOpen(true);
  };

  const handleDelete = async (technician: Technician) => {
    if (confirm(`Tem certeza que deseja excluir o técnico "${technician.name}"?`)) {
      deleteTechnicianMutation.mutate(technician.id);
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setSelectedTechnician(null);
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
          <h1 className="text-2xl font-bold text-gray-900">Técnicos</h1>
          <p className="text-gray-600">Gerencie sua equipe técnica</p>
        </div>
        
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button className="bg-burnt-yellow hover:bg-burnt-yellow-dark text-white">
              <Plus className="h-4 w-4 mr-2" />
              Novo Técnico
            </Button>
          </DialogTrigger>
          <DialogContent>
            <TechnicianForm
              technician={selectedTechnician}
              onClose={handleFormClose}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Technicians List */}
      {technicians.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <UserCog className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum técnico cadastrado</h3>
            <p className="text-gray-600 text-center mb-6">
              Comece adicionando técnicos à sua equipe para realizar os atendimentos.
            </p>
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
              <DialogTrigger asChild>
                <Button className="bg-burnt-yellow hover:bg-burnt-yellow-dark text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Primeiro Técnico
                </Button>
              </DialogTrigger>
              <DialogContent>
                <TechnicianForm
                  technician={selectedTechnician}
                  onClose={handleFormClose}
                />
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {technicians.map((technician: Technician) => (
            <Card key={technician.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center">
                    {technician.name}
                    {technician.isActive ? (
                      <CheckCircle className="h-4 w-4 text-green-600 ml-2" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600 ml-2" />
                    )}
                  </CardTitle>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(technician)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(technician)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Badge 
                  className={
                    technician.isActive 
                      ? "bg-green-100 text-green-800" 
                      : "bg-red-100 text-red-800"
                  }
                >
                  {technician.isActive ? "Ativo" : "Inativo"}
                </Badge>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {technician.email && (
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Mail className="h-4 w-4" />
                      <span>{technician.email}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Phone className="h-4 w-4" />
                    <span>{technician.phone}</span>
                  </div>
                  
                  {technician.specialization && (
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Wrench className="h-4 w-4" />
                      <span>{technician.specialization}</span>
                    </div>
                  )}
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    Cadastrado em {new Date(technician.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
