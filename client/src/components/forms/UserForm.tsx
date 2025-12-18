import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";
import InputMask from "react-input-mask";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { createUserByAdminSchema, updateUserByAdminSchema } from "@shared/schema";
import type { User, CreateUserByAdmin, UpdateUserByAdmin, AccessSchedule } from "@shared/schema";
import { z } from "zod";

// Função para buscar endereço por CEP
async function buscarEnderecoPorCep(cep: string) {
  const url = `https://viacep.com.br/ws/${cep.replace(/\D/g, '')}/json/`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.erro) throw new Error("CEP não encontrado");
  return data;
}

interface UserFormProps {
  user?: User | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function UserForm({ user, onSuccess, onCancel }: UserFormProps) {
  const { toast } = useToast();
  const isEditing = !!user;

  // Schema condicional: criar vs editar
  const schema = isEditing ? updateUserByAdminSchema : createUserByAdminSchema;
  type FormData = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: isEditing && user
      ? {
        name: user.name,
        username: user.username,
        role: user.role as "admin" | "user" | "operador",
        phone: user.phone || "",
        cep: user.cep || "",
        logradouro: user.logradouro || "",
        numero: user.numero || "",
        complemento: user.complemento || "",
        bairro: user.bairro || "",
        cidade: user.cidade || "",
        estado: user.estado || "",
        isActive: user.isActive,
        accessScheduleId: user.accessScheduleId,
      }
      : {
        role: "user" as const,
      },
  });

  const role = watch("role");
  const isActive = watch("isActive");
  const cep = watch("cep");
  const accessScheduleId = watch("accessScheduleId");

  // Query para buscar tabelas de horário
  const { data: accessSchedules = [] } = useQuery({
    queryKey: ["/api/access-schedules"],
    queryFn: async () => {
      const response = await fetch("/api/access-schedules", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
  });

  // Buscar CEP automaticamente
  const handleCepBlur = async () => {
    const cepValue = cep?.replace(/\D/g, '');
    if (cepValue && cepValue.length === 8) {
      try {
        const endereco = await buscarEnderecoPorCep(cepValue);
        setValue("logradouro", endereco.logradouro || "");
        setValue("bairro", endereco.bairro || "");
        setValue("cidade", endereco.localidade || "");
        setValue("estado", endereco.uf || "");

        toast({
          title: "CEP encontrado",
          description: "Endereço preenchido automaticamente",
        });
      } catch (error) {
        toast({
          title: "CEP não encontrado",
          description: "Verifique o CEP e preencha o endereço manualmente",
          variant: "destructive",
        });
      }
    }
  };

  // Mutation para criar/atualizar usuário
  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const url = isEditing ? `/api/users/${user.id}` : "/api/users";
      const method = isEditing ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao salvar usuário");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: isEditing ? "Usuário atualizado" : "Usuário criado",
        description: isEditing
          ? "Os dados do usuário foram atualizados com sucesso."
          : `Usuário criado com sucesso. Um email de verificação foi enviado para ${data.user?.email || data.email}.`,
      });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Nome */}
        <div className="space-y-2">
          <Label htmlFor="name">
            Nome Completo <span className="text-red-500">*</span>
          </Label>
          <Input
            id="name"
            {...register("name")}
            placeholder="João da Silva"
            disabled={isSubmitting}
          />
          {errors.name && (
            <p className="text-sm text-red-500">{errors.name.message}</p>
          )}
        </div>

        {/* Email - somente na criação */}
        {!isEditing && (
          <div className="space-y-2">
            <Label htmlFor="email">
              Email <span className="text-red-500">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              {...register("email" as any)}
              placeholder="joao@exemplo.com"
              disabled={isSubmitting}
            />
            {(errors as any).email && (
              <p className="text-sm text-red-500">{(errors as any).email.message}</p>
            )}
          </div>
        )}

        {/* Username - somente na criação */}
        {!isEditing && (
          <div className="space-y-2">
            <Label htmlFor="username">
              Nome de Usuário <span className="text-red-500">*</span>
            </Label>
            <Input
              id="username"
              {...register("username")}
              placeholder="joaosilva"
              disabled={isSubmitting}
            />
            {errors.username && (
              <p className="text-sm text-red-500">{errors.username.message}</p>
            )}
          </div>
        )}

        {/* Telefone */}
        <div className="space-y-2">
          <Label htmlFor="phone">Telefone</Label>
          <InputMask
            mask="(99) 99999-9999"
            {...register("phone")}
            disabled={isSubmitting}
          >
            {(inputProps: any) => (
              <Input
                {...inputProps}
                id="phone"
                placeholder="(11) 99999-9999"
              />
            )}
          </InputMask>
          {errors.phone && (
            <p className="text-sm text-red-500">{errors.phone.message}</p>
          )}
        </div>

        {/* Perfil */}
        <div className="space-y-2">
          <Label htmlFor="role">
            Perfil <span className="text-red-500">*</span>
          </Label>
          <Select
            value={role}
            onValueChange={(value) => setValue("role", value as "admin" | "user" | "operador")}
            disabled={isSubmitting}
          >
            <SelectTrigger id="role">
              <SelectValue placeholder="Selecione o perfil" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user">Prestador</SelectItem>
              <SelectItem value="operador">Operador</SelectItem>
              <SelectItem value="admin">Administrador</SelectItem>
            </SelectContent>
          </Select>
          {errors.role && (
            <p className="text-sm text-red-500">{errors.role.message}</p>
          )}
        </div>

        {/* Tabela de Horário de Acesso */}
        <div className="space-y-2">
          <Label htmlFor="accessScheduleId">Tabela de Horário de Acesso</Label>
          <Select
            value={accessScheduleId ? String(accessScheduleId) : "none"}
            onValueChange={(value) => setValue("accessScheduleId", value === "none" ? null : Number(value))}
            disabled={isSubmitting}
          >
            <SelectTrigger id="accessScheduleId">
              <SelectValue placeholder="Sem restrição de horário" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem restrição de horário</SelectItem>
              {accessSchedules.map((schedule: AccessSchedule) => (
                <SelectItem key={schedule.id} value={String(schedule.id)}>
                  {schedule.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Deixe vazio para permitir acesso sem restrição de horário
          </p>
          {(errors as any).accessScheduleId && (
            <p className="text-sm text-red-500">{(errors as any).accessScheduleId.message}</p>
          )}
        </div>
      </div>

      {/* Endereço */}
      <div className="space-y-4 border-t pt-4">
        <h3 className="font-semibold text-lg">Endereço</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* CEP */}
          <div className="space-y-2">
            <Label htmlFor="cep">CEP</Label>
            <InputMask
              mask="99999-999"
              {...register("cep")}
              disabled={isSubmitting}
              onBlur={handleCepBlur}
            >
              {(inputProps: any) => (
                <Input
                  {...inputProps}
                  id="cep"
                  placeholder="00000-000"
                />
              )}
            </InputMask>
            {errors.cep && (
              <p className="text-sm text-red-500">{errors.cep.message}</p>
            )}
          </div>

          {/* Logradouro */}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="logradouro">Logradouro</Label>
            <Input
              id="logradouro"
              {...register("logradouro")}
              placeholder="Rua, Avenida..."
              disabled={isSubmitting}
            />
            {errors.logradouro && (
              <p className="text-sm text-red-500">{errors.logradouro.message}</p>
            )}
          </div>

          {/* Número */}
          <div className="space-y-2">
            <Label htmlFor="numero">Número</Label>
            <Input
              id="numero"
              {...register("numero")}
              placeholder="123"
              disabled={isSubmitting}
            />
            {errors.numero && (
              <p className="text-sm text-red-500">{errors.numero.message}</p>
            )}
          </div>

          {/* Complemento */}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="complemento">Complemento</Label>
            <Input
              id="complemento"
              {...register("complemento")}
              placeholder="Apto, Bloco..."
              disabled={isSubmitting}
            />
            {errors.complemento && (
              <p className="text-sm text-red-500">{errors.complemento.message}</p>
            )}
          </div>

          {/* Bairro */}
          <div className="space-y-2">
            <Label htmlFor="bairro">Bairro</Label>
            <Input
              id="bairro"
              {...register("bairro")}
              placeholder="Centro"
              disabled={isSubmitting}
            />
            {errors.bairro && (
              <p className="text-sm text-red-500">{errors.bairro.message}</p>
            )}
          </div>

          {/* Cidade */}
          <div className="space-y-2">
            <Label htmlFor="cidade">Cidade</Label>
            <Input
              id="cidade"
              {...register("cidade")}
              placeholder="São Paulo"
              disabled={isSubmitting}
            />
            {errors.cidade && (
              <p className="text-sm text-red-500">{errors.cidade.message}</p>
            )}
          </div>

          {/* Estado */}
          <div className="space-y-2">
            <Label htmlFor="estado">Estado</Label>
            <Input
              id="estado"
              {...register("estado")}
              placeholder="SP"
              maxLength={2}
              disabled={isSubmitting}
            />
            {errors.estado && (
              <p className="text-sm text-red-500">{errors.estado.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Status - somente na edição */}
      {isEditing && (
        <div className="space-y-2 border-t pt-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="isActive"
              checked={isActive}
              onCheckedChange={(checked) => setValue("isActive", checked)}
              disabled={isSubmitting}
            />
            <Label htmlFor="isActive">Usuário ativo</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Desative para bloquear o acesso do usuário ao sistema
          </p>
        </div>
      )}

      {!isEditing && (
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
            ℹ️ Processo de Criação
          </h4>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
            <li>Uma senha temporária será gerada automaticamente</li>
            <li>Um email de verificação será enviado para o endereço fornecido</li>
            <li>O usuário deverá verificar o email e criar sua própria senha</li>
            <li>O acesso só será permitido após a verificação e criação de senha</li>
            <li>O plano será definido como "Básico" automaticamente</li>
          </ul>
        </div>
      )}

      {/* Botões */}
      <div className="flex justify-end gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "Salvando..."
            : isEditing
              ? "Atualizar"
              : "Criar Usuário"}
        </Button>
      </div>
    </form>
  );
}
