import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  acceptInvitationNewUserSchema,
  type AcceptInvitationNewUserData,
} from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth, getAuthHeaders } from "@/lib/auth";
import { buildApiUrl } from "@/lib/api-config";
import { Loader2, Building2, UserPlus, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Link } from "wouter";

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const [isValidating, setIsValidating] = useState(true);
  const [inviteData, setInviteData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<AcceptInvitationNewUserData>({
    resolver: zodResolver(acceptInvitationNewUserSchema),
    defaultValues: {
      token: token || "",
    },
  });

  const password = watch("password");

  // Validar convite ao carregar
  useEffect(() => {
    const validateInvite = async () => {
      try {
        const response = await fetch(buildApiUrl(`/api/invitations/${token}`));
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Convite inválido");
        }

        setInviteData(data);
      } catch (err: any) {
        setError(err.message || "Erro ao validar convite");
      } finally {
        setIsValidating(false);
      }
    };

    if (token) {
      validateInvite();
    }
  }, [token]);

  // Se usuário já está logado, aceitar com conta existente
  const acceptWithExistingAccount = async () => {
    try {
      setIsAccepting(true);

      const response = await fetch(buildApiUrl(`/api/invitations/${token}/accept-existing`), {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Erro ao aceitar convite");
      }

      toast({
        title: "✅ Convite aceito!",
        description: `Você agora faz parte de ${inviteData.invitation.company.name}`,
      });

      // Redirecionar para dashboard após 1 segundo
      setTimeout(() => {
        setLocation("/");
      }, 1000);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "❌ Erro ao aceitar convite",
        description: err.message,
      });
    } finally {
      setIsAccepting(false);
    }
  };

  // Se usuário não tem conta, criar nova
  const onSubmitNewUser = async (data: AcceptInvitationNewUserData) => {
    try {
      setIsAccepting(true);

      const response = await fetch(buildApiUrl(`/api/invitations/${token}/accept-new`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Erro ao aceitar convite");
      }

      // Salvar token de autenticação
      localStorage.setItem("token", result.token);

      setSuccess(true);
      toast({
        title: "✅ Conta criada e convite aceito!",
        description: "Redirecionando para o sistema...",
      });

      // Redirecionar para dashboard após 2 segundos
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "❌ Erro ao aceitar convite",
        description: err.message,
      });
    } finally {
      setIsAccepting(false);
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      ADMIN: "Administrador",
      ADMINISTRATIVO: "Administrativo",
      OPERADOR: "Operador",
    };
    return labels[role] || role;
  };

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-[#DAA520] mb-4" />
            <p className="text-gray-600">Validando convite...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
            <CardTitle className="text-2xl">Convite Inválido</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-900">
                  <strong>Possíveis motivos:</strong>
                </p>
                <ul className="text-sm text-yellow-800 mt-2 space-y-1 list-disc list-inside">
                  <li>O convite expirou (válido por 7 dias)</li>
                  <li>O convite já foi usado</li>
                  <li>O link está incorreto</li>
                </ul>
              </div>
              <Button asChild className="w-full">
                <Link href="/login">Voltar para Login</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Bem-vindo!</CardTitle>
            <CardDescription>
              Conta criada com sucesso. Redirecionando...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-[#DAA520] bg-opacity-10 flex items-center justify-center">
            <Building2 className="h-8 w-8 text-[#DAA520]" />
          </div>
          <CardTitle className="text-2xl">Você foi convidado!</CardTitle>
          <CardDescription>
            {inviteData?.invitation?.company?.name} convidou você para usar o Rota Fácil
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Informações do Convite */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-blue-700">Empresa:</span>
                <span className="font-semibold text-blue-900">
                  {inviteData?.invitation?.company?.name}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-blue-700">Papel:</span>
                <span className="font-semibold text-blue-900">
                  {getRoleLabel(inviteData?.invitation?.role)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-blue-700">E-mail:</span>
                <span className="font-semibold text-blue-900">
                  {inviteData?.invitation?.email}
                </span>
              </div>
            </div>

            {/* Se usuário já está logado */}
            {user ? (
              <div className="space-y-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-green-900">
                        Você está logado como:
                      </p>
                      <p className="text-sm text-green-800">{user.email}</p>
                    </div>
                  </div>
                </div>

                {user.email === inviteData?.invitation?.email ? (
                  <Button
                    onClick={acceptWithExistingAccount}
                    className="w-full bg-[#DAA520] hover:bg-[#B8860B]"
                    disabled={isAccepting}
                  >
                    {isAccepting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Aceitando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Aceitar Convite
                      </>
                    )}
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-900">
                        Este convite foi enviado para <strong>{inviteData?.invitation?.email}</strong>,
                        mas você está logado como <strong>{user.email}</strong>.
                      </p>
                    </div>
                    <Button
                      asChild
                      variant="outline"
                      className="w-full"
                    >
                      <Link href="/logout">Sair e usar outro e-mail</Link>
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              /* Se usuário não tem conta, mostrar formulário de cadastro */
              <div>
                {inviteData?.hasAccount ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-900">
                        Você já tem uma conta com este e-mail. Faça login para aceitar o convite.
                      </p>
                    </div>
                    <Button
                      asChild
                      className="w-full bg-[#DAA520] hover:bg-[#B8860B]"
                    >
                      <Link href="/login">Fazer Login</Link>
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit(onSubmitNewUser)} className="space-y-4">
                    <div>
                      <Label htmlFor="name">Nome Completo *</Label>
                      <Input
                        id="name"
                        {...register("name")}
                        placeholder="João Silva"
                      />
                      {errors.name && (
                        <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="password">Senha *</Label>
                      <Input
                        id="password"
                        type="password"
                        {...register("password")}
                        placeholder="Mínimo 8 caracteres"
                      />
                      {errors.password && (
                        <p className="text-sm text-red-500 mt-1">{errors.password.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="confirmPassword">Confirmar Senha *</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        {...register("confirmPassword")}
                        placeholder="Digite a senha novamente"
                      />
                      {errors.confirmPassword && (
                        <p className="text-sm text-red-500 mt-1">
                          {errors.confirmPassword.message}
                        </p>
                      )}
                    </div>

                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <p className="text-xs text-gray-700">
                        <strong>Requisitos de senha:</strong>
                      </p>
                      <ul className="text-xs text-gray-600 mt-1 space-y-0.5 list-disc list-inside">
                        <li>Mínimo 8 caracteres</li>
                        <li>Pelo menos uma letra maiúscula</li>
                        <li>Pelo menos uma letra minúscula</li>
                        <li>Pelo menos um número</li>
                      </ul>
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-[#DAA520] hover:bg-[#B8860B]"
                      disabled={isAccepting}
                    >
                      {isAccepting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Criando conta...
                        </>
                      ) : (
                        <>
                          <UserPlus className="mr-2 h-4 w-4" />
                          Criar Conta e Aceitar Convite
                        </>
                      )}
                    </Button>
                  </form>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
