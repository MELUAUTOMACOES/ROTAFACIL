import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { extendedInsertTechnicianSchema, type InsertTechnician, type Technician, type Service, type User } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserCog, Mail, Phone, Wrench, MapPin, FileText, Clock as ClockIcon, Camera, X } from "lucide-react";
import { useState, useRef } from "react";

// Função para buscar endereço por CEP - igual ao cadastro de cliente
async function buscarEnderecoPorCep(cep: string) {
  const url = `https://viacep.com.br/ws/${cep.replace(/\D/g, '')}/json/`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.erro) throw new Error("CEP não encontrado");
  return data; // {logradouro, bairro, localidade, uf, ...}
}

interface TechnicianFormProps {
  technician?: Technician | null;
  services: Service[];
  onClose: () => void;
}

export default function TechnicianForm({ technician, services, onClose }: TechnicianFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(technician?.photoUrl || null);

  const { data: users = [] } = useQuery<User[]>({ 
    queryKey: ["/api/users"] 
  });

  const form = useForm<InsertTechnician>({
    resolver: zodResolver(extendedInsertTechnicianSchema),
    defaultValues: technician ? {
      linkedUserId: technician.linkedUserId || undefined,
      name: technician.name,
      email: technician.email || "",
      phone: technician.phone,
      documento: technician.documento,
      cep: technician.cep,
      logradouro: technician.logradouro,
      numero: technician.numero,
      complemento: technician.complemento || "",
      bairro: technician.bairro || "",
      cidade: technician.cidade || "",
      estado: technician.estado || "",
      specialization: technician.specialization || "",
      observacoes: technician.observacoes || "",
      serviceIds: technician.serviceIds || [],
      // Campos de endereço de início diário
      enderecoInicioCep: technician.enderecoInicioCep || "",
      enderecoInicioLogradouro: technician.enderecoInicioLogradouro || "",
      enderecoInicioNumero: technician.enderecoInicioNumero || "",
      enderecoInicioComplemento: technician.enderecoInicioComplemento || "",
      enderecoInicioBairro: technician.enderecoInicioBairro || "",
      enderecoInicioCidade: technician.enderecoInicioCidade || "",
      enderecoInicioEstado: technician.enderecoInicioEstado || "",
      // Horários de trabalho
      horarioInicioTrabalho: technician.horarioInicioTrabalho || "08:00",
      horarioFimTrabalho: technician.horarioFimTrabalho || "18:00",
      horarioAlmocoMinutos: technician.horarioAlmocoMinutos || 60,
      diasTrabalho: technician.diasTrabalho || ['segunda', 'terca', 'quarta', 'quinta', 'sexta'],
      isActive: technician.isActive,
      photoUrl: technician.photoUrl || "",
    } : {
      linkedUserId: undefined,
      name: "",
      email: "",
      phone: "",
      documento: "",
      cep: "",
      logradouro: "",
      numero: "",
      complemento: "",
      bairro: "",
      cidade: "",
      estado: "",
      specialization: "",
      observacoes: "",
      serviceIds: [],
      // Campos de endereço de início diário
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
      isActive: true,
      photoUrl: "",
    },
  });

  const createTechnicianMutation = useMutation({
    mutationFn: async (data: InsertTechnician) => {
      console.log('🔄 TechnicianForm - Iniciando criação de técnico:', data);
      const response = await apiRequest("POST", "/api/technicians", data);
      const result = await response.json();
      console.log('📦 TechnicianForm - Resposta recebida:', result);
      return result;
    },
    onSuccess: (result) => {
      console.log('✅ TechnicianForm - Técnico criado com sucesso:', result);

      // Mostrar toast de sucesso imediatamente
      toast({
        title: "Sucesso",
        description: "Técnico criado com sucesso",
      });

      // Fechar modal primeiro para evitar conflitos DOM
      console.log('🚪 TechnicianForm - Fechando modal antes de invalidar cache');
      onClose();

      // Invalidar cache após o modal ser fechado
      requestAnimationFrame(() => {
        console.log('🔃 TechnicianForm - Invalidando cache após fechamento do modal');
        queryClient.invalidateQueries({ queryKey: ["/api/technicians"] });
        console.log('✨ TechnicianForm - Processo de criação finalizado');
      });
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
      const result = await response.json();
      console.log('📦 TechnicianForm - Resposta da atualização recebida:', result);
      return result;
    },
    onSuccess: (result) => {
      console.log('✅ TechnicianForm - Técnico atualizado com sucesso:', result);

      // Mostrar toast de sucesso imediatamente
      toast({
        title: "Sucesso",
        description: "Técnico atualizado com sucesso",
      });

      // Fechar modal primeiro para evitar conflitos DOM
      console.log('🚪 TechnicianForm - Fechando modal antes de invalidar cache (atualização)');
      onClose();

      // Invalidar cache após o modal ser fechado
      requestAnimationFrame(() => {
        console.log('🔃 TechnicianForm - Invalidando cache após fechamento do modal (atualização)');
        queryClient.invalidateQueries({ queryKey: ["/api/technicians"] });
        console.log('✨ TechnicianForm - Processo de atualização finalizado');
      });
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
    <div className="flex flex-col h-full max-h-[90vh] min-h-0">
      <div className="p-6 pb-4 border-b shrink-0 bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <UserCog className="h-5 w-5 mr-2 text-burnt-yellow" />
            {technician ? "Editar Técnico" : "Novo Técnico"}
          </DialogTitle>
        </DialogHeader>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">

          {/* Upload de Foto do Técnico */}
          <div className="flex items-center gap-4">
            <div className="relative">
              {photoPreview ? (
                <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-burnt-yellow">
                  <img src={photoPreview} alt="Foto do técnico" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-zinc-600">
                  <Camera className="w-8 h-8 text-gray-400 dark:text-zinc-500" />
                </div>
              )}
              {photoPreview && (
                <button
                  type="button"
                  onClick={() => {
                    setPhotoPreview(null);
                    form.setValue("photoUrl", "");
                  }}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="flex-1">
              <Label className="text-sm font-medium">Foto do Técnico</Label>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mb-2">
                Foto para identificação no mapa em tempo real (máx. 200KB)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  if (file.size > 200 * 1024) {
                    toast({
                      title: "Arquivo muito grande",
                      description: "A foto deve ter no máximo 200KB",
                      variant: "destructive",
                    });
                    return;
                  }

                  const reader = new FileReader();
                  reader.onload = (event) => {
                    const base64 = event.target?.result as string;
                    setPhotoPreview(base64);
                    form.setValue("photoUrl", base64);
                  };
                  reader.readAsDataURL(file);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="w-4 h-4 mr-2" />
                {photoPreview ? "Alterar foto" : "Adicionar foto"}
              </Button>
            </div>
          </div>

          {/* Seleção de Usuário Vinculado */}
          <FormField
            control={form.control}
            name="linkedUserId"
            render={({ field }) => (
              <FormItem className="mb-4 p-4 border border-amber-200 dark:border-amber-900 rounded-md bg-amber-50/50 dark:bg-amber-900/10">
                <FormLabel className="text-amber-800 dark:text-amber-500 font-semibold">Vincular a Usuário do Sistema *</FormLabel>
                <Select
                  onValueChange={(value) => {
                    const id = parseInt(value);
                    field.onChange(id);
                    // Preencher dados baseados no usuário selecionado
                    const selectedUser = users.find((u: User) => u.id === id);
                    if (selectedUser) {
                      form.setValue("name", selectedUser.name);
                      form.setValue("email", selectedUser.email || "");
                      if (selectedUser.phone) form.setValue("phone", selectedUser.phone);
                      if (selectedUser.cep) form.setValue("cep", selectedUser.cep);
                      if (selectedUser.logradouro) form.setValue("logradouro", selectedUser.logradouro);
                      if (selectedUser.numero) form.setValue("numero", selectedUser.numero);
                      if (selectedUser.complemento) form.setValue("complemento", selectedUser.complemento);
                      if (selectedUser.bairro) form.setValue("bairro", selectedUser.bairro);
                      if (selectedUser.cidade) form.setValue("cidade", selectedUser.cidade);
                      if (selectedUser.estado) form.setValue("estado", selectedUser.estado);
                    }
                  }}
                  value={field.value ? String(field.value) : undefined}
                >
                  <FormControl>
                    <SelectTrigger className="border-amber-300 dark:border-amber-700 bg-white dark:bg-zinc-800">
                      <SelectValue placeholder="Selecione um usuário para vincular sua conta a este técnico" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Usuários da Empresa</SelectLabel>
                      {users.map((user: User) => (
                        <SelectItem key={user.id} value={String(user.id)}>
                          {user.name} ({user.email}) - {user.role?.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FormMessage />
                <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-1">
                  Os dados pessoais abaixo serão preenchidos automaticamente e não podem ser editados aqui.
                </p>
              </FormItem>
            )}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Nome completo do técnico" 
                      {...field} 
                      readOnly
                      className="bg-gray-100 dark:bg-zinc-800 text-gray-500 cursor-not-allowed border-dashed"
                    />
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
                  <FormLabel>CPF / CNPJ *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="000.000.000-00 ou 00.000.000/0001-00"
                      maxLength={18}
                      {...field}
                      onChange={(e) => {
                        let digits = e.target.value.replace(/\D/g, '');
                        // Limitar a 14 dígitos (CNPJ)
                        digits = digits.slice(0, 14);
                        let value = '';
                        if (digits.length <= 11) {
                          // Máscara CPF: 000.000.000-00
                          if (digits.length > 3) value = digits.slice(0, 3) + '.' + digits.slice(3);
                          else value = digits;
                          if (digits.length > 6) value = digits.slice(0, 3) + '.' + digits.slice(3, 6) + '.' + digits.slice(6);
                          if (digits.length > 9) value = digits.slice(0, 3) + '.' + digits.slice(3, 6) + '.' + digits.slice(6, 9) + '-' + digits.slice(9);
                        } else {
                          // Máscara CNPJ: 00.000.000/0001-00
                          value = digits.slice(0, 2) + '.' + digits.slice(2, 5) + '.' + digits.slice(5, 8) + '/' + digits.slice(8, 12) + '-' + digits.slice(12, 14);
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
                      readOnly
                      className="bg-gray-100 dark:bg-zinc-800 text-gray-500 cursor-not-allowed border-dashed"
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
                      readOnly
                      className="bg-gray-100 dark:bg-zinc-800 text-gray-500 cursor-not-allowed border-dashed"
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
                        readOnly
                        className="bg-gray-100 dark:bg-zinc-800 text-gray-500 cursor-not-allowed border-dashed"
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
                        readOnly
                        className="bg-gray-100 dark:bg-zinc-800 text-gray-500 cursor-not-allowed border-dashed"
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
                      <Input 
                        placeholder="Rua das Flores" 
                        {...field} 
                        readOnly 
                        className="bg-gray-100 dark:bg-zinc-800 text-gray-500 cursor-not-allowed border-dashed" 
                      />
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
                      <Input 
                        placeholder="Apto 123" 
                        {...field} 
                        value={field.value || ""} 
                        readOnly 
                        className="bg-gray-100 dark:bg-zinc-800 text-gray-500 cursor-not-allowed border-dashed" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bairro"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bairro *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Centro" 
                        {...field} 
                        readOnly 
                        className="bg-gray-100 dark:bg-zinc-800 text-gray-500 cursor-not-allowed border-dashed" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cidade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cidade *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="São Paulo" 
                        {...field} 
                        readOnly 
                        className="bg-gray-100 dark:bg-zinc-800 text-gray-500 cursor-not-allowed border-dashed" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="estado"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado (UF) *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="SP" 
                        maxLength={2} 
                        {...field} 
                        readOnly 
                        className="bg-gray-100 dark:bg-zinc-800 text-gray-500 cursor-not-allowed border-dashed" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Endereço de Início Diário (Opcional) */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-500" />
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
                    <FormLabel>CEP</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="00000-000"
                        maxLength={9}
                        {...field}
                        value={field.value || ""}
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
                              form.setValue("enderecoInicioLogradouro", endereco.logradouro || "");
                              form.setValue("enderecoInicioBairro", endereco.bairro || "");
                              form.setValue("enderecoInicioCidade", endereco.localidade || "");
                              form.setValue("enderecoInicioEstado", endereco.uf || "");

                            } catch (err) {
                              toast({
                                title: "CEP não encontrado",
                                description: "Preencha o endereço manualmente.",
                                variant: "destructive",
                              });
                              form.setValue("enderecoInicioLogradouro", "");
                              form.setValue("enderecoInicioBairro", "");
                              form.setValue("enderecoInicioCidade", "");
                              form.setValue("enderecoInicioEstado", "");
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
              Defina os horários e dias de trabalho do técnico. Estes horários serão usados para calcular a disponibilidade.
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
                            id={`day-${day.value}`}
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
                            htmlFor={`day-${day.value}`}
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

          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 p-6 pt-4 border-t bg-gray-50/50 shrink-0 mt-auto">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full sm:w-auto bg-black text-white hover:bg-gray-800"
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