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

  const form = useForm<InsertBusinessRules>({
    resolver: zodResolver(insertBusinessRulesSchema),
    defaultValues: {
      maximoParadasPorRota: 10,
      tempoDeslocamentoBuffer: 15,
      minutosEntreParadas: 30,
      distanciaMaximaEntrePontos: "50.00",
      distanciaMaximaAtendida: "100.00",
      distanciaMaximaEntrePontosDinamico: "50.00",
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
      // Mensagem WhatsApp
      whatsappMessageTemplate: "Olá, {nome_cliente}! Sou da {nome_empresa}, estou a caminho para realizar o serviço {nome_servico}. Previsão de chegada: {horario_estimado}.",
    },
  });

  // Reset form when data loads
  useEffect(() => {
    if (businessRules) {
      form.reset({
        maximoParadasPorRota: businessRules.maximoParadasPorRota,
        tempoDeslocamentoBuffer: businessRules.tempoDeslocamentoBuffer,
        minutosEntreParadas: businessRules.minutosEntreParadas,
        distanciaMaximaEntrePontos: businessRules.distanciaMaximaEntrePontos,
        distanciaMaximaAtendida: businessRules.distanciaMaximaAtendida,
        distanciaMaximaEntrePontosDinamico: businessRules.distanciaMaximaEntrePontosDinamico,
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
        // Mensagem WhatsApp
        whatsappMessageTemplate: (businessRules as any).whatsappMessageTemplate || "Olá, {nome_cliente}! Sou da {nome_empresa}, estou a caminho para realizar o serviço {nome_servico}. Previsão de chegada: {horario_estimado}.",
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
      <div className="flex items-center gap-3">
        <div className="p-2 bg-burnt-yellow rounded-lg">
          <Settings className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-zinc-100">Regras de Negócio</h1>
          <p className="text-gray-600">Configure as regras operacionais do seu negócio</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5 max-w-3xl">
              <TabsTrigger value="rotas" className="flex items-center gap-2">
                <Route className="h-4 w-4" />
                Rotas
              </TabsTrigger>
              <TabsTrigger value="veiculos" className="flex items-center gap-2">
                <Fuel className="h-4 w-4" />
                Veículos
              </TabsTrigger>
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

                    <FormField
                      control={form.control}
                      name="minutosEntreParadas"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Minutos entre paradas</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="5"
                              max="120"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="distanciaMaximaEntrePontos"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Distância máxima entre pontos (km)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="1"
                              max="200"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

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
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="distanciaMaximaEntrePontosDinamico"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Distância máxima entre pontos dinâmico (km)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="1"
                              max="200"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="tempoDeslocamentoBuffer"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tempo de deslocamento (buffer em minutos)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="5"
                              max="60"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
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

            {/* Tab: Veículos (Combustível) */}
            <TabsContent value="veiculos" className="mt-6">
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
                    Mensagem WhatsApp para Prestadores
                  </CardTitle>
                  <CardDescription>
                    Configure a mensagem padrão que será enviada aos clientes via WhatsApp
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="whatsappMessageTemplate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mensagem Padrão</FormLabel>
                        <FormControl>
                          <textarea
                            className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder="Digite sua mensagem..."
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-800 mb-2">Variáveis Disponíveis:</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <code className="bg-blue-100 px-2 py-0.5 rounded text-blue-700">{'{nome_cliente}'}</code>
                        <span className="text-blue-600">Nome do cliente</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="bg-blue-100 px-2 py-0.5 rounded text-blue-700">{'{nome_empresa}'}</code>
                        <span className="text-blue-600">Nome da empresa</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="bg-blue-100 px-2 py-0.5 rounded text-blue-700">{'{nome_servico}'}</code>
                        <span className="text-blue-600">Serviço agendado</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="bg-blue-100 px-2 py-0.5 rounded text-blue-700">{'{data_agendamento}'}</code>
                        <span className="text-blue-600">Data do serviço</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="bg-blue-100 px-2 py-0.5 rounded text-blue-700">{'{horario_estimado}'}</code>
                        <span className="text-blue-600">Horário previsto</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="bg-blue-100 px-2 py-0.5 rounded text-blue-700">{'{endereco}'}</code>
                        <span className="text-blue-600">Endereço do cliente</span>
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