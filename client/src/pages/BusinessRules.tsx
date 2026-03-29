import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Settings, Save, Clock, MapPin, Route, Fuel, Target, AlertCircle, MessageCircle } from "lucide-react";
import { insertBusinessRulesSchema, type BusinessRules, type InsertBusinessRules } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { buscarEnderecoPorCep } from "@/lib/cep";

export default function BusinessRulesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("rotas");

  const { data: businessRules, isLoading } = useQuery<BusinessRules>({
    queryKey: ['/api/business-rules'],
    enabled: !!user,
  });

  // 🏢 Busca dados da empresa para pré-popular o endereço
  const { data: companyInfo } = useQuery<{
    id: number; name: string; cep: string; logradouro: string;
    numero: string; cidade: string; estado: string;
  }>({
    queryKey: ['/api/company/info'],
    enabled: !!user,
  });

  const form = useForm<InsertBusinessRules>({
    resolver: zodResolver(insertBusinessRulesSchema),
    defaultValues: {
      maximoParadasPorRota: 10,
      tempoDeslocamentoBuffer: 15,
      minutosEntreParadas: 30, // ⚠️ DEPRECATED - mantido para compatibilidade DB
      distanciaMaximaEntrePontos: "50.00", // ⚠️ DEPRECATED
      distanciaMaximaAtendida: "100.00",
      distanciaMaximaEntrePontosDinamico: "50.00",
      // 🆕 Novos campos de distância OSRM/Haversine
      distanciaMaximaEntrePontosOsrm: "50.00",
      distanciaMaximaEntrePontosHaversine: "40.00",
      enderecoEmpresaCep: "",
      enderecoEmpresaLogradouro: "",
      enderecoEmpresaNumero: "",
      enderecoEmpresaComplemento: "",
      enderecoEmpresaBairro: "",
      enderecoEmpresaCidade: "",
      enderecoEmpresaEstado: "",
      // Preços de combustível
      precoCombustivelGasolina: "5.50",
      precoCombustivelEtanol: "3.80",
      precoCombustivelDieselS500: "5.20",
      precoCombustivelDieselS10: "5.80",
      precoCombustivelEletrico: "0.80",
      // Metas operacionais
      metaVariacaoTempoServico: 15,
      metaUtilizacaoDiaria: 80,
      slaHorasPendencia: 48,
      // Mensagens WhatsApp
      whatsappMessageTemplate: "Olá, {nome_cliente}! Sou da {nome_empresa}, estou a caminho para realizar o serviço {nome_servico}. Previsão de chegada: {horario_estimado}.",
      whatsappAppointmentMessageTemplate: "Olá, {nome_cliente}! Confirmamos seu agendamento de {nome_servico} para {data_agendamento}. Endereço: {endereco}.",
      // Aplicativos de mapa do prestador
      providerMapPreference: ["waze", "google_maps"],
    },
  });

  // 🏢 Auto-preenche endereço da empresa nas regras de negócio se ainda não foi salvo
  useEffect(() => {
    if (companyInfo && businessRules && !businessRules.enderecoEmpresaCep) {
      // Buscar detalhes do CEP (para obter o bairro também)
      const fillFromCompany = async () => {
        try {
          const cleanCep = companyInfo.cep?.replace(/\D/g, '') || '';
          let bairro = '';
          if (cleanCep.length === 8) {
            const endereco = await buscarEnderecoPorCep(cleanCep);
            bairro = endereco.bairro || '';
          }
          // Formatar CEP com máscara
          const formattedCep = cleanCep.length === 8
            ? `${cleanCep.slice(0, 5)}-${cleanCep.slice(5)}`
            : companyInfo.cep || '';
          form.setValue('enderecoEmpresaCep', formattedCep);
          form.setValue('enderecoEmpresaLogradouro', companyInfo.logradouro || '');
          form.setValue('enderecoEmpresaNumero', companyInfo.numero || '');
          form.setValue('enderecoEmpresaBairro', bairro);
          form.setValue('enderecoEmpresaCidade', companyInfo.cidade || '');
          form.setValue('enderecoEmpresaEstado', companyInfo.estado || '');
          toast({
            title: "Endereço pré-preenchido",
            description: "Endereço da empresa importado do cadastro. Confirme e salve as regras.",
          });
        } catch (err) {
          // Preencher sem bairro em caso de erro na busca do CEP
          form.setValue('enderecoEmpresaCep', companyInfo.cep || '');
          form.setValue('enderecoEmpresaLogradouro', companyInfo.logradouro || '');
          form.setValue('enderecoEmpresaNumero', companyInfo.numero || '');
          form.setValue('enderecoEmpresaCidade', companyInfo.cidade || '');
          form.setValue('enderecoEmpresaEstado', companyInfo.estado || '');
        }
      };
      fillFromCompany();
    }
  }, [companyInfo, businessRules, form, toast]);

  // Reset form when data loads
  useEffect(() => {
    if (businessRules) {
      form.reset({
        maximoParadasPorRota: businessRules.maximoParadasPorRota,
        tempoDeslocamentoBuffer: businessRules.tempoDeslocamentoBuffer,
        minutosEntreParadas: businessRules.minutosEntreParadas, // ⚠️ DEPRECATED
        distanciaMaximaEntrePontos: businessRules.distanciaMaximaEntrePontos, // ⚠️ DEPRECATED
        distanciaMaximaAtendida: businessRules.distanciaMaximaAtendida,
        distanciaMaximaEntrePontosDinamico: businessRules.distanciaMaximaEntrePontosDinamico,
        // 🆕 Novos campos OSRM/Haversine
        distanciaMaximaEntrePontosOsrm: (businessRules as any).distanciaMaximaEntrePontosOsrm || businessRules.distanciaMaximaEntrePontos || "50.00",
        distanciaMaximaEntrePontosHaversine: (businessRules as any).distanciaMaximaEntrePontosHaversine || String(parseFloat(businessRules.distanciaMaximaEntrePontos || "50") * 0.8),
        enderecoEmpresaCep: businessRules.enderecoEmpresaCep,
        enderecoEmpresaLogradouro: businessRules.enderecoEmpresaLogradouro,
        enderecoEmpresaNumero: businessRules.enderecoEmpresaNumero,
        enderecoEmpresaComplemento: businessRules.enderecoEmpresaComplemento || "",
        enderecoEmpresaBairro: businessRules.enderecoEmpresaBairro,
        enderecoEmpresaCidade: businessRules.enderecoEmpresaCidade,
        enderecoEmpresaEstado: businessRules.enderecoEmpresaEstado,
        // Preços de combustível
        precoCombustivelGasolina: (businessRules as any).precoCombustivelGasolina || "5.50",
        precoCombustivelEtanol: (businessRules as any).precoCombustivelEtanol || "3.80",
        precoCombustivelDieselS500: (businessRules as any).precoCombustivelDieselS500 || "5.20",
        precoCombustivelDieselS10: (businessRules as any).precoCombustivelDieselS10 || "5.80",
        precoCombustivelEletrico: (businessRules as any).precoCombustivelEletrico || "0.80",
        // Metas operacionais
        metaVariacaoTempoServico: (businessRules as any).metaVariacaoTempoServico || 15,
        metaUtilizacaoDiaria: (businessRules as any).metaUtilizacaoDiaria || 80,
        slaHorasPendencia: (businessRules as any).slaHorasPendencia || 48,
        // Mensagens WhatsApp
        whatsappMessageTemplate: (businessRules as any).whatsappMessageTemplate || "Olá, {nome_cliente}! Sou da {nome_empresa}, estou a caminho para realizar o serviço {nome_servico}. Previsão de chegada: {horario_estimado}.",
        whatsappAppointmentMessageTemplate: (businessRules as any).whatsappAppointmentMessageTemplate || "Olá, {nome_cliente}! Confirmamos seu agendamento de {nome_servico} para {data_agendamento}. Endereço: {endereco}.",
        // Aplicativos de mapa do prestador
        providerMapPreference: (businessRules as any).providerMapPreference || ["waze", "google_maps"],
      });
    }
  }, [businessRules, form]);

  const createOrUpdateMutation = useMutation({
    mutationFn: async (data: InsertBusinessRules) => {
      const url = businessRules?.id ? `/api/business-rules/${businessRules.id}` : "/api/business-rules";
      const method = businessRules?.id ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(localStorage.getItem("token") && {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          }),
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao salvar regras de negócio");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/business-rules'] });
      toast({
        title: "Sucesso",
        description: "Regras de negócio salvas com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar regras de negócio.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertBusinessRules) => {
    createOrUpdateMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-burnt-yellow"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 max-w-3xl">
              <TabsTrigger value="rotas" className="flex items-center gap-2">
                <Route className="h-4 w-4" />
                Rotas
              </TabsTrigger>
              {/* Aba Veículos oculta — valores definidos nos registros de abastecimento */}
              <TabsTrigger value="metas" className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Metas
              </TabsTrigger>
              <TabsTrigger value="endereco" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Endereço
              </TabsTrigger>
              <TabsTrigger value="comunicacao" className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                Comunicação
              </TabsTrigger>
            </TabsList>

            {/* Tab: Rotas */}
            <TabsContent value="rotas" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Route className="h-5 w-5" />
                    Configurações de Rota
                  </CardTitle>
                  <CardDescription>
                    Defina os parâmetros para otimização de rotas
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="maximoParadasPorRota"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Máximo de paradas por rota</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              max="50"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* 🆕 Seção de Distância com explicação clara */}
                    <div className="col-span-2 space-y-4">
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 dark:bg-amber-900/20 dark:border-amber-800">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 dark:text-amber-400" />
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                              📏 Distância entre pontos: duas estratégias
                            </p>
                            <p className="text-xs text-amber-700 dark:text-amber-400">
                              • <strong>ROTA REAL (OSRM)</strong>: Distância dirigível considerando malha viária<br />
                              • <strong>ROTA APROXIMADA (Haversine)</strong>: Linha reta, usada como pré-filtro rápido e fallback
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="distanciaMaximaEntrePontosOsrm"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Distância máxima entre pontos — ROTA REAL (km)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.1"
                                  min="1"
                                  max="200"
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                Limite final usando roteamento OSRM (distância dirigível real).
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="distanciaMaximaEntrePontosHaversine"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Distância máxima entre pontos — ROTA APROXIMADA (km)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.1"
                                  min="1"
                                  max="200"
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                Pré-filtro em linha reta. Recomendação: ~20% menor que a rota real.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <FormField
                      control={form.control}
                      name="distanciaMaximaAtendida"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Distância máxima atendida (km)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="1"
                              max="500"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Usada apenas em dias sem agendamentos (distância base → primeiro atendimento).
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="distanciaMaximaEntrePontosDinamico"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Distância dinâmica (km) — Futuro</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="1"
                              max="200"
                              {...field}
                              disabled
                            />
                          </FormControl>
                          <FormDescription>
                            Reservado para cálculo de frete (em desenvolvimento).
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="tempoDeslocamentoBuffer"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tempo de deslocamento (buffer em minutos) — 🚧 Em desenvolvimento</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="5"
                              max="60"
                              {...field}
                              disabled
                            />
                          </FormControl>
                          <FormDescription>
                            Reservado para cálculo de buffer no deslocamento (em desenvolvimento).
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="providerMapPreference"
                      render={() => (
                        <FormItem className="col-span-2 space-y-3 p-4 border rounded-md">
                          <div>
                            <FormLabel className="text-base">Aplicativos de Mapa para Prestadores</FormLabel>
                            <FormDescription>
                              Selecione quais aplicativos estarão disponíveis para o prestador navegar até o cliente. Padrão: Ambos.
                            </FormDescription>
                          </div>
                          <div className="flex gap-4">
                            <FormField
                              control={form.control}
                              name="providerMapPreference"
                              render={({ field }) => {
                                const isWazeChecked = field.value?.includes("waze") ?? true;
                                return (
                                  <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                    <FormControl>
                                      <Checkbox
                                        checked={isWazeChecked}
                                        onCheckedChange={(checked) => {
                                          const prev = field.value || ["waze", "google_maps"];
                                          if (checked) {
                                            field.onChange(Array.from(new Set([...prev, "waze"])));
                                          } else {
                                            field.onChange(prev.filter((c) => c !== "waze"));
                                          }
                                        }}
                                      />
                                    </FormControl>
                                    <FormLabel className="font-normal cursor-pointer">Waze</FormLabel>
                                  </FormItem>
                                );
                              }}
                            />
                            <FormField
                              control={form.control}
                              name="providerMapPreference"
                              render={({ field }) => {
                                const isGoogleChecked = field.value?.includes("google_maps") ?? true;
                                return (
                                  <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                    <FormControl>
                                      <Checkbox
                                        checked={isGoogleChecked}
                                        onCheckedChange={(checked) => {
                                          const prev = field.value || ["waze", "google_maps"];
                                          if (checked) {
                                            field.onChange(Array.from(new Set([...prev, "google_maps"])));
                                          } else {
                                            field.onChange(prev.filter((c) => c !== "google_maps"));
                                          }
                                        }}
                                      />
                                    </FormControl>
                                    <FormLabel className="font-normal cursor-pointer">Google Maps</FormLabel>
                                  </FormItem>
                                );
                              }}
                            />
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab: Veículos (Combustível) — OCULTA (valores definidos nos registros de abastecimento) */}
            <TabsContent value="veiculos" className="mt-6 hidden">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Fuel className="h-5 w-5" />
                    Preços de Combustível
                  </CardTitle>
                  <CardDescription>
                    Configure os preços atuais de combustível para cálculo de custos
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div>
                        <p className="text-sm text-blue-800 font-medium">Dica</p>
                        <p className="text-sm text-blue-700">
                          Atualize os preços mensalmente para cálculos precisos de custo por km no dashboard.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="precoCombustivelGasolina"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gasolina (R$/L)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0.01"
                              max="20"
                              placeholder="5.50"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="precoCombustivelEtanol"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Etanol (R$/L)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0.01"
                              max="20"
                              placeholder="3.80"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="precoCombustivelDieselS500"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Diesel S500 (R$/L)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0.01"
                              max="20"
                              placeholder="5.20"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="precoCombustivelDieselS10"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Diesel S10 (R$/L)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0.01"
                              max="20"
                              placeholder="5.80"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="precoCombustivelEletrico"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Energia Elétrica (R$/kWh)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0.01"
                              max="5"
                              placeholder="0.80"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormDescription>Para veículos elétricos</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab: Metas Operacionais */}
            <TabsContent value="metas" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Metas Operacionais
                  </CardTitle>
                  <CardDescription>
                    Configure as metas para acompanhamento no dashboard
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="metaVariacaoTempoServico"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Variação aceitável do tempo de serviço (%)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="5"
                              max="100"
                              {...field}
                              value={field.value || ""}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                            />
                          </FormControl>
                          <FormDescription>
                            Se o tempo previsto do serviço é 60 min e a variação é 15%,
                            o tempo real pode ser entre 51 e 69 min para ser considerado dentro da meta.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="metaUtilizacaoDiaria"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Meta de utilização diária (%)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="50"
                              max="100"
                              {...field}
                              value={field.value || ""}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                            />
                          </FormControl>
                          <FormDescription>
                            Percentual ideal de tempo em atendimento vs jornada total.
                            Ex: 80% significa 6h24 de atendimentos em uma jornada de 8h.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="slaHorasPendencia"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SLA de resolução de pendências (horas)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              max="168"
                              {...field}
                              value={field.value || ""}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                            />
                          </FormControl>
                          <FormDescription>
                            Tempo máximo entre o prestador finalizar um atendimento com pendência
                            e o administrativo resolver (remarcar, cancelar, etc).
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab: Endereço */}
            <TabsContent value="endereco" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Endereço da Empresa
                  </CardTitle>
                  <CardDescription>
                    Endereço base para cálculo de rotas (ponto de partida padrão)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="enderecoEmpresaCep"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CEP *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="00000-000"
                              maxLength={9}
                              {...field}
                              onChange={async (e) => {
                                let value = e.target.value.replace(/\D/g, '');
                                if (value.length > 5) {
                                  value = value.slice(0, 5) + '-' + value.slice(5, 8);
                                }
                                field.onChange(value);

                                // Busca automática de endereço quando CEP tem 8 dígitos
                                if (value.replace(/\D/g, '').length === 8) {
                                  try {
                                    const endereco = await buscarEnderecoPorCep(value);

                                    // Preenche os campos automaticamente
                                    form.setValue("enderecoEmpresaLogradouro", endereco.logradouro || "");
                                    form.setValue("enderecoEmpresaBairro", endereco.bairro || "");
                                    form.setValue("enderecoEmpresaCidade", endereco.localidade || "");
                                    form.setValue("enderecoEmpresaEstado", endereco.uf || "");

                                  } catch (err) {
                                    toast({
                                      title: "CEP não encontrado",
                                      description: "Preencha o endereço manualmente.",
                                      variant: "destructive",
                                    });
                                    form.setValue("enderecoEmpresaLogradouro", "");
                                    form.setValue("enderecoEmpresaBairro", "");
                                    form.setValue("enderecoEmpresaCidade", "");
                                    form.setValue("enderecoEmpresaEstado", "");
                                  }
                                }
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="enderecoEmpresaNumero"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="123"
                              {...field}
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
                      name="enderecoEmpresaLogradouro"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Logradouro *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Rua das Flores"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="enderecoEmpresaBairro"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bairro *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Centro"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="enderecoEmpresaCidade"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cidade *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="São Paulo"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="enderecoEmpresaEstado"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estado (UF) *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="SP"
                              maxLength={2}
                              {...field}
                              onChange={(e) => {
                                field.onChange(e.target.value.toUpperCase());
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="enderecoEmpresaComplemento"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Complemento</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Sala 101"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab: Comunicação */}
            <TabsContent value="comunicacao" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageCircle className="h-5 w-5" />
                    Mensagens WhatsApp
                  </CardTitle>
                  <CardDescription>
                    Configure as mensagens padrão que serão enviadas aos clientes via WhatsApp
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Seção 1: Mensagem "A Caminho" (Prestadores) */}
                  <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div>
                      <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                        Mensagem "A Caminho" (Para Prestadores)
                      </h3>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Usado quando o prestador clica no botão WhatsApp durante a execução da rota
                      </p>
                    </div>
                    <FormField
                      control={form.control}
                      name="whatsappMessageTemplate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Template da Mensagem</FormLabel>
                          <FormControl>
                            <textarea
                              className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                              placeholder="Digite sua mensagem..."
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Seção 2: Mensagem de Agendamento (Confirmação) */}
                  <div className="space-y-4 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div>
                      <h3 className="font-semibold text-green-900 dark:text-green-100 mb-1">
                        Mensagem de Agendamento (Confirmação)
                      </h3>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        Usado nos cards de agendamento e no histórico de rotas
                      </p>
                    </div>
                    <FormField
                      control={form.control}
                      name="whatsappAppointmentMessageTemplate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Template da Mensagem</FormLabel>
                          <FormControl>
                            <textarea
                              className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                              placeholder="Digite sua mensagem..."
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Card de Variáveis Disponíveis */}
                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">Variáveis Disponíveis:</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <code className="bg-amber-100 dark:bg-amber-900 px-2 py-0.5 rounded text-amber-800 dark:text-amber-200">{'{nome_cliente}'}</code>
                        <span className="text-amber-700 dark:text-amber-300">Nome do cliente</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="bg-amber-100 dark:bg-amber-900 px-2 py-0.5 rounded text-amber-800 dark:text-amber-200">{'{nome_empresa}'}</code>
                        <span className="text-amber-700 dark:text-amber-300">Nome da empresa</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="bg-amber-100 dark:bg-amber-900 px-2 py-0.5 rounded text-amber-800 dark:text-amber-200">{'{nome_servico}'}</code>
                        <span className="text-amber-700 dark:text-amber-300">Serviço agendado</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="bg-amber-100 dark:bg-amber-900 px-2 py-0.5 rounded text-amber-800 dark:text-amber-200">{'{data_agendamento}'}</code>
                        <span className="text-amber-700 dark:text-amber-300">Data do serviço</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="bg-amber-100 dark:bg-amber-900 px-2 py-0.5 rounded text-amber-800 dark:text-amber-200">{'{horario_estimado}'}</code>
                        <span className="text-amber-700 dark:text-amber-300">Horário previsto</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="bg-amber-100 dark:bg-amber-900 px-2 py-0.5 rounded text-amber-800 dark:text-amber-200">{'{endereco}'}</code>
                        <span className="text-amber-700 dark:text-amber-300">Endereço do cliente</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={createOrUpdateMutation.isPending}
              className="bg-burnt-yellow hover:bg-burnt-yellow-dark text-white"
            >
              {createOrUpdateMutation.isPending ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar Regras
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}