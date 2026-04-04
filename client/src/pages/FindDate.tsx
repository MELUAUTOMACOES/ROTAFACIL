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
import { Search, Calendar, ChevronDown, ChevronUp, Clock3, MapPin, UserRound, Users, ArrowRight } from "lucide-react";
import { getAuthHeaders } from "@/lib/auth";
import { buildApiUrl } from "@/lib/api-config";
import { normalizeItems } from "@/lib/normalize";
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
  startDate: z.string().optional(),
});

type FindDateFormData = z.infer<typeof findDateSchema>;

interface AvailableDate {
  date: string;
  responsibleType: "technician" | "team";
  responsibleId: number;
  responsibleName: string;
  availableMinutes: number;
  totalMinutes: number;
  usedMinutes: number;
  distance: number;
  distanceType: "between_points" | "from_base";
}

export default function FindDate() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [searchResults, setSearchResults] = useState<AvailableDate[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const [isFiltersCollapsed, setIsFiltersCollapsed] = useState(false);

  // Estados para múltiplos endereços
  const [clientAddresses, setClientAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);

  const { data: servicesData, isLoading: isLoadingServices, error: errorServices } = useQuery({
    queryKey: ["/api/services"],
    queryFn: async () => {
      const response = await fetch(buildApiUrl("/api/services?page=1&pageSize=50"), {
        headers: getAuthHeaders(),
      });
      return response.json();
    },
  });
  const services = normalizeItems<Service>(servicesData);

  const { data: techniciansData, isLoading: isLoadingTechnicians, error: errorTechnicians } = useQuery({
    queryKey: ["/api/technicians"],
    queryFn: async () => {
      const response = await fetch(buildApiUrl("/api/technicians?page=1&pageSize=50"), {
        headers: getAuthHeaders(),
      });
      return response.json();
    },
  });
  const technicians = normalizeItems<Technician>(techniciansData);

  const { data: teamsData, isLoading: isLoadingTeams, error: errorTeams } = useQuery({
    queryKey: ["/api/teams"],
    queryFn: async () => {
      const response = await fetch(buildApiUrl("/api/teams?page=1&pageSize=50"), {
        headers: getAuthHeaders(),
      });
      return response.json();
    },
  });
  const teams = normalizeItems<Team>(teamsData);

  useQuery<BusinessRules>({
    queryKey: ["/api/business-rules"],
  });

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
      startDate: new Date().toISOString().split("T")[0],
    },
  });

  const formatCep = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 5) return digits;
    return digits.replace(/(\d{5})(\d{1,3})/, "$1-$2");
  };

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

  const fillAddressFields = (address: any) => {
    console.log("📋 [FIND-DATE] Preenchendo campos com endereço:", address);
    
    form.setValue("cep", address.cep || "");
    form.setValue("numero", address.numero || "");
    form.setValue("logradouro", address.logradouro || "");
    form.setValue("bairro", address.bairro || "");
    form.setValue("cidade", address.cidade || "");
    form.setValue("estado", address.estado || "");
  };

  const handleAddressChange = (addressId: string) => {
    const address = clientAddresses.find(addr => addr.id === parseInt(addressId));
    if (address) {
      setSelectedAddressId(address.id);
      fillAddressFields(address);
    }
  };

  const handleClientSelect = async (client: Client | null) => {
    form.setValue("clientId", client?.id);

    if (client) {
      console.log("📋 [FIND-DATE] Cliente selecionado:", client.id, client.name);
      
      // Buscar endereços do cliente
      try {
        const response = await fetch(buildApiUrl(`/api/clients/${client.id}`), {
          headers: getAuthHeaders(),
        });
        
        if (response.ok) {
          const clientData = await response.json();
          const addresses = clientData.addresses || [];
          
          console.log("📋 [FIND-DATE] Endereços do cliente:", addresses.length);
          setClientAddresses(addresses);
          
          // Selecionar endereço principal por padrão
          const primaryAddress = addresses.find((addr: any) => addr.isPrimary);
          const addressToUse = primaryAddress || addresses[0];
          
          if (addressToUse) {
            setSelectedAddressId(addressToUse.id || null);
            fillAddressFields(addressToUse);
          }
        }
      } catch (error) {
        console.error("❌ [FIND-DATE] Erro ao buscar endereços:", error);
        // Fallback para campos legados
        form.setValue("cep", client.cep);
        form.setValue("numero", client.numero);
        form.setValue("logradouro", client.logradouro);
        form.setValue("bairro", client.bairro);
        form.setValue("cidade", client.cidade);
        
        // Buscar estado via CEP
        buscarEnderecoPorCep(client.cep)
          .then((data) => {
            if (data.uf) form.setValue("estado", data.uf);
          })
          .catch((err) => console.error("Erro ao buscar UF do cliente:", err));
      }
    } else {
      // Limpar TUDO ao desselecionar cliente
      console.log("📋 [FIND-DATE] Limpando dados do cliente anterior");
      setClientAddresses([]);
      setSelectedAddressId(null);
      form.setValue("cep", "");
      form.setValue("numero", "");
      form.setValue("logradouro", "");
      form.setValue("bairro", "");
      form.setValue("cidade", "");
      form.setValue("estado", "");
    }
  };

  const searchDatesWithStreaming = async (data: FindDateFormData) => {
    setIsSearching(true);
    setIsFiltersCollapsed(true);
    setSearchResults([]);

    const token = localStorage.getItem("token");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    try {
      const response = await fetch(buildApiUrl("/api/scheduling/find-available-dates"), {
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
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const jsonStr = line.substring(6);
            try {
              const event = JSON.parse(jsonStr);

              if (event.done) {
                setIsSearching(false);
              } else if (event.error) {
                console.error("Erro:", event.error);
                setIsSearching(false);
              } else {
                setSearchResults((prev) => [...prev, event]);
              }
            } catch (e) {
              console.warn("Erro ao parsear evento:", e);
            }
          }
        }
      }
    } catch (error: any) {
      console.error("Erro ao buscar datas:", error);
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
    const params = new URLSearchParams({
      date: result.date,
      cep: formData.cep,
      numero: formData.numero,
      serviceId: formData.serviceId.toString(),
      preselected: "true",
    });

    if (formData.clientId) {
      params.append("clientId", formData.clientId.toString());
    }

    if (result.responsibleType === "technician") {
      params.append("technicianId", result.responsibleId.toString());
    } else if (result.responsibleType === "team") {
      params.append("teamId", result.responsibleId.toString());
    }

    setLocation(`/appointments?${params.toString()}`);
  };

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("pt-BR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const fieldClass =
    "h-11 rounded-xl border-border bg-background shadow-sm transition-all focus-visible:ring-1 focus-visible:ring-[#DAA520] focus-visible:border-[#DAA520]";
  const readonlyFieldClass =
    "h-11 rounded-xl border-border bg-muted/40 text-muted-foreground shadow-sm";

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <Card className="rounded-3xl border shadow-sm bg-card overflow-hidden">
        <CardHeader
          className="cursor-pointer border-b bg-muted/30"
          onClick={() => setIsFiltersCollapsed(!isFiltersCollapsed)}
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-xl md:text-2xl">Buscar datas disponíveis</CardTitle>
              <CardDescription className="mt-1">
                {isFiltersCollapsed
                  ? "Clique para expandir os filtros"
                  : "Preencha os dados para encontrar as melhores opções de agendamento"}
              </CardDescription>
            </div>

            <Button variant="outline" size="sm" className="rounded-xl shadow-sm">
              {isFiltersCollapsed ? (
                <>
                  Expandir
                  <ChevronDown className="ml-2 h-4 w-4" />
                </>
              ) : (
                <>
                  Minimizar
                  <ChevronUp className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        {isFiltersCollapsed && isSearching && (
          <CardContent className="py-10">
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#DAA520]/10 text-[#DAA520] shadow-sm">
                <Search className="h-6 w-6 animate-spin" />
              </div>
              <div>
                <p className="text-base font-semibold">Buscando as melhores datas...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Aguarde enquanto analisamos agenda, localização e disponibilidade.
                </p>
              </div>
            </div>
          </CardContent>
        )}

        {!isFiltersCollapsed && (
          <CardContent className="p-5 md:p-6">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="cliente">Cliente (opcional)</Label>
                <ClientSearch
                  value={form.watch("clientId")}
                  onValueChange={(id) => form.setValue("clientId", id)}
                  onSelect={handleClientSelect}
                  placeholder="Pesquisar por nome ou CPF"
                />
              </div>

              <div className="rounded-2xl border bg-muted/20 p-4 md:p-5">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="h-4 w-4 text-[#DAA520]" />
                  <h3 className="text-sm font-semibold">Endereço do atendimento</h3>
                </div>

                {/* Seletor de Endereço (apenas se cliente tiver 2+ endereços) */}
                {form.watch("clientId") && clientAddresses.length > 1 && (
                  <div className="mb-4 space-y-2">
                    <Label htmlFor="addressSelector">Endereço para buscar disponibilidade *</Label>
                    <Select
                      value={selectedAddressId?.toString() || ""}
                      onValueChange={handleAddressChange}
                    >
                      <SelectTrigger id="addressSelector" className={fieldClass}>
                        <SelectValue placeholder="Selecione o endereço" />
                      </SelectTrigger>
                      <SelectContent>
                        {clientAddresses.map((addr: any) => (
                          <SelectItem key={addr.id} value={addr.id.toString()}>
                            {addr.isPrimary && "✓ "}
                            {addr.label || "Endereço"} - {addr.logradouro}, {addr.numero}
                            {addr.isPrimary && " (Principal)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {clientAddresses.length} endereços cadastrados. A busca de datas considerará este endereço.
                    </p>
                  </div>
                )}

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
                      className={`${fieldClass} ${form.formState.errors.cep ? "border-red-500" : ""}`}
                    />
                    {isFetchingCep && <p className="text-xs text-muted-foreground">Buscando CEP...</p>}
                    {form.formState.errors.cep && (
                      <p className="text-xs text-red-500">{form.formState.errors.cep.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="logradouro">Logradouro</Label>
                    <Input
                      id="logradouro"
                      placeholder="Rua, Avenida..."
                      value={form.watch("logradouro")}
                      disabled
                      className={readonlyFieldClass}
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
                      className={`${fieldClass} ${form.formState.errors.numero ? "border-red-500" : ""}`}
                    />
                    {form.formState.errors.numero && (
                      <p className="text-xs text-red-500">{form.formState.errors.numero.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bairro">Bairro</Label>
                    <Input
                      id="bairro"
                      placeholder="Bairro"
                      value={form.watch("bairro")}
                      disabled
                      className={readonlyFieldClass}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cidade">Cidade</Label>
                    <Input
                      id="cidade"
                      placeholder="Cidade"
                      value={form.watch("cidade")}
                      disabled
                      className={readonlyFieldClass}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="estado">Estado</Label>
                    <Input
                      id="estado"
                      placeholder="UF"
                      value={form.watch("estado")}
                      disabled
                      maxLength={2}
                      className={readonlyFieldClass}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border bg-muted/20 p-4 md:p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="h-4 w-4 text-[#DAA520]" />
                  <h3 className="text-sm font-semibold">Configurações da busca</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="service">Serviço</Label>
                    <Select
                      value={form.watch("serviceId")?.toString() || ""}
                      onValueChange={(value) => form.setValue("serviceId", parseInt(value))}
                      disabled={isLoadingServices}
                    >
                      <SelectTrigger className={`${fieldClass} ${form.formState.errors.serviceId ? "border-red-500" : ""}`}>
                        <SelectValue
                          placeholder={
                            isLoadingServices
                              ? "Carregando serviços..."
                              : errorServices
                                ? "Erro ao carregar serviços"
                                : "Selecione um serviço"
                          }
                        />
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
                      <p className="text-xs text-red-500">{form.formState.errors.serviceId.message}</p>
                    )}
                    {errorServices && (
                      <p className="text-xs text-red-500">Erro ao carregar serviços.</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="startDate">Data inicial da busca</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={form.watch("startDate")}
                      onChange={(e) => form.setValue("startDate", e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      className={fieldClass}
                    />
                    <p className="text-xs text-muted-foreground">Buscar datas a partir de</p>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="technician">Técnico/Equipe (opcional)</Label>
                    <Select
                      value={
                        form.watch("technicianId")
                          ? `tech-${form.watch("technicianId")}`
                          : form.watch("teamId")
                            ? `team-${form.watch("teamId")}`
                            : ""
                      }
                      onValueChange={(value) => {
                        if (value === "0" || value === "") {
                          form.setValue("technicianId", undefined);
                          form.setValue("teamId", undefined);
                        } else if (value.startsWith("tech-")) {
                          const technicianId = parseInt(value.split("-")[1]);
                          form.setValue("technicianId", technicianId);
                          form.setValue("teamId", undefined);
                        } else if (value.startsWith("team-")) {
                          const teamId = parseInt(value.split("-")[1]);
                          form.setValue("teamId", teamId);
                          form.setValue("technicianId", undefined);
                        }
                      }}
                      disabled={isLoadingTechnicians || isLoadingTeams}
                    >
                      <SelectTrigger className={fieldClass}>
                        <SelectValue
                          placeholder={
                            isLoadingTechnicians || isLoadingTeams
                              ? "Carregando..."
                              : errorTechnicians || errorTeams
                                ? "Erro ao carregar"
                                : "Qualquer técnico/equipe"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {isLoadingTechnicians || isLoadingTeams ? (
                          <SelectItem value="loading" disabled>
                            Carregando...
                          </SelectItem>
                        ) : errorTechnicians || errorTeams ? (
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
                      <p className="text-xs text-red-500">Erro ao carregar técnicos/equipes.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between border-t pt-4">
                <p className="text-sm text-muted-foreground">
                  O sistema vai analisar agenda, rota e disponibilidade para sugerir os melhores encaixes.
                </p>

                <Button
                  type="submit"
                  className="rounded-xl bg-[#DAA520] hover:bg-[#B8860B] text-black shadow-sm"
                  disabled={isSearching}
                >
                  {isSearching ? (
                    <>
                      Procurando datas...
                      <Search className="ml-2 h-4 w-4 animate-spin" />
                    </>
                  ) : (
                    <>
                      Buscar datas
                      <Search className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        )}
      </Card>

      {searchResults.length > 0 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl md:text-2xl font-bold">Datas disponíveis</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {searchResults.length} opção(ões) encontrada(s), ordenadas da data mais próxima para a mais distante
            </p>
          </div>

          <div className="grid gap-4">
            {searchResults.map((result, index) => (
              <Card
                key={index}
                className="rounded-3xl border shadow-sm bg-card overflow-hidden transition-all hover:shadow-md"
              >
                <CardContent className="p-5 md:p-6">
                  <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr_auto] lg:items-center">
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex items-center gap-2 rounded-full bg-[#DAA520]/10 px-3 py-1 text-xs font-medium text-[#B8860B] dark:text-[#DAA520]">
                          <Calendar className="h-3.5 w-3.5" />
                          Opção encontrada
                        </div>

                        <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                          <Clock3 className="h-3.5 w-3.5" />
                          {Math.floor(result.availableMinutes / 60)}h {result.availableMinutes % 60}min disponíveis
                        </div>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold">
                          {formatDate(result.date)}
                        </h3>
                        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                          {result.responsibleType === "technician" ? (
                            <UserRound className="h-4 w-4" />
                          ) : (
                            <Users className="h-4 w-4" />
                          )}
                          <span>
                            Responsável: <span className="font-medium text-foreground">{result.responsibleName}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                      <div className="rounded-2xl border bg-muted/20 p-4 shadow-sm">
                        <p className="text-[11px] text-muted-foreground">Distância</p>
                        <p className="mt-1 text-base font-semibold">
                          {result.distance.toFixed(1)} km
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {result.distanceType === "from_base" ? "Da base" : "Entre pontos"}
                        </p>
                      </div>

                      <div className="rounded-2xl border bg-muted/20 p-4 shadow-sm">
                        <p className="text-[11px] text-muted-foreground">Disponibilidade</p>
                        <p className="mt-1 text-base font-semibold">
                          {Math.floor(result.availableMinutes / 60)}h {result.availableMinutes % 60}min
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Tempo livre identificado
                        </p>
                      </div>
                    </div>

                    <div className="flex lg:justify-end">
                      <Button
                        size="sm"
                        onClick={() => handleSchedule(result, form.getValues())}
                        className="rounded-xl bg-[#DAA520] hover:bg-[#B8860B] text-black shadow-sm"
                      >
                        Agendar nesta data
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {searchResults.length === 0 && searchDatesMutation.isSuccess && !isSearching && (
        <Card className="rounded-3xl border shadow-sm bg-card">
          <CardContent className="text-center py-10">
            <div className="mx-auto max-w-md">
              <h3 className="text-lg font-semibold">Nenhuma data disponível encontrada</h3>
              <p className="text-sm text-muted-foreground mt-2 leading-6">
                Tente ampliar a busca, selecionar outro serviço ou modificar os filtros para encontrar mais opções.
              </p>
              <Button
                variant="outline"
                onClick={() => setIsFiltersCollapsed(false)}
                className="mt-5 rounded-xl shadow-sm"
              >
                Modificar filtros
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}