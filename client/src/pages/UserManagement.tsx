import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";
import { buildApiUrl } from "@/lib/api-config";
import { normalizeItems } from "@/lib/normalize";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import UserForm from "@/components/forms/UserForm";
import { Plus, Edit, Trash2, Mail, Shield, CheckCircle, XCircle, RefreshCw, UserX, UserCheck, X, Send, Clock, Calendar } from "lucide-react";
import { useSafeNavigation } from "@/hooks/useSafeNavigation";
import type { User } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AccessSchedules from "./AccessSchedules";

export default function UserManagement() {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [userToDeactivate, setUserToDeactivate] = useState<User | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Hook de navegação segura
  const { isSafeToOperate } = useSafeNavigation({
    componentName: 'USER_MANAGEMENT',
    modals: [
      {
        isOpen: isFormOpen,
        setIsOpen: setIsFormOpen,
        resetState: () => setSelectedUser(null)
      }
    ]
  });

  // Query para buscar usuários (3 grupos)
  const { data: usersData, isLoading } = useQuery({
    queryKey: ["/api/company/users"],
    queryFn: async () => {
      const response = await fetch(buildApiUrl("/api/company/users"), {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error('Erro ao carregar usuários');
      }
      return await response.json();
    },
  });
  
  // Separar os 3 grupos
  const activeUsers = normalizeItems<User>(usersData?.activeUsers || []);
  const inactiveUsers = normalizeItems<User>(usersData?.inactiveUsers || []);
  const pendingInvites = usersData?.pendingInvites || [];

  // Mutation para desativar usuário
  const deactivateMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await fetch(buildApiUrl(`/api/company/users/${userId}/deactivate`), {
        method: "PATCH",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao desativar usuário');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/users"] });
      toast({
        title: "Usuário desativado",
        description: "O acesso do usuário foi desativado nesta empresa.",
      });
      setUserToDeactivate(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para reativar usuário
  const reactivateMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await fetch(buildApiUrl(`/api/company/users/${userId}/reactivate`), {
        method: "PATCH",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao reativar usuário');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/users"] });
      toast({
        title: "Usuário reativado",
        description: "O acesso do usuário foi reativado nesta empresa.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para reenviar convite pendente
  const resendInviteMutation = useMutation({
    mutationFn: async (invitationId: number) => {
      const response = await fetch(buildApiUrl(`/api/invitations/${invitationId}/resend`), {
        method: "PATCH",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao reenviar convite');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/users"] });
      toast({
        title: "Convite reenviado",
        description: "O convite foi reenviado com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para cancelar convite pendente
  const cancelInviteMutation = useMutation({
    mutationFn: async (invitationId: number) => {
      const response = await fetch(buildApiUrl(`/api/invitations/${invitationId}/cancel`), {
        method: "PATCH",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao cancelar convite');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/users"] });
      toast({
        title: "Convite cancelado",
        description: "O convite foi cancelado com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para reenviar email de verificação
  const resendEmailMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await fetch(buildApiUrl(`/api/users/${userId}/resend-verification`), {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao reenviar email');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Email reenviado",
        description: "Um novo email de verificação foi enviado ao usuário.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setIsFormOpen(true);
  };

  const handleNew = () => {
    setSelectedUser(null);
    setIsFormOpen(true);
  };

  const handleDeactivate = (user: User) => {
    setUserToDeactivate(user);
  };

  const confirmDeactivate = () => {
    if (userToDeactivate) {
      deactivateMutation.mutate(userToDeactivate.id);
    }
  };

  const handleReactivate = (userId: number) => {
    reactivateMutation.mutate(userId);
  };

  const handleResendEmail = (userId: number) => {
    resendEmailMutation.mutate(userId);
  };

  const handleResendInvite = (invitationId: number) => {
    resendInviteMutation.mutate(invitationId);
  };

  const handleCancelInvite = (invitationId: number) => {
    cancelInviteMutation.mutate(invitationId);
  };

  const getRoleBadge = (role: string) => {
    const roleLabels: Record<string, { label: string; color: string }> = {
      admin: { label: 'Administrador', color: 'bg-purple-500' },
      operador: { label: 'Operador', color: 'bg-blue-500' },
      tecnico: { label: 'Técnico', color: 'bg-teal-500' },
      prestador: { label: 'Prestador', color: 'bg-orange-500' },
      user: { label: 'Usuário', color: 'bg-gray-500' },
    };
    const roleInfo = roleLabels[role] || { label: role, color: 'bg-gray-500' };
    return (
      <Badge className={roleInfo.color}>
        {role === 'admin' && <Shield className="w-3 h-3 mr-1" />}
        {roleInfo.label}
      </Badge>
    );
  };

  const getPlanBadge = (plan: string) => {
    const planLabels: Record<string, string> = {
      basic: 'Básico',
      professional: 'Profissional',
      enterprise: 'Empresarial',
      custom: 'Personalizado'
    };

    const colors: Record<string, string> = {
      basic: 'bg-gray-500',
      professional: 'bg-blue-500',
      enterprise: 'bg-green-500',
      custom: 'bg-orange-500'
    };

    return (
      <Badge className={colors[plan] || 'bg-gray-500'}>
        {planLabels[plan] || plan}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="schedules">Tabelas de Horário</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0 pb-4">
              <CardTitle className="text-xl sm:text-2xl font-bold flex items-center gap-2 w-full sm:w-auto break-words">
                <Shield className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                <span>Gerenciamento de Usuários</span>
              </CardTitle>
              <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogTrigger asChild>
                  <Button onClick={handleNew} className="w-full sm:w-auto shrink-0">
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Usuário
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90dvh] sm:max-h-[90vh] overflow-hidden p-0 flex flex-col">
                  <DialogHeader className="p-6 pb-4 border-b shrink-0">
                    <DialogTitle>
                      {selectedUser ? 'Editar Usuário' : 'Novo Usuário'}
                    </DialogTitle>
                  </DialogHeader>
                  <UserForm
                    user={selectedUser}
                    onSuccess={() => {
                      setIsFormOpen(false);
                      setSelectedUser(null);
                      queryClient.invalidateQueries({ queryKey: ["/api/company/users"] });
                    }}
                    onCancel={() => {
                      setIsFormOpen(false);
                      setSelectedUser(null);
                    }}
                  />
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">Carregando usuários...</div>
              ) : (
                <div className="space-y-6">
                  {/* Usuários Ativos */}
                  {activeUsers.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        Usuários Ativos ({activeUsers.length})
                      </h3>
                      <div className="space-y-2">
                        {activeUsers.map((user: User) => (
                    <Card key={user.id} className="overflow-hidden">
                      <CardContent className="p-4 min-w-0">
                        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                          <div className="flex-1 space-y-3 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold text-lg max-w-full truncate">{user.name}</h3>
                              {getRoleBadge(user.role)}
                              {getPlanBadge(user.plan)}
                              {user.isActive ? (
                                <Badge variant="outline" className="text-green-600 border-green-600 shrink-0">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Ativo
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-red-600 border-red-600 shrink-0">
                                  <XCircle className="w-3 h-3 mr-1" />
                                  Inativo
                                </Badge>
                              )}
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1 min-w-0">
                                <Mail className="w-4 h-4 shrink-0" />
                                <span className="truncate">{user.email}</span>
                              </div>
                              <div className="min-w-0 truncate">
                                Username: <span className="font-mono">{user.username}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                              {user.emailVerified ? (
                                <Badge variant="outline" className="text-green-600 border-green-600">
                                  <CheckCircle className="w-3 h-3 mr-1 shrink-0" />
                                  Email Verificado
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-orange-600 border-orange-600">
                                  <Mail className="w-3 h-3 mr-1 shrink-0" />
                                  Email Pendente
                                </Badge>
                              )}

                              {user.requirePasswordChange && (
                                <Badge variant="outline" className="text-blue-600 border-blue-600">
                                  Requer Troca de Senha
                                </Badge>
                              )}
                            </div>

                            {user.lastLoginAt && (
                              <div className="text-xs text-muted-foreground">
                                Último acesso: {new Date(user.lastLoginAt).toLocaleString('pt-BR')}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 w-full lg:w-auto justify-end border-t lg:border-t-0 pt-3 lg:pt-0">
                            {!user.emailVerified && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleResendEmail(user.id)}
                                disabled={resendEmailMutation.isPending}
                                className="flex-1 lg:flex-none"
                              >
                                <RefreshCw className={`w-4 h-4 ${resendEmailMutation.isPending ? 'animate-spin' : ''}`} />
                                <span className="lg:hidden ml-2">Reenviar</span>
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(user)}
                              className="flex-1 lg:flex-none"
                            >
                              <Edit className="w-4 h-4" />
                              <span className="lg:hidden ml-2">Editar</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeactivate(user)}
                              className="flex-1 lg:flex-none text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-orange-200"
                            >
                              <UserX className="w-4 h-4" />
                              <span className="lg:hidden ml-2">Desativar</span>
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Usuários Inativos */}
                  {inactiveUsers.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-red-600" />
                        Usuários Desativados ({inactiveUsers.length})
                      </h3>
                      <div className="space-y-2">
                        {inactiveUsers.map((user: User) => (
                          <Card key={user.id} className="bg-gray-50 border-gray-200">
                            <CardContent className="p-4">
                              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2 mb-2">
                                    <h3 className="font-semibold text-lg max-w-full truncate">{user.name}</h3>
                                    {getRoleBadge(user.role)}
                                    <Badge variant="outline" className="text-red-600 border-red-600 shrink-0">
                                      <XCircle className="w-3 h-3 mr-1" />
                                      INATIVO
                                    </Badge>
                                  </div>
                                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-1 min-w-0">
                                      <Mail className="w-4 h-4 shrink-0" />
                                      <span className="truncate">{user.email}</span>
                                    </div>
                                  </div>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleReactivate(user.id)}
                                  disabled={reactivateMutation.isPending}
                                  className="w-full lg:w-auto text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
                                >
                                  <UserCheck className="w-4 h-4" />
                                  <span className="ml-2">Reativar Acesso</span>
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Convites Pendentes */}
                  {pendingInvites.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        Convites Pendentes ({pendingInvites.length})
                      </h3>
                      <div className="space-y-2">
                        {pendingInvites.map((invite: any) => (
                          <Card key={invite.id} className="bg-yellow-50 border-yellow-200">
                            <CardContent className="p-4">
                              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Mail className="w-5 h-5 text-yellow-600 shrink-0" />
                                    <h3 className="font-semibold text-lg truncate">{invite.displayName || invite.email}</h3>
                                    <Badge variant="outline" className="text-yellow-700 border-yellow-700 shrink-0">
                                      Pendente
                                    </Badge>
                                  </div>

                                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-1 min-w-0">
                                      <Mail className="w-4 h-4 shrink-0" />
                                      <span className="truncate">{invite.email}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Shield className="w-4 h-4 shrink-0" />
                                      <span>{getRoleBadge(invite.role)}</span>
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                                    <div className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3 shrink-0" />
                                      <span>Criado: {new Date(invite.createdAt).toLocaleDateString('pt-BR')}</span>
                                    </div>
                                    {invite.resentAt && (
                                      <div className="flex items-center gap-1">
                                        <RefreshCw className="w-3 h-3 shrink-0" />
                                        <span>Reenviado: {new Date(invite.resentAt).toLocaleDateString('pt-BR')}</span>
                                      </div>
                                    )}
                                    {invite.expiresAt && (
                                      <div className="flex items-center gap-1">
                                        <Clock className="w-3 h-3 shrink-0" />
                                        <span>Expira: {new Date(invite.expiresAt).toLocaleDateString('pt-BR')}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 w-full lg:w-auto justify-end border-t lg:border-t-0 pt-3 lg:pt-0">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleResendInvite(invite.id)}
                                    disabled={resendInviteMutation.isPending}
                                    className="flex-1 lg:flex-none"
                                  >
                                    <Send className={`w-4 h-4 ${resendInviteMutation.isPending ? 'animate-pulse' : ''}`} />
                                    <span className="lg:hidden ml-2">Reenviar</span>
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleCancelInvite(invite.id)}
                                    disabled={cancelInviteMutation.isPending}
                                    className="flex-1 lg:flex-none text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                  >
                                    <X className="w-4 h-4" />
                                    <span className="lg:hidden ml-2">Cancelar</span>
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Mensagem de vazio */}
                  {activeUsers.length === 0 && inactiveUsers.length === 0 && pendingInvites.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhum usuário cadastrado ainda.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedules" className="space-y-4">
          <AccessSchedules />
        </TabsContent>
      </Tabs>

      {/* Dialog de confirmação de desativação */}
      <AlertDialog open={!!userToDeactivate} onOpenChange={() => setUserToDeactivate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Desativação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja desativar o acesso de <strong>{userToDeactivate?.name}</strong> nesta empresa?
              O usuário não poderá mais acessar o sistema desta empresa, mas poderá ser reativado a qualquer momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeactivate}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
