import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";
import { buildApiUrl } from "@/lib/api-config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import UserForm from "@/components/forms/UserForm";
import { Plus, Edit, Trash2, Mail, Shield, CheckCircle, XCircle, RefreshCw } from "lucide-react";
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
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
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

  // Query para buscar usuários
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch(buildApiUrl("/api/users"), {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error('Erro ao carregar usuários');
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
  });

  // Mutation para deletar usuário
  const deleteMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await fetch(buildApiUrl(`/api/users/${userId}`), {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao deletar usuário');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Usuário deletado",
        description: "O usuário foi removido com sucesso.",
      });
      setUserToDelete(null);
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

  const handleDelete = (user: User) => {
    setUserToDelete(user);
  };

  const confirmDelete = () => {
    if (userToDelete) {
      deleteMutation.mutate(userToDelete.id);
    }
  };

  const handleResendEmail = (userId: number) => {
    resendEmailMutation.mutate(userId);
  };

  const getRoleBadge = (role: string) => {
    if (role === 'admin') {
      return <Badge className="bg-purple-500"><Shield className="w-3 h-3 mr-1" />Admin</Badge>;
    }
    return <Badge variant="secondary">Usuário</Badge>;
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
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-2xl font-bold flex items-center gap-2">
                <Shield className="w-6 h-6" />
                Gerenciamento de Usuários
              </CardTitle>
              <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogTrigger asChild>
                  <Button onClick={handleNew}>
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Usuário
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {selectedUser ? 'Editar Usuário' : 'Novo Usuário'}
                    </DialogTitle>
                  </DialogHeader>
                  <UserForm
                    user={selectedUser}
                    onSuccess={() => {
                      setIsFormOpen(false);
                      setSelectedUser(null);
                      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
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
              ) : users.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum usuário cadastrado ainda.
                </div>
              ) : (
                <div className="space-y-4">
                  {users.map((user: User) => (
                    <Card key={user.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-3">
                              <h3 className="font-semibold text-lg">{user.name}</h3>
                              {getRoleBadge(user.role)}
                              {getPlanBadge(user.plan)}
                              {user.isActive ? (
                                <Badge variant="outline" className="text-green-600 border-green-600">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Ativo
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-red-600 border-red-600">
                                  <XCircle className="w-3 h-3 mr-1" />
                                  Inativo
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Mail className="w-4 h-4" />
                                {user.email}
                              </div>
                              <div>
                                Username: <span className="font-mono">{user.username}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                              {user.emailVerified ? (
                                <Badge variant="outline" className="text-green-600 border-green-600">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Email Verificado
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-orange-600 border-orange-600">
                                  <Mail className="w-3 h-3 mr-1" />
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

                          <div className="flex items-center gap-2">
                            {!user.emailVerified && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleResendEmail(user.id)}
                                disabled={resendEmailMutation.isPending}
                              >
                                <RefreshCw className={`w-4 h-4 ${resendEmailMutation.isPending ? 'animate-spin' : ''}`} />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(user)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(user)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedules" className="space-y-4">
          <AccessSchedules />
        </TabsContent>
      </Tabs>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o usuário <strong>{userToDelete?.name}</strong>?
              Esta ação não pode ser desfeita e todos os dados associados serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
