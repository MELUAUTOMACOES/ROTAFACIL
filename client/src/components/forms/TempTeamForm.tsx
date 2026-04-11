import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { type InsertTeam, type Team, type Technician, type Service } from "@shared/schema";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, UserPlus, MapPin, Clock as ClockIcon } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { buildApiUrl } from "@/lib/api-config";

// Função para buscar endereço por CEP - idêntica ao cadastro de técnico
async function buscarEnderecoPorCep(cep: string) {
  const url = `https://viacep.com.br/ws/${cep.replace(/\D/g, '')}/json/`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.erro) throw new Error("CEP não encontrado");
  return data; // {logradouro, bairro, localidade, uf, ...}
}

interface TeamFormProps {
  team?: Team | null;
  technicians: Technician[];
  services: Service[];
  onClose: () => void;
}

// Schema limpo e correto para o formulário de equipe
const teamFormSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  technicianIds: z.array(z.number()).optional(),
  serviceIds: z.array(z.number()).optional(),
  enderecoInicioCep: z.string().optional(),
  enderecoInicioLogradouro: z.string().optional(),
  enderecoInicioNumero: z.string().optional(),
  enderecoInicioComplemento: z.string().optional(),
  enderecoInicioBairro: z.string().optional(),
  enderecoInicioCidade: z.string().optional(),
  enderecoInicioEstado: z.string().optional(),
  // Horários de trabalho
  horarioInicioTrabalho: z.string().default("08:00"),
  horarioFimTrabalho: z.string().default("18:00"),
  horarioAlmocoMinutos: z.number().default(60),
  diasTrabalho: z.array(z.string()).default(['segunda', 'terca', 'quarta', 'quinta', 'sexta']),
});

type ExtendedTeamForm = z.infer<typeof teamFormSchema>;

