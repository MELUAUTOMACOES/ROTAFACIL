import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { extendedInsertTechnicianSchema, type InsertTechnician, type Technician, type Service } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserCog, Mail, Phone, Wrench, MapPin, FileText } from "lucide-react";

interface TechnicianFormProps {
  technician?: Technician | null;
  services: Service[];
  onClose: () => void;
}

export default function TechnicianForm({ technician, services, onClose }: TechnicianFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const form = useForm<InsertTechnician>({
    resolver: zodResolver(extendedInsertTechnicianSchema),
    defaultValues: technician ? {
      name: technician.name,
      email: technician.email || "",
      phone: technician.phone,
      documento: technician.documento,
      cep: technician.cep,
      logradouro: technician.logradouro,
      numero: technician.numero,
      complemento: technician.complemento || "",
      specialization: technician.specialization || "",
      observacoes: technician.observacoes || "",
      serviceIds: technician.serviceIds || [],
      isActive: technician.isActive,
    } : {
      name: "",
      email: "",
      phone: "",
      documento: "",
      cep: "",
      logradouro: "",
      numero: "",
      complemento: "",
      specialization: "",
      observacoes: "",
      serviceIds: [],
      isActive: true,
    },
  });

  const createTechnicianMutation = useMutation({
    mutationFn: async (data: InsertTechnician) => {
      console.log('🔄 TechnicianForm - Iniciando criação de técnico:', data);
      const response = await apiRequest("POST", "/api/technicians", data);
      return response.json();
    },
    onSuccess: (result) => {
      console.log('✅ TechnicianForm - Técnico criado com sucesso:', result);
      // Usar setTimeout para evitar conflitos DOM na invalidação
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/technicians"] });
        console.log('🔃 TechnicianForm - Cache invalidado após criação');
      }, 100);
      
      toast({
        title: "Sucesso",
        description: "Técnico criado com sucesso",
      });
      
      // Fechar com delay para evitar conflito DOM
      setTimeout(() => {
        onClose();
        console.log('🚪 TechnicianForm - Formulário fechado após criação');
      }, 150);
    },
    onError: (error: Error) => {
      console.error('❌ TechnicianForm - Erro ao criar técnico:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar técnico",
        variant: "destructive",
      });
    },
  });

  const updateTechnicianMutation = useMutation({
    mutationFn: async (data: InsertTechnician) => {
      console.log('🔄 TechnicianForm - Iniciando atualização de técnico:', { id: technician?.id, data });
      const response = await apiRequest("PUT", `/api/technicians/${technician?.id}`, data);
      return response.json();
    },
    onSuccess: (result) => {
      console.log('✅ TechnicianForm - Técnico atualizado com sucesso:', result);
      // Usar setTimeout para evitar conflitos DOM na invalidação
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/technicians"] });
        console.log('🔃 TechnicianForm - Cache invalidado após atualização');
      }, 100);
      
      toast({
        title: "Sucesso",
        description: "Técnico atualizado com sucesso",
      });
      
      // Fechar com delay para evitar conflito DOM
      setTimeout(() => {
        onClose();
        console.log('🚪 TechnicianForm - Formulário fechado após atualização');
      }, 150);
    },
    onError: (error: Error) => {
      console.error('❌ TechnicianForm - Erro ao atualizar técnico:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar técnico",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertTechnician) => {
    if (technician) {
      updateTechnicianMutation.mutate(data);
    } else {
      createTechnicianMutation.mutate(data);
    }
  };

  const isLoading = createTechnicianMutation.isPending || updateTechnicianMutation.isPending;

  return (
    <div className="space-y-6 max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center">
          <UserCog className="h-5 w-5 mr-2 text-burnt-yellow" />
          {technician ? "Editar Técnico" : "Novo Técnico"}
        </DialogTitle>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome *</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome completo do técnico" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="documento"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CPF *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="000.000.000-00"
                      maxLength={14}
                      {...field}
                      onChange={(e) => {
                        let value = e.target.value.replace(/\D/g, '');
                        if (value.length > 3) value = value.slice(0, 3) + '.' + value.slice(3);
                        if (value.length > 7) value = value.slice(0, 7) + '.' + value.slice(7);
                        if (value.length > 11) value = value.slice(0, 11) + '-' + value.slice(11, 13);
                        field.onChange(value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    Email
                  </FormLabel>
                  <FormControl>
                    <Input 
                      type="email" 
                      placeholder="email@exemplo.com" 
                      {...field} 
                      value={field.value || ""} 
                      onChange={(e) => {
                        // Validação de email: deve conter @ para ser válido
                        const value = e.target.value;
                        field.onChange(value);
                        if (value && !value.includes('@')) {
                          form.setError('email', { 
                            type: 'manual', 
                            message: 'Email deve conter o caractere @' 
                          });
                        } else {
                          form.clearErrors('email');
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
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1">
                    <Phone className="h-4 w-4" />
                    Telefone *
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="(11) 99999-9999" 
                      {...field} 
                      onChange={(e) => {
                        // Formatação automática do telefone: aceitar apenas números e formatar
                        let value = e.target.value.replace(/\D/g, '');
                        if (value.length <= 10) {
                          // Formato: (XX)XXXX-XXXX
                          if (value.length > 2) value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
                          if (value.length > 9) value = value.slice(0, 9) + '-' + value.slice(9);
                        } else {
                          // Formato: (XX)XXXXX-XXXX
                          if (value.length > 2) value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
                          if (value.length > 10) value = value.slice(0, 10) + '-' + value.slice(10, 14);
                        }
                        field.onChange(value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-gray-500" />
              <h3 className="text-lg font-medium">Endereço</h3>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="cep"
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
                name="numero"
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
                name="logradouro"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Logradouro *</FormLabel>
                    <FormControl>
                      <Input placeholder="Rua das Flores" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="complemento"
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
            </div>
          </div>

          <FormField
            control={form.control}
            name="specialization"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-1">
                  <Wrench className="h-4 w-4" />
                  Especialização
                </FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Eletricista, Encanador, Ar Condicionado" {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="observacoes"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  Observações
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Observações sobre o técnico..."
                    className="min-h-[80px]"
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Seleção de Serviços */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-gray-500" />
              <h3 className="text-lg font-medium">Tipos de Serviços</h3>
            </div>
            
            <FormField
              control={form.control}
              name="serviceIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Serviços que o Técnico Atende</FormLabel>
                  <div className="border rounded-lg p-4 max-h-48 overflow-y-auto">
                    {!services || services.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">
                        Nenhum serviço cadastrado. Cadastre serviços primeiro para vincular aos técnicos.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {services.map((service) => (
                          <div key={service.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`service-${service.id}`}
                              checked={field.value?.includes(service.id.toString()) || false}
                              onCheckedChange={(checked) => {
                                const currentIds = field.value || [];
                                const serviceIdStr = service.id.toString();
                                if (checked) {
                                  field.onChange([...currentIds, serviceIdStr]);
                                } else {
                                  field.onChange(currentIds.filter(id => id !== serviceIdStr));
                                }
                              }}
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
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="isActive"
              checked={form.watch("isActive")}
              onCheckedChange={(checked) => form.setValue("isActive", checked)}
            />
            <Label htmlFor="isActive">Técnico ativo</Label>
          </div>

          <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
            <Button 
              type="button" 
              variant="outline"
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading}
              className="bg-black text-white hover:bg-gray-800"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              ) : null}
              {technician ? "Atualizar" : "Criar"} Técnico
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}