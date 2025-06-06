import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Settings, Save, Clock, MapPin, Route } from "lucide-react";
import { insertBusinessRulesSchema, type BusinessRules, type InsertBusinessRules } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

export default function BusinessRules() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: businessRules, isLoading } = useQuery<BusinessRules>({
    queryKey: ['/api/business-rules'],
    enabled: !!user,
  });

  const form = useForm<InsertBusinessRules>({
    resolver: zodResolver(insertBusinessRulesSchema),
    defaultValues: {
      maximoParadasPorRota: 10,
      horarioInicioTrabalho: "08:00",
      horarioFimTrabalho: "18:00",
      tempoDeslocamentoBuffer: 15,
      minutosEntreParadas: 30,
      distanciaMaximaEntrePontos: "50.00",
      enderecoEmpresaCep: "",
      enderecoEmpresaLogradouro: "",
      enderecoEmpresaNumero: "",
      enderecoEmpresaComplemento: "",
      areaOperacao: "Cidade",
    },
  });

  // Reset form when data loads
  useState(() => {
    if (businessRules) {
      form.reset({
        maximoParadasPorRota: businessRules.maximoParadasPorRota,
        horarioInicioTrabalho: businessRules.horarioInicioTrabalho,
        horarioFimTrabalho: businessRules.horarioFimTrabalho,
        tempoDeslocamentoBuffer: businessRules.tempoDeslocamentoBuffer,
        minutosEntreParadas: businessRules.minutosEntreParadas,
        distanciaMaximaEntrePontos: businessRules.distanciaMaximaEntrePontos,
        enderecoEmpresaCep: businessRules.enderecoEmpresaCep,
        enderecoEmpresaLogradouro: businessRules.enderecoEmpresaLogradouro,
        enderecoEmpresaNumero: businessRules.enderecoEmpresaNumero,
        enderecoEmpresaComplemento: businessRules.enderecoEmpresaComplemento || "",
        areaOperacao: businessRules.areaOperacao,
      });
    }
  });

  const createOrUpdateMutation = useMutation({
    mutationFn: async (data: InsertBusinessRules) => {
      if (businessRules?.id) {
        return await apiRequest(`/api/business-rules/${businessRules.id}`, "PATCH", data);
      } else {
        return await apiRequest("/api/business-rules", "POST", data);
      }
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
          <h1 className="text-3xl font-bold text-gray-900">Regras de Negócio</h1>
          <p className="text-gray-600">Configure as regras operacionais do seu negócio</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Configurações de Rota */}
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
              </CardContent>
            </Card>

            {/* Horário de Trabalho */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Horário de Trabalho
                </CardTitle>
                <CardDescription>
                  Configure os horários de funcionamento
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="horarioInicioTrabalho"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Horário de início</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
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
                      <FormLabel>Horário de fim</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="areaOperacao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Área de operação</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: São Paulo, Rio de Janeiro"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>

          {/* Endereço da Empresa */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Endereço da Empresa
              </CardTitle>
              <CardDescription>
                Endereço base para cálculo de rotas
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
                          onChange={(e) => {
                            let value = e.target.value.replace(/\D/g, '');
                            if (value.length > 5) {
                              value = value.slice(0, 5) + '-' + value.slice(5, 8);
                            }
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
                  name="enderecoEmpresaComplemento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Complemento</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Sala 101"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

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