export default function TeamForm({
  team,
  technicians,
  services,
  onClose
}: TeamFormProps) {
  console.log("🏗️ TempTeamForm renderizado com dados:", { team, technicians: technicians.length, services: services.length });

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
      const response = await fetch(buildApiUrl(`/api/team-members/${team.id}`), {
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
    resolver: zodResolver(teamFormSchema),
    defaultValues: {
      name: "",
      technicianIds: [],
      serviceIds: [],
      // Campos de endereço de início diário - completos
      enderecoInicioCep: "",
      enderecoInicioLogradouro: "",
      enderecoInicioNumero: "",
      enderecoInicioComplemento: "",
      enderecoInicioBairro: "",
      enderecoInicioCidade: "",
      enderecoInicioEstado: "",
      // Horários de trabalho
      horarioInicioTrabalho: "08:00",
      horarioFimTrabalho: "18:00",
      horarioAlmocoMinutos: 60,
      diasTrabalho: ['segunda', 'terca', 'quarta', 'quinta', 'sexta'],
    },
  });

  // Resetar o formulário quando a equipe muda ou quando abre para nova equipe
  useEffect(() => {
    console.log('🔄 useEffect - team mudou:', team);
    if (team && team.id) {
      console.log('📝 Carregando dados da equipe para edição:', team);
      // Edição: carregar dados da equipe existente
      const serviceIds = team.serviceIds ? team.serviceIds.map(id => Number(id)) : [];

      form.reset({
        name: team.name || "",
        technicianIds: selectedTechnicians,
        serviceIds: serviceIds,                  // number[]
        // Campos de endereço de início diário - completos
        enderecoInicioCep: team.enderecoInicioCep || "",
        enderecoInicioLogradouro: team.enderecoInicioLogradouro || "",
        enderecoInicioNumero: team.enderecoInicioNumero || "",
        enderecoInicioComplemento: team.enderecoInicioComplemento || "",
        enderecoInicioBairro: team.enderecoInicioBairro || "",
        enderecoInicioCidade: team.enderecoInicioCidade || "",
        enderecoInicioEstado: team.enderecoInicioEstado || "",
        // Horários de trabalho
        horarioInicioTrabalho: team.horarioInicioTrabalho || "08:00",
        horarioFimTrabalho: team.horarioFimTrabalho || "18:00",
        horarioAlmocoMinutos: team.horarioAlmocoMinutos || 60,
        diasTrabalho: team.diasTrabalho || ['segunda', 'terca', 'quarta', 'quinta', 'sexta'],
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
        // Campos de endereço de início diário - completos
        enderecoInicioCep: "",
        enderecoInicioLogradouro: "",
        enderecoInicioNumero: "",
        enderecoInicioComplemento: "",
        enderecoInicioBairro: "",
        enderecoInicioCidade: "",
        enderecoInicioEstado: "",
        // Horários de trabalho
        horarioInicioTrabalho: "08:00",
        horarioFimTrabalho: "18:00",
        horarioAlmocoMinutos: 60,
        diasTrabalho: ['segunda', 'terca', 'quarta', 'quinta', 'sexta'],
      });
      setSelectedTechnicians([]);
      setSelectedServices([]);
      console.log('✅ Formulário limpo para nova equipe');
    }
  }, [team?.id]);

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
      // Primeiro criar a equipe - convertendo serviceIds para string[] para o backend
      const teamData = {
        name: data.name,
        serviceIds: (data.serviceIds || []).map(id => id.toString()),
        // Campos de endereço de início diário - completos
        enderecoInicioCep: data.enderecoInicioCep || "",
        enderecoInicioLogradouro: data.enderecoInicioLogradouro || "",
        enderecoInicioNumero: data.enderecoInicioNumero || "",
        enderecoInicioComplemento: data.enderecoInicioComplemento || "",
        enderecoInicioBairro: data.enderecoInicioBairro || "",
        enderecoInicioCidade: data.enderecoInicioCidade || "",
        enderecoInicioEstado: data.enderecoInicioEstado || "",
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
      // Primeiro atualizar dados da equipe - convertendo serviceIds para string[] para o backend
      const teamData = {
        name: data.name,
        serviceIds: (data.serviceIds || []).map(id => id.toString()),
        // Campos de endereço de início diário - completos
        enderecoInicioCep: data.enderecoInicioCep || "",
        enderecoInicioLogradouro: data.enderecoInicioLogradouro || "",
        enderecoInicioNumero: data.enderecoInicioNumero || "",
        enderecoInicioComplemento: data.enderecoInicioComplemento || "",
        enderecoInicioBairro: data.enderecoInicioBairro || "",
        enderecoInicioCidade: data.enderecoInicioCidade || "",
        enderecoInicioEstado: data.enderecoInicioEstado || "",
      };

      const response = await apiRequest("PATCH", `/api/teams/${team?.id}`, teamData);
      const updatedTeam = await response.json();

      // Remover todos os membros existentes da equipe
      const currentMembers = await fetch(buildApiUrl(`/api/team-members/${team?.id}`), {
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
    console.log("🔧 onSubmit disparado!", {
      team,
      data,
      selectedTechnicians,
      selectedServices,
      formState: {
        isValid: form.formState.isValid,
        errors: form.formState.errors
      }
    });

    const formData = {
      ...data,
      technicianIds: selectedTechnicians, // number[]
      serviceIds: selectedServices,      // number[] 
    };

    console.log("📤 Dados preparados para envio (number[]):", formData);

    if (team) {
      console.log("📝 Modo EDIÇÃO - Chamando updateTeamMutation");
      updateTeamMutation.mutate(formData);
    } else {
      console.log("➕ Modo CRIAÇÃO - Chamando createTeamMutation");
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

  // Handler para busca automática de endereço de início diário por CEP
  const handleEnderecoInicioCepChange = async (cep: string) => {
    // Aplicar máscara de CEP
    const maskedCep = cep.replace(/\D/g, '').replace(/(\d{5})(\d{3})/, '$1-$2');
    form.setValue('enderecoInicioCep', maskedCep);

    // Se o CEP estiver completo (8 dígitos), buscar endereço
    if (cep.replace(/\D/g, '').length === 8) {
      try {
        const endereco = await buscarEnderecoPorCep(cep);

        // Preencher os campos automaticamente
        form.setValue('enderecoInicioLogradouro', endereco.logradouro || '');
        form.setValue('enderecoInicioBairro', endereco.bairro || '');
        form.setValue('enderecoInicioCidade', endereco.localidade || '');
        form.setValue('enderecoInicioEstado', endereco.uf || '');

        toast({
          title: "CEP encontrado",
          description: "Endereço preenchido automaticamente",
        });
      } catch (error) {
        toast({
          title: "CEP não encontrado",
          description: "Verifique o CEP digitado",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div className="flex flex-col h-full h-[90vh]">
      <div className="p-6 pb-4 border-b shrink-0 bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {team ? "Editar Equipe" : "Cadastrar Nova Equipe"}
          </DialogTitle>
        </DialogHeader>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((data) => {
            console.log("🛎️ onSubmit disparado COM CERTEZA!", { team, data });
            onSubmit(data);
          })}
          className="flex flex-col flex-1 min-h-0"
        >
          <div className="flex-1 overflow-y-auto p-6 space-y-6">

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

          {/* Endereço de Início Diário (Opcional) */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="h-5 w-5 text-blue-500">📍</span>
              <h3 className="text-lg font-medium">Endereço de Início Diário (Opcional)</h3>
            </div>
            <p className="text-sm text-gray-500">
              Se preenchido, será usado como ponto de partida na roteirização. Caso contrário, será usado o endereço padrão da empresa.
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="enderecoInicioCep"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CEP de Início</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="00000-000"
                        maxLength={9}
                        {...field}
                        value={field.value || ""}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          handleEnderecoInicioCepChange(newValue);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="enderecoInicioNumero"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="123"
                        {...field}
                        value={field.value || ""}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="enderecoInicioLogradouro"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Logradouro</FormLabel>
                    <FormControl>
                      <Input placeholder="Rua das Flores" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="enderecoInicioComplemento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Complemento</FormLabel>
                    <FormControl>
                      <Input placeholder="Apto 123" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="enderecoInicioBairro"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bairro</FormLabel>
                    <FormControl>
                      <Input placeholder="Centro" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="enderecoInicioCidade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cidade</FormLabel>
                    <FormControl>
                      <Input placeholder="São Paulo" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="enderecoInicioEstado"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado (UF)</FormLabel>
                    <FormControl>
                      <Input placeholder="SP" maxLength={2} {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Horários de Trabalho */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <ClockIcon className="h-5 w-5 text-green-500" />
              <h3 className="text-lg font-medium">Horários de Trabalho</h3>
            </div>
            <p className="text-sm text-gray-500">
              Defina os horários e dias de trabalho da equipe. Estes horários serão usados para calcular a disponibilidade.
            </p>

            <div className="grid gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="horarioInicioTrabalho"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Horário de Início</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        {...field}
                        value={field.value || "08:00"}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="horarioFimTrabalho"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Horário de Término</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        {...field}
                        value={field.value || "18:00"}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="horarioAlmocoMinutos"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tempo de Almoço (minutos)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        max="180"
                        placeholder="60"
                        {...field}
                        value={field.value || 60}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="diasTrabalho"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dias de Trabalho</FormLabel>
                  <div className="border rounded-lg p-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { value: 'segunda', label: 'Segunda' },
                        { value: 'terca', label: 'Terça' },
                        { value: 'quarta', label: 'Quarta' },
                        { value: 'quinta', label: 'Quinta' },
                        { value: 'sexta', label: 'Sexta' },
                        { value: 'sabado', label: 'Sábado' },
                        { value: 'domingo', label: 'Domingo' },
                      ].map((day) => (
                        <div key={day.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={`team-day-${day.value}`}
                            checked={field.value?.includes(day.value) || false}
                            onCheckedChange={(checked) => {
                              const currentDays = field.value || [];
                              if (checked) {
                                field.onChange([...currentDays, day.value]);
                              } else {
                                field.onChange(currentDays.filter(d => d !== day.value));
                              }
                            }}
                          />
                          <label
                            htmlFor={`team-day-${day.value}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {day.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

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

          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 p-6 pt-4 border-t bg-gray-50/50 shrink-0 mt-auto">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={team ? updateTeamMutation.isPending : createTeamMutation.isPending}
              className="w-full sm:w-auto bg-burnt-yellow hover:bg-burnt-yellow-dark text-white"
              onClick={() => {
                console.log("🔘 Botão clicked! Estado do formulário:", {
                  isValid: form.formState.isValid,
                  errors: form.formState.errors,
                  isDirty: form.formState.isDirty,
                  isSubmitting: form.formState.isSubmitting
                });
              }}
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