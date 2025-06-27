import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Calendar } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Service, Technician, BusinessRules, Client, Team } from "@shared/schema";
import { useLocation } from "wouter";
import { ClientSearch } from "@/components/ui/client-search";

// Schema para validação do formulário de busca
const findDateSchema = z.object({
  clientId: z.number().optional(),
  cep: z.string().regex(/^\d{5}-?\d{3}$/, "CEP deve estar no formato XXXXX-XXX"),
  numero: z.string().min(1, "Número é obrigatório").regex(/^\d+$/, "Digite apenas números"),
  serviceId: z.number({ required_error: "Selecione um serviço" }),
  technicianId: z.number().optional(),
  teamId: z.number().optional(),
});

type FindDateFormData = z.infer<typeof findDateSchema>;

interface AvailableDate {
  date: string;
  technician: string;
  technicianId?: number;
  teamId?: number;
  routeIncrease: number;
  totalDistance: number;
}

export default function FindDate() {
  const [, setLocation] = useLocation();
  const [searchResults, setSearchResults] = useState<AvailableDate[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Buscar clientes
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  // Buscar serviços
  const { data: services = [] } = useQuery<Service[]>({
    queryKey: ["/api/services"],
  });

  // Buscar técnicos
  const { data: technicians = [] } = useQuery<Technician[]>({
    queryKey: ["/api/technicians"],
  });

  // Buscar equipes
  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
  });

  // Buscar regras de negócio
  const { data: businessRules } = useQuery<BusinessRules>({
    queryKey: ["/api/business-rules"],
  });

  const form = useForm<FindDateFormData>({
    resolver: zodResolver(findDateSchema),
    defaultValues: {
      clientId: undefined,
      cep: "",
      numero: "",
      technicianId: undefined,
      teamId: undefined,
    },
  });

  // Função para formatar CEP automaticamente
  const formatCep = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 5) {
      return digits;
    }
    return digits.replace(/(\d{5})(\d{1,3})/, "$1-$2");
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCep(e.target.value);
    form.setValue("cep", formatted);
  };

  const handleNumeroChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numbersOnly = e.target.value.replace(/\D/g, "");
    form.setValue("numero", numbersOnly);
  };

  // Função para lidar com seleção de cliente
  const handleClientChange = (clientId: number | undefined) => {
    console.log("Cliente selecionado ID:", clientId);
    form.setValue("clientId", clientId);
    
    if (clientId) {
      const selectedClient = clients.find(c => c.id === clientId);
      console.log("Cliente encontrado:", selectedClient);
      if (selectedClient) {
        // Preencher automaticamente CEP e número
        console.log("Preenchendo CEP:", selectedClient.cep, "Número:", selectedClient.numero);
        form.setValue("cep", selectedClient.cep);
        form.setValue("numero", selectedClient.numero);
      }
    } else {
      // Limpar campos quando nenhum cliente selecionado
      form.setValue("cep", "");
      form.setValue("numero", "");
    }
  };

  // Mutação para buscar datas disponíveis
  const searchDatesMutation = useMutation({
    mutationFn: async (data: FindDateFormData) => {
      setIsSearching(true);
      
      // Simular busca de datas disponíveis
      // Em um cenário real, isso seria um endpoint da API
      const mockResults: AvailableDate[] = [];
      
      // Filtrar técnicos e equipes com base na seleção
      const availableTechnicians = data.technicianId 
        ? technicians.filter(t => t.id === data.technicianId)
        : technicians;
      
      const availableTeams = data.teamId 
        ? teams.filter(t => t.id === data.teamId)
        : teams;

      // Gerar datas disponíveis para os próximos 30 dias
      const today = new Date();
      for (let i = 1; i <= 30; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        
        // Pular fins de semana
        if (date.getDay() === 0 || date.getDay() === 6) continue;
        
        // Adicionar técnicos
        availableTechnicians.forEach(technician => {
          // Simular distâncias baseadas no CEP
          const baseDistance = Math.random() * 50 + 5; // 5-55 km
          const routeIncrease = Math.random() * 15 + 2; // 2-17 km
          
          // Filtrar por distância máxima se definida nas regras de negócio
          const maxDistance = businessRules?.distanciaMaximaEntrePontos ? parseFloat(businessRules.distanciaMaximaEntrePontos) : 50;
          if (baseDistance <= maxDistance) {
            mockResults.push({
              date: date.toISOString().split('T')[0],
              technician: `👤 ${technician.name}`,
              technicianId: technician.id,
              routeIncrease: routeIncrease,
              totalDistance: baseDistance + routeIncrease,
            });
          }
        });

        // Adicionar equipes
        availableTeams.forEach(team => {
          // Simular distâncias baseadas no CEP
          const baseDistance = Math.random() * 50 + 5; // 5-55 km
          const routeIncrease = Math.random() * 15 + 2; // 2-17 km
          
          // Filtrar por distância máxima se definida nas regras de negócio
          const maxDistance = businessRules?.distanciaMaximaEntrePontos ? parseFloat(businessRules.distanciaMaximaEntrePontos) : 50;
          if (baseDistance <= maxDistance) {
            mockResults.push({
              date: date.toISOString().split('T')[0],
              technician: `👥 ${team.name}`,
              teamId: team.id,
              routeIncrease: routeIncrease,
              totalDistance: baseDistance + routeIncrease,
            });
          }
        });
      }

      // Ordenar por data e depois por distância total
      return mockResults.sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare === 0) {
          return a.totalDistance - b.totalDistance;
        }
        return dateCompare;
      });
    },
    onSuccess: (results) => {
      setSearchResults(results);
      setIsSearching(false);
    },
    onError: () => {
      setIsSearching(false);
    }
  });

  const onSubmit = (data: FindDateFormData) => {
    searchDatesMutation.mutate(data);
  };

  const handleSchedule = (result: AvailableDate, formData: FindDateFormData) => {
    console.log("🔄 [DEBUG] handleSchedule - result:", result);
    console.log("🔄 [DEBUG] handleSchedule - formData:", formData);
    
    // Navegar para a tela de agendamentos com dados pré-preenchidos
    const params = new URLSearchParams({
      date: result.date,
      cep: formData.cep,
      numero: formData.numero,
      serviceId: formData.serviceId.toString(),
      preselected: "true"
    });

    // Adicionar clientId se selecionado
    if (formData.clientId) {
      params.append("clientId", formData.clientId.toString());
    }

    // Adicionar technicianId ou teamId dependendo do tipo
    if (result.technicianId) {
      params.append("technicianId", result.technicianId.toString());
      console.log("🔄 [DEBUG] Adicionando technicianId:", result.technicianId);
    } else if (result.teamId) {
      params.append("teamId", result.teamId.toString());
      console.log("🔄 [DEBUG] Adicionando teamId:", result.teamId);
    }
    
    console.log("🔄 [DEBUG] Parâmetros finais:", params.toString());
    setLocation(`/appointments?${params.toString()}`);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex items-center space-x-2">
        <Search className="h-8 w-8 text-burnt-yellow" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Ache uma data</h1>
          <p className="text-gray-600">Encontre as melhores datas disponíveis para seu agendamento</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Buscar datas disponíveis</CardTitle>
          <CardDescription>
            Preencha os dados abaixo para encontrar as melhores opções de agendamento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cliente">Cliente (opcional)</Label>
              <ClientSearch
                value={form.watch("clientId")}
                onValueChange={handleClientChange}
                placeholder="Pesquisar por nome ou CPF"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cep">CEP</Label>
                <Input
                  id="cep"
                  placeholder="00000-000"
                  value={form.watch("cep")}
                  onChange={handleCepChange}
                  maxLength={9}
                  disabled={!!form.watch("clientId")}
                  className={form.formState.errors.cep ? "border-red-500" : ""}
                />
                {form.formState.errors.cep && (
                  <p className="text-sm text-red-500">{form.formState.errors.cep.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="numero">Número</Label>
                <Input
                  id="numero"
                  placeholder="123"
                  value={form.watch("numero")}
                  onChange={handleNumeroChange}
                  disabled={!!form.watch("clientId")}
                  className={form.formState.errors.numero ? "border-red-500" : ""}
                />
                {form.formState.errors.numero && (
                  <p className="text-sm text-red-500">{form.formState.errors.numero.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="service">Serviço</Label>
                <Select
                  value={form.watch("serviceId")?.toString() || ""}
                  onValueChange={(value) => form.setValue("serviceId", parseInt(value))}
                >
                  <SelectTrigger className={form.formState.errors.serviceId ? "border-red-500" : ""}>
                    <SelectValue placeholder="Selecione um serviço" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id.toString()}>
                        {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.serviceId && (
                  <p className="text-sm text-red-500">{form.formState.errors.serviceId.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="technician">Técnico/Equipe (opcional)</Label>
                <Select
                  value={
                    form.watch("technicianId") ? `tech-${form.watch("technicianId")}` :
                    form.watch("teamId") ? `team-${form.watch("teamId")}` : ""
                  }
                  onValueChange={(value) => {
                    console.log("🔄 [DEBUG] FindDate - Seleção alterada para:", value);
                    
                    if (value === "0" || value === "") {
                      // Limpar seleções
                      form.setValue("technicianId", undefined);
                      form.setValue("teamId", undefined);
                      console.log("🔄 [DEBUG] FindDate - Limpando seleções");
                    } else if (value.startsWith('tech-')) {
                      // É um técnico
                      const technicianId = parseInt(value.split('-')[1]);
                      console.log("🔄 [DEBUG] FindDate - Técnico selecionado ID:", technicianId);
                      form.setValue("technicianId", technicianId);
                      form.setValue("teamId", undefined);
                    } else if (value.startsWith('team-')) {
                      // É uma equipe
                      const teamId = parseInt(value.split('-')[1]);
                      console.log("🔄 [DEBUG] FindDate - Equipe selecionada ID:", teamId);
                      form.setValue("teamId", teamId);
                      form.setValue("technicianId", undefined);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Qualquer técnico/equipe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Qualquer técnico/equipe</SelectItem>
                    {technicians.map((technician) => (
                      <SelectItem key={`tech-${technician.id}`} value={`tech-${technician.id}`}>
                        👤 {technician.name}
                      </SelectItem>
                    ))}
                    {teams.map((team) => (
                      <SelectItem key={`team-${team.id}`} value={`team-${team.id}`}>
                        👥 {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-burnt-yellow hover:bg-burnt-yellow/90"
              disabled={isSearching}
            >
              {isSearching ? "Buscando..." : "Buscar datas"}
              <Search className="ml-2 h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>

      {searchResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Datas disponíveis</CardTitle>
            <CardDescription>
              {searchResults.length} opções encontradas, ordenadas da data mais próxima para a mais distante
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Técnico</TableHead>
                    <TableHead>Distância de aumento</TableHead>
                    <TableHead>Distância total do dia</TableHead>
                    <TableHead>Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searchResults.map((result, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        {formatDate(result.date)}
                      </TableCell>
                      <TableCell>{result.technician}</TableCell>
                      <TableCell>{result.routeIncrease.toFixed(1)} km</TableCell>
                      <TableCell>{result.totalDistance.toFixed(1)} km</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => handleSchedule(result, form.getValues())}
                          className="bg-burnt-yellow hover:bg-burnt-yellow/90"
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          Agendar nessa data
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {searchResults.length === 0 && searchDatesMutation.isSuccess && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-gray-500">
              Nenhuma data disponível foi encontrada para os critérios informados.
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Tente expandir a área de busca ou selecionar outro serviço.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}