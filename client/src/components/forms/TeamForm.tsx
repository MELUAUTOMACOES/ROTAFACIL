import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { insertTeamSchema, type InsertTeam, type Team, type Technician, type Service } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, UserPlus } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface TeamFormProps {
  team?: Team | null;
  technicians: Technician[];
  services: Service[];
  onClose: () => void;
}

// Estender o schema base para incluir os campos adicionais do formulário
const extendedTeamSchema = insertTeamSchema.extend({
  technicianIds: insertTeamSchema.shape.name.array().optional(),
  serviceIds: insertTeamSchema.shape.name.array().optional(),
});

type ExtendedTeamForm = {
  name: string;
  technicianIds?: number[];
  serviceIds?: number[];
};

export default function TeamForm({ 
  team, 
  technicians, 
  services, 
  onClose 
}: TeamFormProps) {
  const [selectedTechnicians, setSelectedTechnicians] = useState<number[]>([]);
  const [selectedServices, setSelectedServices] = useState<number[]>(
    team?.serviceIds ? team.serviceIds.map(id => parseInt(id)) : []
  );
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Buscar membros da equipe quando editando uma equipe existente
  const { data: teamMembers = [] } = useQuery({
    queryKey: ["/api/team-members", team?.id],
    queryFn: async () => {
      if (!team) return [];
      const response = await fetch(`/api/team-members/${team.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!team,
  });

  const form = useForm<ExtendedTeamForm>({
    resolver: zodResolver(extendedTeamSchema),
    defaultValues: {
      name: "",
      technicianIds: [],
      serviceIds: [],
    },
  });

  // Resetar o formulário quando a equipe muda ou quando abre para nova equipe
  useEffect(() => {
    console.log('🔄 useEffect - team mudou:', team);
    if (team && team.id) {
      console.log('📝 Carregando dados da equipe para edição:', team);
      // Edição: carregar dados da equipe existente
      const serviceIds = team.serviceIds ? team.serviceIds.map(id => parseInt(id)) : [];
      
      form.reset({
        name: team.name || "",
        technicianIds: selectedTechnicians,
        serviceIds: serviceIds,
      });
      
      setSelectedServices(serviceIds);
      console.log('✅ Formulário resetado para edição com dados:', {
        name: team.name,
        serviceIds: serviceIds
      });
    } else {
      console.log('➕ Limpando formulário para nova equipe');
      // Nova equipe: limpar formulário
      form.reset({
        name: "",
        technicianIds: [],
        serviceIds: [],
      });
      setSelectedTechnicians([]);
      setSelectedServices([]);
      console.log('✅ Formulário limpo para nova equipe');
    }
  }, [team, form]);

  // Atualizar técnicos selecionados quando os membros da equipe são carregados
  useEffect(() => {
    if (team && teamMembers.length > 0) {
      const technicianIds = teamMembers.map((member: any) => member.technicianId);
      setSelectedTechnicians(technicianIds);
      form.setValue('technicianIds', technicianIds);
    }
  }, [teamMembers, form]);

  const createTeamMutation = useMutation({
    mutationFn: async (data: ExtendedTeamForm) => {
      // Primeiro criar a equipe
      const teamData = {
        name: data.name,
        serviceIds: data.serviceIds?.map(id => id.toString()) || [],
      };
      
      const response = await apiRequest("POST", "/api/teams", teamData);
      const newTeam = await response.json();
      
      // Depois adicionar os membros da equipe
      if (data.technicianIds && data.technicianIds.length > 0) {
        await Promise.all(
          data.technicianIds.map(technicianId =>
            apiRequest("POST", "/api/team-members", {
              teamId: newTeam.id,
              technicianId,
            })
          )
        );
      }
      
      return newTeam;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
      toast({
        title: "Sucesso",
        description: "Equipe criada com sucesso",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar equipe",
        variant: "destructive",
      });
    },
  });

  const updateTeamMutation = useMutation({
    mutationFn: async (data: ExtendedTeamForm) => {
      // Primeiro atualizar dados da equipe
      const teamData = {
        name: data.name,
        serviceIds: data.serviceIds?.map(id => id.toString()) || [],
      };
      
      const response = await apiRequest("PUT", `/api/teams/${team?.id}`, teamData);
      const updatedTeam = await response.json();
      
      // Remover todos os membros existentes da equipe
      const currentMembers = await fetch(`/api/team-members/${team?.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (currentMembers.ok) {
        const members = await currentMembers.json();
        
        if (members.length > 0) {
          await Promise.all(
            members.map((member: any) => 
              apiRequest("DELETE", `/api/team-members/${member.id}`)
            )
          );
        }
      }
      
      // Adicionar os novos membros selecionados
      if (data.technicianIds && data.technicianIds.length > 0) {
        await Promise.all(
          data.technicianIds.map(technicianId =>
            apiRequest("POST", "/api/team-members", {
              teamId: team?.id,
              technicianId,
            })
          )
        );
      }
      
      return updatedTeam;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
      toast({
        title: "Sucesso",
        description: "Equipe atualizada com sucesso",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar equipe",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ExtendedTeamForm) => {
    const formData = {
      ...data,
      technicianIds: selectedTechnicians,
      serviceIds: selectedServices,
    };
    
    if (team) {
      updateTeamMutation.mutate(formData);
    } else {
      createTeamMutation.mutate(formData);
    }
  };

  const isLoading = createTeamMutation.isPending || updateTeamMutation.isPending;

  const handleTechnicianToggle = (technicianId: number, checked: boolean) => {
    if (checked) {
      setSelectedTechnicians(prev => [...prev, technicianId]);
    } else {
      setSelectedTechnicians(prev => prev.filter(id => id !== technicianId));
    }
  };

  const handleServiceToggle = (serviceId: number, checked: boolean) => {
    if (checked) {
      setSelectedServices(prev => [...prev, serviceId]);
    } else {
      setSelectedServices(prev => prev.filter(id => id !== serviceId));
    }
  };

  return (
    <div className="max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          {team ? "Editar Equipe" : "Cadastrar Nova Equipe"}
        </DialogTitle>
      </DialogHeader>

      <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) => {
              console.log("🛎️ onSubmit disparado COM CERTEZA!", { team, data });
              onSubmit(data);
            })}
            className="space-y-6"
          >

          {/* Nome da Equipe */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome da Equipe *</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Equipe Alpha" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Seleção de Técnicos */}
          <div className="space-y-3">
            <FormLabel>Técnicos da Equipe</FormLabel>
            <div className="border rounded-lg p-4 max-h-48 overflow-y-auto">
              {technicians.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  Nenhum técnico cadastrado. Cadastre técnicos primeiro para formar equipes.
                </p>
              ) : (
                <div className="space-y-2">
                  {technicians.map((technician) => (
                    <div key={technician.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`technician-${technician.id}`}
                        checked={selectedTechnicians.includes(technician.id)}
                        onCheckedChange={(checked) => 
                          handleTechnicianToggle(technician.id, checked as boolean)
                        }
                      />
                      <label
                        htmlFor={`technician-${technician.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {technician.name}
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selectedTechnicians.length > 0 && (
              <p className="text-xs text-gray-500">
                {selectedTechnicians.length} técnico(s) selecionado(s)
              </p>
            )}
          </div>

          {/* Seleção de Serviços */}
          <div className="space-y-3">
            <FormLabel>Tipos de Serviços que a Equipe Atende</FormLabel>
            <div className="border rounded-lg p-4 max-h-48 overflow-y-auto">
              {services.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  Nenhum serviço cadastrado. Cadastre serviços primeiro para vincular às equipes.
                </p>
              ) : (
                <div className="space-y-2">
                  {services.map((service) => (
                    <div key={service.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`service-${service.id}`}
                        checked={selectedServices.includes(service.id)}
                        onCheckedChange={(checked) => 
                          handleServiceToggle(service.id, checked as boolean)
                        }
                      />
                      <label
                        htmlFor={`service-${service.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {service.name}
                        {service.price && (
                          <span className="text-xs text-gray-500 ml-2">
                            (R$ {Number(service.price).toFixed(2)})
                          </span>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selectedServices.length > 0 && (
              <p className="text-xs text-gray-500">
                {selectedServices.length} serviço(s) selecionado(s)
              </p>
            )}
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button 
              type="submit"
              // CORREÇÃO: Disabled dividido para modos criação/edição
              // Em modo edição (team existe): usar somente updateTeamMutation.isPending
              // Em modo criação (team não existe): usar somente createTeamMutation.isPending
              // disabled={ team ? updateTeamMutation.isPending : createTeamMutation.isPending }
              className="bg-burnt-yellow hover:bg-burnt-yellow-dark text-white"
            >
              {(team ? updateTeamMutation.isPending : createTeamMutation.isPending) ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {team ? "Atualizando..." : "Criando..."}
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  {team ? "Atualizar Equipe" : "Criar Equipe"}
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}