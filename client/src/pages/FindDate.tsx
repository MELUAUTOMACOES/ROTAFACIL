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
import { buscarEnderecoPorCep } from "@/lib/cep";
import { useToast } from "@/hooks/use-toast";

// Schema para validação do formulário de busca
const findDateSchema = z.object({
  clientId: z.number().optional(),
  cep: z.string().regex(/^\d{5}-?\d{3}$/, "CEP deve estar no formato XXXXX-XXX"),
  logradouro: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  numero: z.string().min(1, "Número é obrigatório").regex(/^\d+$/, "Digite apenas números"),
  serviceId: z.number({ required_error: "Selecione um serviço" }),
  technicianId: z.number().optional(),
  teamId: z.number().optional(),
  startDate: z.string().optional(), // Data inicial da busca
});

type FindDateFormData = z.infer<typeof findDateSchema>;

interface AvailableDate {
  date: string;
  responsibleType: 'technician' | 'team';
  responsibleId: number;
  responsibleName: string;
  availableMinutes: number;
  totalMinutes: number;
  usedMinutes: number;
  distance: number;
  distanceType: 'between_points' | 'from_base';
}

export default function FindDate() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [searchResults, setSearchResults] = useState<AvailableDate[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isFetchingCep, setIsFetchingCep] = useState(false);

  // Buscar serviços
  const { data: services = [], isLoading: isLoadingServices, error: errorServices } = useQuery<Service[]>({
    queryKey: ["/api/services"],
  });

  // Buscar técnicos
  const { data: technicians = [], isLoading: isLoadingTechnicians, error: errorTechnicians } = useQuery<Technician[]>({
    queryKey: ["/api/technicians"],
  });

  // Buscar equipes
  const { data: teams = [], isLoading: isLoadingTeams, error: errorTeams } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
  });

  // Buscar regras de negócio
  const { data: businessRules } = useQuery<BusinessRules>({
    queryKey: ["/api/business-rules"],
  });

  // Debug detalhado
  console.log("🔍 [FIND-DATE] Status das queries:");
  console.log("  - Serviços:", { count: services.length, loading: isLoadingServices, error: errorServices?.message });
  console.log("  - Técnicos:", { count: technicians.length, loading: isLoadingTechnicians, error: errorTechnicians?.message });
  console.log("  - Equipes:", { count: teams.length, loading: isLoadingTeams, error: errorTeams?.message });

  const form = useForm<FindDateFormData>({
    resolver: zodResolver(findDateSchema),
    defaultValues: {
      clientId: undefined,
      cep: "",
      logradouro: "",
      bairro: "",
      cidade: "",
      estado: "",
      numero: "",
      technicianId: undefined,
      teamId: undefined,
      startDate: new Date().toISOString().split('T')[0], // Data de hoje por padrão
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

  // Buscar endereço quando CEP for preenchido
  const handleCepBlur = async () => {
    const cep = form.watch("cep");
    if (!cep || cep.replace(/\D/g, "").length !== 8) return;

    setIsFetchingCep(true);
    try {
      const data = await buscarEnderecoPorCep(cep);
      form.setValue("logradouro", data.logradouro || "");
      form.setValue("bairro", data.bairro || "");
      form.setValue("cidade", data.localidade || "");
      form.setValue("estado", data.uf || "");
      toast({
        title: "CEP encontrado!",
        description: `${data.logradouro}, ${data.bairro} - ${data.localidade}/${data.uf}`,
      });
    } catch (error) {
      toast({
        title: "CEP não encontrado",
        description: "Verifique o CEP digitado e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsFetchingCep(false);
    }
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
  const handleClientSelect = (client: Client | null) => {
    console.log("Cliente selecionado:", client);
    form.setValue("clientId", client?.id);

    if (client) {
      // Preencher automaticamente todos os dados de endereço
      console.log("Preenchendo endereço completo do cliente:", client);
      form.setValue("cep", client.cep);
      form.setValue("numero", client.numero);
      form.setValue("logradouro", client.logradouro);
      form.setValue("bairro", client.bairro);
      form.setValue("cidade", client.cidade);

      // Buscar o estado (UF) pelo CEP, pois a tabela clients não possui esse campo
      buscarEnderecoPorCep(client.cep).then(data => {
        if (data.uf) form.setValue("estado", data.uf);
      }).catch(err => console.error("Erro ao buscar UF do cliente:", err));
    } else {
      // Limpar campos quando nenhum cliente selecionado
      form.setValue("cep", "");
      form.setValue("numero", "");
      form.setValue("logradouro", "");
      form.setValue("bairro", "");
      form.setValue("cidade", "");
      form.setValue("estado", "");
    }
  };

  const [isFiltersCollapsed, setIsFiltersCollapsed] = useState(false);

  // Função para buscar datas com streaming (Server-Sent Events)
  const searchDatesWithStreaming = async (data: FindDateFormData) => {
    setIsSearching(true);
    setIsFiltersCollapsed(true); // Minimizar filtros ao iniciar busca
    setSearchResults([]); // Limpar resultados anteriores

    const token = localStorage.getItem("token");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    try {
      const response = await fetch("/api/scheduling/find-available-dates", {
        method: "POST",
        headers,
        body: JSON.stringify({
          clientId: data.clientId,
          cep: data.cep,
          numero: data.numero,
          logradouro: data.logradouro,
          bairro: data.bairro,
          cidade: data.cidade,
          estado: data.estado,
          serviceId: data.serviceId,
          technicianId: data.technicianId,
          teamId: data.teamId,
          startDate: data.startDate || new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("Response body is null");
      }

      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          setIsSearching(false);
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");

        // Manter a última linha incompleta no buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const jsonStr = line.substring(6);
            try {
              const event = JSON.parse(jsonStr);

              if (event.done) {
                console.log("✅ Busca concluída!");
                setIsSearching(false);
              } else if (event.error) {
                console.error("❌ Erro:", event.error);
                setIsSearching(false);
              } else {
                // Adicionar novo candidato aos resultados
                console.log("📥 Novo candidato recebido:", event);
                setSearchResults((prev) => [...prev, event]);
              }
            } catch (e) {
              console.warn("Erro ao parsear evento:", e);
            }
          }
        }
      }
    } catch (error: any) {
      console.error("❌ Erro ao buscar datas:", error);
      setIsSearching(false);
    }
  };

  const searchDatesMutation = useMutation({
    mutationFn: searchDatesWithStreaming,
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
    if (result.responsibleType === 'technician') {
      params.append("technicianId", result.responsibleId.toString());
      console.log("🔄 [DEBUG] Adicionando technicianId:", result.responsibleId);
    } else if (result.responsibleType === 'team') {
      params.append("teamId", result.responsibleId.toString());
      console.log("🔄 [DEBUG] Adicionando teamId:", result.responsibleId);
    }

    console.log("🔄 [DEBUG] Parâmetros finais:", params.toString());
    setLocation(`/appointments?${params.toString()}`);
  };

  const formatDate = (dateString: string) => {
    // Forçar interpretação como UTC para evitar problemas de timezone
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
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
        <CardHeader className="cursor-pointer" onClick={() => setIsFiltersCollapsed(!isFiltersCollapsed)}>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Buscar datas disponíveis</CardTitle>
              <CardDescription>
                {isFiltersCollapsed
                  ? "Clique para expandir os filtros"
                  : "Preencha os dados abaixo para encontrar as melhores opções de agendamento"}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm">
              {isFiltersCollapsed ? "Expandir" : "Minimizar"}
            </Button>
          </div>
        </CardHeader>

        {isFiltersCollapsed && isSearching && (
          <CardContent>
            <div className="flex items-center justify-center py-8 space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-burnt-yellow"></div>
              <p className="text-lg text-gray-600">Aguarde, buscando as melhores datas...</p>
            </div>
          </CardContent>
        )}

        {!isFiltersCollapsed && (
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cliente">Cliente (opcional)</Label>
                <ClientSearch
                  value={form.watch("clientId")}
                  onValueChange={(id) => form.setValue("clientId", id)}
                  onSelect={handleClientSelect}
                  placeholder="Pesquisar por nome ou CPF"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cep">CEP</Label>
                  <Input
                    id="cep"
                    placeholder="00000-000"
                    value={form.watch("cep")}
                    onChange={handleCepChange}
                    onBlur={handleCepBlur}
                    maxLength={9}
                    disabled={!!form.watch("clientId") || isFetchingCep}
                    className={form.formState.errors.cep ? "border-red-500" : ""}
                  />
                  {isFetchingCep && <p className="text-sm text-gray-500">Buscando CEP...</p>}
                  {form.formState.errors.cep && (
                    <p className="text-sm text-red-500">{form.formState.errors.cep.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="logradouro">Logradouro</Label>
                  <Input
                    id="logradouro"
                    placeholder="Rua, Avenida..."
                    value={form.watch("logradouro")}
                    disabled
                    className="bg-gray-50"
                  />
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
                  <Label htmlFor="bairro">Bairro</Label>
                  <Input
                    id="bairro"
                    placeholder="Bairro"
                    value={form.watch("bairro")}
                    disabled
                    className="bg-gray-50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cidade">Cidade</Label>
                  <Input
                    id="cidade"
                    placeholder="Cidade"
                    value={form.watch("cidade")}
                    disabled
                    className="bg-gray-50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="estado">Estado</Label>
                  <Input
                    id="estado"
                    placeholder="UF"
                    value={form.watch("estado")}
                    disabled
                    className="bg-gray-50"
                    maxLength={2}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div className="space-y-2">
                  <Label htmlFor="service">Serviço</Label>
                  <Select
                    value={form.watch("serviceId")?.toString() || ""}
                    onValueChange={(value) => form.setValue("serviceId", parseInt(value))}
                    disabled={isLoadingServices}
                  >
                    <SelectTrigger className={form.formState.errors.serviceId ? "border-red-500" : ""}>
                      <SelectValue placeholder={
                        isLoadingServices ? "Carregando serviços..." :
                          errorServices ? "Erro ao carregar serviços" :
                            "Selecione um serviço"
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {isLoadingServices ? (
                        <SelectItem value="loading" disabled>
                          Carregando...
                        </SelectItem>
                      ) : errorServices ? (
                        <SelectItem value="error" disabled>
                          Erro: {errorServices.message}
                        </SelectItem>
                      ) : services.length === 0 ? (
                        <SelectItem value="0" disabled>
                          Nenhum serviço cadastrado
                        </SelectItem>
                      ) : (
                        services.map((service) => (
                          <SelectItem key={service.id} value={service.id.toString()}>
                            {service.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.serviceId && (
                    <p className="text-sm text-red-500">{form.formState.errors.serviceId.message}</p>
                  )}
                  {errorServices && (
                    <p className="text-sm text-red-500">Erro ao carregar serviços. Verifique sua conexão.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="startDate">Data inicial da busca</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={form.watch("startDate")}
                    onChange={(e) => form.setValue("startDate", e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className=""
                  />
                  <p className="text-xs text-gray-500">Buscar datas a partir de</p>
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
                    disabled={isLoadingTechnicians || isLoadingTeams}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={
                        (isLoadingTechnicians || isLoadingTeams) ? "Carregando..." :
                          (errorTechnicians || errorTeams) ? "Erro ao carregar" :
                            "Qualquer técnico/equipe"
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {(isLoadingTechnicians || isLoadingTeams) ? (
                        <SelectItem value="loading" disabled>
                          Carregando...
                        </SelectItem>
                      ) : (errorTechnicians || errorTeams) ? (
                        <SelectItem value="error" disabled>
                          Erro ao carregar dados
                        </SelectItem>
                      ) : (
                        <>
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
                          {technicians.length === 0 && teams.length === 0 && (
                            <SelectItem value="none" disabled>
                              Nenhum técnico ou equipe cadastrado
                            </SelectItem>
                          )}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  {(errorTechnicians || errorTeams) && (
                    <p className="text-sm text-red-500">Erro ao carregar técnicos/equipes.</p>
                  )}
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-burnt-yellow hover:bg-burnt-yellow/90 transition-all duration-300"
                disabled={isSearching}
              >
                {isSearching ? (
                  <>
                    <span className="animate-pulse">Procurando datas...</span>
                    <Search className="ml-2 h-4 w-4 animate-spin" />
                  </>
                ) : (
                  <>
                    Buscar datas
                    <Search className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        )}
      </Card>

      {searchResults.length > 0 && (
        <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
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
                    <TableHead>Responsável</TableHead>
                    <TableHead>Tempo Disponível</TableHead>
                    <TableHead>Distância</TableHead>
                    <TableHead>Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searchResults.map((result, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        {formatDate(result.date)}
                      </TableCell>
                      <TableCell>
                        {result.responsibleType === 'technician' ? '👤 ' : '👥 '}
                        {result.responsibleName}
                      </TableCell>
                      <TableCell>
                        {Math.floor(result.availableMinutes / 60)}h {result.availableMinutes % 60}min disponíveis
                      </TableCell>
                      <TableCell>
                        {result.distance.toFixed(1)} km
                        {result.distanceType === 'from_base' ? ' (da base)' : ' (entre pontos)'}
                      </TableCell>
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

      {searchResults.length === 0 && searchDatesMutation.isSuccess && !isSearching && (
        <Card className="animate-in fade-in duration-300">
          <CardContent className="text-center py-8">
            <p className="text-gray-500">
              Nenhuma data disponível foi encontrada para os critérios informados.
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Tente expandir a área de busca ou selecionar outro serviço.
            </p>
            <Button
              variant="link"
              onClick={() => setIsFiltersCollapsed(false)}
              className="mt-4"
            >
              Modificar filtros
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}