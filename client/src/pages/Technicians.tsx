import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import TechnicianForm from "@/components/forms/TechnicianForm";
import TempTeamForm from "@/components/forms/TempTeamForm";
import { Plus, UserCog, Mail, Phone, Wrench, Edit, Trash2, CheckCircle, XCircle, Users } from "lucide-react";
import type { Technician, Team, Service } from "@shared/schema";

export default function Technicians() {
  const [selectedTechnician, setSelectedTechnician] = useState<Technician | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [isTechnicianFormOpen, setIsTechnicianFormOpen] = useState(false);
  const [isTeamFormOpen, setIsTeamFormOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Queries para técnicos
  const { data: technicians = [], isLoading: techniciansLoading } = useQuery({
    queryKey: ["/api/technicians"],
    queryFn: async () => {
      const response = await fetch("/api/technicians", {
        headers: getAuthHeaders(),
      });
      return response.json();
    },
  });

  // Queries para equipes
  const { data: teams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ["/api/teams"],
    queryFn: async () => {
      const response = await fetch("/api/teams", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error('Erro ao carregar equipes');
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
  });

  // Query para serviços (necessário para formulários)
  const { data: services = [], isLoading: servicesLoading } = useQuery({
    queryKey: ["/api/services"],
    queryFn: async () => {
      const response = await fetch("/api/services", {
        headers: getAuthHeaders(),
      });
      return response.json();
    },
  });

  // Query para buscar membros de todas as equipes
  const { data: allTeamMembers = [] } = useQuery({
    queryKey: ["/api/all-team-members"],
    queryFn: async () => {
      if (teams.length === 0) return [];
      
      const memberPromises = teams.map(async (team: Team) => {
        const response = await fetch(`/api/team-members/${team.id}`, {
          headers: getAuthHeaders(),
        });
        if (!response.ok) return [];
        const members = await response.json();
        return members.map((member: any) => ({ ...member, teamId: team.id }));
      });
      
      const allMembers = await Promise.all(memberPromises);
      return allMembers.flat();
    },
    enabled: teams.length > 0,
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

  const deleteTeamMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/teams/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/all-team-members"] });
      toast({
        title: "Sucesso",
        description: "Equipe excluída com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir equipe",
        variant: "destructive",
      });
    },
  });

  const handleEditTechnician = (technician: Technician) => {
    console.log('✏️ Technicians - Editando técnico:', technician);
    setSelectedTechnician(technician);
    setIsTechnicianFormOpen(true);
  };

  // Função para garantir que o formulário de novo técnico sempre abra em branco
  const handleNewTechnician = () => {
    setSelectedTechnician(null); // Limpar técnico selecionado
    setIsTechnicianFormOpen(true);
  };

  const handleEditTeam = (team: Team) => {
    console.log('🖊️ EDITANDO EQUIPE - handleEditTeam chamado:', team);
    setSelectedTeam(team);
    setIsTeamFormOpen(true);
    console.log('✅ Estado atualizado - selectedTeam definido e dialog aberto');
  };

  const handleDeleteTechnician = async (technician: Technician) => {
    if (confirm(`Tem certeza que deseja excluir o técnico "${technician.name}"?`)) {
      deleteTechnicianMutation.mutate(technician.id);
    }
  };

  const handleDeleteTeam = async (team: Team) => {
    if (confirm(`Tem certeza que deseja excluir a equipe "${team.name}"?`)) {
      deleteTeamMutation.mutate(team.id);
    }
  };

  const handleTechnicianFormClose = () => {
    console.log('🚪 Technicians - Iniciando fechamento do formulário de técnico');
    console.log('🔍 Technicians - Estado atual:', { 
      isTechnicianFormOpen, 
      selectedTechnician: selectedTechnician?.id || 'null' 
    });
    
    // Fechar o diálogo imediatamente para evitar conflitos DOM
    setIsTechnicianFormOpen(false);
    
    // Usar requestAnimationFrame para garantir que o DOM seja atualizado
    requestAnimationFrame(() => {
      console.log('🧹 Technicians - Limpando estado após DOM render');
      setSelectedTechnician(null);
      console.log('✅ Technicians - Formulário fechado e estado limpo com sucesso');
    });
  };

  const handleTeamFormClose = () => {
    // CORREÇÃO: Apenas fechar o dialog sem alterar state team
    // Isso evita duplicações ao cancelar enquanto o form ainda está montado
    setIsTeamFormOpen(false);
    // Nota: setSelectedTeam(null) será chamado quando o dialog for totalmente desmontado
    setTimeout(() => {
      setSelectedTeam(null);
    }, 100); // Pequeno delay para garantir que o form seja desmontado primeiro
  };

  // Função para abrir formulário de nova equipe - garante que sempre abre limpo
  const handleNewTeam = () => {
    setSelectedTeam(null); // Garantir que não há equipe selecionada
    setIsTeamFormOpen(true);
  };

  const isLoading = techniciansLoading || teamsLoading;

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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Técnicos/Equipes</h1>
        <p className="text-gray-600">Gerencie sua equipe técnica e organize equipes especializadas</p>
      </div>

      {/* Tabs para Técnicos e Equipes */}
      <Tabs defaultValue="technicians" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="technicians" className="flex items-center gap-2">
            <UserCog className="h-4 w-4" />
            Técnicos
          </TabsTrigger>
          <TabsTrigger value="teams" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Equipes
          </TabsTrigger>
        </TabsList>

        {/* Aba de Técnicos - Mantém funcionalidade existente */}
        <TabsContent value="technicians" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Técnicos Cadastrados</h2>
              <p className="text-sm text-gray-600">Gerencie os técnicos da sua empresa</p>
            </div>
            
            <Button 
              className="bg-burnt-yellow hover:bg-burnt-yellow-dark text-white"
              onClick={handleNewTechnician}
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Técnico
            </Button>
          </div>

          {/* Lista de Técnicos */}
          {technicians.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <UserCog className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum técnico cadastrado</h3>
                <p className="text-gray-600 text-center mb-6">
                  Comece adicionando técnicos à sua equipe para realizar os atendimentos.
                </p>
                <Button 
                  className="bg-burnt-yellow hover:bg-burnt-yellow-dark text-white"
                  onClick={handleNewTechnician}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Primeiro Técnico
                </Button>
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
                          onClick={() => handleEditTechnician(technician)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTechnician(technician)}
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

          {/* Diálogo Centralizado Único para Técnicos - Solução para erro DOM */}
          <Dialog open={isTechnicianFormOpen} onOpenChange={(open) => {
            console.log('🔄 Dialog Centralizado - onOpenChange chamado:', { open, selectedTechnician });
            if (!open) {
              console.log('🚪 Dialog Centralizado - Fechando diálogo');
              handleTechnicianFormClose();
            }
          }}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
              <TechnicianForm
                technician={selectedTechnician}
                services={services}
                onClose={handleTechnicianFormClose}
              />
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Aba de Equipes - Nova funcionalidade */}
        <TabsContent value="teams" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Equipes Cadastradas</h2>
              <p className="text-sm text-gray-600">Organize técnicos em equipes especializadas</p>
            </div>
            
            <Button 
              className="bg-burnt-yellow hover:bg-burnt-yellow-dark text-white"
              onClick={handleNewTeam}
            >
              <Plus className="h-4 w-4 mr-2" />
              Cadastrar Equipe
            </Button>
          </div>

          {/* Lista de Equipes */}
          {teams.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma equipe cadastrada</h3>
                <p className="text-gray-600 text-center mb-6">
                  Crie equipes especializadas para organizar melhor seus técnicos e serviços.
                </p>
                <Button 
                  className="bg-burnt-yellow hover:bg-burnt-yellow-dark text-white"
                  onClick={handleNewTeam}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeira Equipe
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {teams.map((team: Team) => (
                <Card key={team.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center">
                        <Users className="h-5 w-5 mr-2 text-burnt-yellow" />
                        {team.name}
                      </CardTitle>
                      <div className="flex space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditTeam(team)} // Corrigido: usar função que abre o diálogo principal
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTeam(team)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {/* Serviços atendidos */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Serviços Atendidos</h4>
                        {team.serviceIds && team.serviceIds.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {team.serviceIds.map((serviceId) => {
                              const service = services.find((s: any) => s.id === parseInt(serviceId));
                              return service ? (
                                <Badge key={serviceId} variant="secondary" className="text-xs">
                                  {service.name}
                                </Badge>
                              ) : null;
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">Nenhum serviço vinculado</p>
                        )}
                      </div>

                      {/* Membros da equipe */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Membros</h4>
                        {(() => {
                          const teamMembersForThisTeam = allTeamMembers.filter((member: any) => member.teamId === team.id);
                          if (teamMembersForThisTeam.length > 0) {
                            return (
                              <div className="flex flex-wrap gap-1">
                                {teamMembersForThisTeam.map((member: any) => {
                                  const technician = technicians.find((t: any) => t.id === member.technicianId);
                                  return technician ? (
                                    <Badge key={member.id} variant="outline" className="text-xs">
                                      {technician.name}
                                    </Badge>
                                  ) : null;
                                })}
                              </div>
                            );
                          } else {
                            return (
                              <p className="text-sm text-gray-500">Nenhum técnico vinculado</p>
                            );
                          }
                        })()}
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-xs text-gray-500">
                        Criada em {new Date(team.createdAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          
          {/* Centralized Dialog for All Team Forms */}
          <Dialog open={isTeamFormOpen} onOpenChange={setIsTeamFormOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
              <TempTeamForm
                team={selectedTeam || undefined}
                technicians={technicians}
                services={services}
                existingTechIds={
                  allTeamMembers
                    .filter(m => m.teamId === selectedTeam?.id)
                    .map(m => m.technicianId)
                }
                onClose={handleTeamFormClose}
              />
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}
