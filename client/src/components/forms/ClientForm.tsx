import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { extendedInsertClientSchema, type InsertClient, type Client } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, Mail, Phone, MapPin } from "lucide-react";

interface ClientFormProps {
  client?: Client | null;
  onClose: () => void;
}

export default function ClientForm({ client, onClose }: ClientFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const form = useForm<InsertClient>({
    resolver: zodResolver(extendedInsertClientSchema),
    defaultValues: client ? {
      name: client.name,
      email: client.email || "",
      phone1: client.phone1 || "",
      phone2: client.phone2 || "",
      cpf: client.cpf || "",
      cep: client.cep,
      logradouro: client.logradouro,
      numero: client.numero,
      complemento: client.complemento || "",
      observacoes: client.observacoes || "",
    } : {
      name: "",
      email: "",
      phone1: "",
      phone2: "",
      cpf: "",
      cep: "",
      logradouro: "",
      numero: "",
      complemento: "",
      observacoes: "",
    },
  });

  const createClientMutation = useMutation({
    mutationFn: async (data: InsertClient) => {
      const response = await apiRequest("POST", "/api/clients", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Sucesso",
        description: "Cliente criado com sucesso",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar cliente",
        variant: "destructive",
      });
    },
  });

  const updateClientMutation = useMutation({
    mutationFn: async (data: InsertClient) => {
      const response = await apiRequest("PUT", `/api/clients/${client!.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Sucesso",
        description: "Cliente atualizado com sucesso",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar cliente",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertClient) => {
    if (client) {
      updateClientMutation.mutate(data);
    } else {
      createClientMutation.mutate(data);
    }
  };

  const isLoading = createClientMutation.isPending || updateClientMutation.isPending;

  return (
    <div className="space-y-6">
      <DialogHeader>
        <DialogTitle className="flex items-center">
          <Users className="h-5 w-5 mr-2 text-burnt-yellow" />
          {client ? "Editar Cliente" : "Novo Cliente"}
        </DialogTitle>
      </DialogHeader>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="name">Nome *</Label>
          <Input
            {...form.register("name")}
            placeholder="Nome da empresa ou pessoa"
            className="mt-1"
          />
          {form.formState.errors.name && (
            <p className="text-sm text-red-600 mt-1">{form.formState.errors.name.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="email" className="flex items-center">
            <Mail className="h-4 w-4 mr-1" />
            Email
          </Label>
          <Input
            {...form.register("email")}
            type="email"
            placeholder="email@exemplo.com"
            className="mt-1"
          />
          {form.formState.errors.email && (
            <p className="text-sm text-red-600 mt-1">{form.formState.errors.email.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="cpf">CPF</Label>
          <Input
            {...form.register("cpf")}
            placeholder="000.000.000-00"
            className="mt-1"
            maxLength={14}
            onChange={(e) => {
              let value = e.target.value.replace(/\D/g, '');
              if (value.length > 11) {
                value = value.slice(0, 11);
              }
              value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4');
              e.target.value = value;
              form.setValue("cpf", value);
            }}
          />
          {form.formState.errors.cpf && (
            <p className="text-sm text-red-600 mt-1">{form.formState.errors.cpf.message}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="phone1" className="flex items-center">
              <Phone className="h-4 w-4 mr-1" />
              Telefone 1 *
            </Label>
            <Input
              {...form.register("phone1")}
              placeholder="(11) 99999-9999"
              className="mt-1"
              maxLength={15}
              onChange={(e) => {
                let value = e.target.value.replace(/\D/g, '');
                if (value.length > 11) {
                  value = value.slice(0, 11);
                }
                if (value.length <= 10) {
                  value = value.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
                } else {
                  value = value.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
                }
                e.target.value = value;
                form.setValue("phone1", value);
              }}
            />
            {form.formState.errors.phone1 && (
              <p className="text-sm text-red-600 mt-1">{form.formState.errors.phone1.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="phone2" className="flex items-center">
              <Phone className="h-4 w-4 mr-1" />
              Telefone 2
            </Label>
            <Input
              {...form.register("phone2")}
              placeholder="(11) 99999-9999"
              className="mt-1"
              maxLength={15}
              onChange={(e) => {
                let value = e.target.value.replace(/\D/g, '');
                if (value.length > 11) {
                  value = value.slice(0, 11);
                }
                if (value.length <= 10) {
                  value = value.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
                } else {
                  value = value.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
                }
                e.target.value = value;
                form.setValue("phone2", value);
              }}
            />
            {form.formState.errors.phone2 && (
              <p className="text-sm text-red-600 mt-1">{form.formState.errors.phone2.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="cep">CEP *</Label>
            <Input
              {...form.register("cep")}
              placeholder="00000-000"
              maxLength={9}
              className="mt-1"
              onChange={(e) => {
                let value = e.target.value.replace(/\D/g, '');
                if (value.length > 5) {
                  value = value.slice(0, 5) + '-' + value.slice(5, 8);
                }
                form.setValue("cep", value);
              }}
            />
            {form.formState.errors.cep && (
              <p className="text-sm text-red-600 mt-1">{form.formState.errors.cep.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="numero">Número *</Label>
            <Input
              {...form.register("numero")}
              placeholder="123"
              className="mt-1"
            />
            {form.formState.errors.numero && (
              <p className="text-sm text-red-600 mt-1">{form.formState.errors.numero.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="complemento">Complemento</Label>
            <Input
              {...form.register("complemento")}
              placeholder="Apto 123"
              className="mt-1"
            />
            {form.formState.errors.complemento && (
              <p className="text-sm text-red-600 mt-1">{form.formState.errors.complemento.message}</p>
            )}
          </div>
        </div>

        <div>
          <Label htmlFor="logradouro" className="flex items-center">
            <MapPin className="h-4 w-4 mr-1" />
            Logradouro *
          </Label>
          <Input
            {...form.register("logradouro")}
            placeholder="Rua, Av, etc."
            className="mt-1"
          />
          {form.formState.errors.logradouro && (
            <p className="text-sm text-red-600 mt-1">{form.formState.errors.logradouro.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="observacoes">Observações</Label>
          <Textarea
            {...form.register("observacoes")}
            placeholder="Observações sobre o cliente..."
            className="mt-1 min-h-[80px]"
          />
          {form.formState.errors.observacoes && (
            <p className="text-sm text-red-600 mt-1">{form.formState.errors.observacoes.message}</p>
          )}
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
            {client ? "Atualizar" : "Criar"} Cliente
          </Button>
        </div>
      </form>
    </div>
  );
}
