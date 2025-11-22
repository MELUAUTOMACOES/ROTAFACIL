import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createInvitationSchema, type CreateInvitationData } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";
import { Loader2, UserPlus, Users, Mail, Clock, CheckCircle2, XCircle } from "lucide-react";
import Layout from "@/components/Layout";

export default function CompanyUsers() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<CreateInvitationData>({
    resolver: zodResolver(createInvitationSchema),
  });

  // Buscar usuários e convites
  const { data, isLoading } = useQuery({
    queryKey: ["company-users"],
    queryFn: async () => {
      const response = await fetch("/api/company/users", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Erro ao buscar usuários");
      return response.json();
    },
  });

  // Mutation para criar convite
  const createInvite = useMutation({
    mutationFn: async (data: CreateInvitationData) => {
      const response = await fetch("/api/company/users/invite", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao enviar convite");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "✅ Convite enviado!",
        description: "O usuário receberá um e-mail com o link para aceitar o convite.",
      });
      queryClient.invalidateQueries({ queryKey: ["company-users"] });
      setDialogOpen(false);
      reset();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "❌ Erro ao enviar convite",
        description: error.message,
      });
    },
  });

  const onSubmit = (data: CreateInvitationData) => {
    createInvite.mutate(data);
  };

  const getRoleBadge = (role: string) => {
    const variants: Record<string, { label: string; color: string }> = {
      ADMIN: { label: "Administrador", color: "bg-purple-100 text-purple-800" },
      ADMINISTRATIVO: { label: "Administrativo", color: "bg-blue-100 text-blue-800" },
      OPERADOR: { label: "Operador", color: "bg-green-100 text-green-800" },
    };
    const variant = variants[role] || { label: role, color: "bg-gray-100 text-gray-800" };
    return <Badge className={variant.color}>{variant.label}</Badge>;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Usuários da Empresa</h1>
            <p className="text-gray-600 mt-1">Gerencie os usuários e convites pendentes</p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#DAA520] hover:bg-[#B8860B]">
                <UserPlus className="mr-2 h-4 w-4" />
                Convidar Usuário
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Convidar Novo Usuário</DialogTitle>
                <DialogDescription>
                  Envie um convite por e-mail para um novo usuário entrar na empresa
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <Label htmlFor="email">E-mail *</Label>
                  <Input
                    id="email"
                    type="email"
                    {...register("email")}
                    placeholder="usuario@example.com"
                  />
                  {errors.email && (
                    <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="role">Papel *</Label>
                  <Select onValueChange={(value) => setValue("role", value as any)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o papel..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">Administrador</SelectItem>
                      <SelectItem value="ADMINISTRATIVO">Administrativo</SelectItem>
                      <SelectItem value="OPERADOR">Operador</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.role && (
                    <p className="text-sm text-red-500 mt-1">{errors.role.message}</p>
                  )}
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-900">
                    <strong>Sobre os papéis:</strong>
                  </p>
                  <ul className="text-xs text-blue-800 mt-1 space-y-1 list-disc list-inside">
                    <li><strong>Administrador:</strong> Acesso total, gerencia usuários</li>
                    <li><strong>Administrativo:</strong> Gerencia agendamentos, técnicos, clientes</li>
                    <li><strong>Operador:</strong> Visualiza apenas suas rotas/atendimentos</li>
                  </ul>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-[#DAA520] hover:bg-[#B8860B]"
                    disabled={createInvite.isPending}
                  >
                    {createInvite.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        Enviar Convite
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[#DAA520]" />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {/* Usuários Ativos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-[#DAA520]" />
                  Usuários Ativos
                </CardTitle>
                <CardDescription>
                  Membros da equipe que já têm acesso ao sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data?.users?.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhum usuário cadastrado ainda</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>E-mail</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Papel</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.users?.map((user: any) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>{user.phone || "-"}</TableCell>
                          <TableCell>{getRoleBadge(user.role)}</TableCell>
                          <TableCell>
                            {user.emailVerified ? (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                <CheckCircle2 className="mr-1 h-3 w-3" />
                                Ativo
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                                <Clock className="mr-1 h-3 w-3" />
                                Pendente
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Convites Pendentes */}
            {data?.pendingInvites?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5 text-[#DAA520]" />
                    Convites Pendentes
                  </CardTitle>
                  <CardDescription>
                    Usuários que foram convidados mas ainda não aceitaram
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>E-mail</TableHead>
                        <TableHead>Papel</TableHead>
                        <TableHead>Enviado em</TableHead>
                        <TableHead>Expira em</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.pendingInvites.map((invite: any) => (
                        <TableRow key={invite.id}>
                          <TableCell className="font-medium">{invite.email}</TableCell>
                          <TableCell>{getRoleBadge(invite.role)}</TableCell>
                          <TableCell>
                            {new Date(invite.createdAt).toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell>
                            {new Date(invite.expiresAt).toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell>
                            {new Date(invite.expiresAt) > new Date() ? (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                <Clock className="mr-1 h-3 w-3" />
                                Aguardando
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                <XCircle className="mr-1 h-3 w-3" />
                                Expirado
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
