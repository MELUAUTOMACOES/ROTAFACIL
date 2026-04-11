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
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth, getAuthHeaders } from "@/lib/auth";
import { buildApiUrl } from "@/lib/api-config";
import { Loader2, Building2, UserPlus, CheckCircle2, XCircle, AlertCircle, Eye, EyeOff } from "lucide-react";
import { Link } from "wouter";

// Versão atual dos termos LGPD — incrementar ao atualizar os termos
const LGPD_VERSION = "v1.0-2025-01";

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();

  const [isValidating, setIsValidating] = useState(true);
  const [inviteData, setInviteData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<AcceptInvitationNewUserData>({
    resolver: zodResolver(acceptInvitationNewUserSchema),
    defaultValues: {
      token: token || "",
      lgpdVersion: LGPD_VERSION,
    },
  });

  // Pré-preenche o token e a versão LGPD quando o token muda
  useEffect(() => {
    if (token) setValue("token", token);
    setValue("lgpdVersion", LGPD_VERSION);
  }, [token, setValue]);

  // Validar convite ao carregar
  useEffect(() => {
    const validateInvite = async () => {
      try {
        const url = buildApiUrl(`/api/invitations/${token}`);
        const response = await fetch(url);
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

      const url = buildApiUrl(`/api/invitations/${token}/accept-existing`);
      const response = await fetch(url, {
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

  // Novo usuário: define username + senha + aceita LGPD
  const onSubmitNewUser = async (data: AcceptInvitationNewUserData) => {
    try {
      setIsAccepting(true);

      const url = buildApiUrl(`/api/invitations/${token}/accept-new`);
      const response = await fetch(url, {
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
        title: "✅ Conta ativada!",
        description: "Redirecionando para o sistema...",
      });

      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "❌ Erro ao ativar conta",
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
                  <li>O convite foi cancelado pelo administrador</li>
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
              Conta ativada com sucesso. Redirecionando...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <Card className="w-full max-w-lg">
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
              {/* Dados pré-cadastrados pelo admin (somente leitura) */}
              {inviteData?.invitation?.displayName && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-700">Nome:</span>
                  <span className="font-semibold text-blue-900">
                    {inviteData.invitation.displayName}
                  </span>
                </div>
              )}
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
              /* Se usuário não tem conta, mostrar formulário de ativação */
              <div>
                {inviteData?.hasAccount ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-900">
                        Você já tem uma conta com este e-mail. Faça login para aceitar o convite.
                      </p>
                    </div>
                    <Button
                      onClick={() => {
                        localStorage.setItem('pendingInviteToken', token || '');
                        window.location.href = '/login';
                      }}
                      className="w-full bg-[#DAA520] hover:bg-[#B8860B]"
                    >
                      Fazer Login
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit(onSubmitNewUser)} className="space-y-4">
                    {/* Hidden fields */}
                    <input type="hidden" {...register("token")} />
                    <input type="hidden" {...register("lgpdVersion")} />

                    {/* Dados pré-cadastrados pelo admin (informativo, não editável) */}
                    {inviteData?.invitation?.preRegistered && inviteData?.invitation?.displayName && (
                      <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">Dados cadastrados pelo administrador:</p>
                        <p className="text-sm font-medium text-gray-800">{inviteData.invitation.displayName}</p>
                        {inviteData.invitation.cidade && (
                          <p className="text-xs text-gray-600">
                            {inviteData.invitation.cidade}{inviteData.invitation.estado ? ` — ${inviteData.invitation.estado}` : ""}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Username */}
                    <div>
                      <Label htmlFor="username">Nome de usuário *</Label>
                      <Input
                        id="username"
                        {...register("username")}
                        placeholder="joao.silva"
                        autoComplete="username"
                      />
                      <p className="text-xs text-gray-500 mt-1">Apenas letras minúsculas, números, ponto ou underscore (3–30 caracteres)</p>
                      {errors.username && (
                        <p className="text-sm text-red-500 mt-1">{errors.username.message}</p>
                      )}
                    </div>

                    {/* Senha */}
                    <div>
                      <Label htmlFor="password">Senha *</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          {...register("password")}
                          placeholder="Mínimo 8 caracteres"
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          onClick={() => setShowPassword((v) => !v)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {errors.password && (
                        <p className="text-sm text-red-500 mt-1">{errors.password.message}</p>
                      )}
                    </div>

                    {/* Confirmar Senha */}
                    <div>
                      <Label htmlFor="confirmPassword">Confirmar Senha *</Label>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          {...register("confirmPassword")}
                          placeholder="Digite a senha novamente"
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          onClick={() => setShowConfirmPassword((v) => !v)}
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {errors.confirmPassword && (
                        <p className="text-sm text-red-500 mt-1">
                          {errors.confirmPassword.message}
                        </p>
                      )}
                    </div>

                    {/* Requisitos de senha */}
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

                    {/* Aceite LGPD */}
                    <div className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <Checkbox
                        id="lgpdAccepted"
                        onCheckedChange={(checked) => {
                          // Zod espera literal true — set só quando marcado
                          if (checked === true) {
                            setValue("lgpdAccepted", true, { shouldValidate: true });
                          }
                        }}
                      />
                      <Label htmlFor="lgpdAccepted" className="text-sm leading-relaxed cursor-pointer">
                        Li e aceito os{" "}
                        <a href="/termos-de-uso" target="_blank" className="text-[#DAA520] underline">
                          Termos de Uso
                        </a>{" "}
                        e a{" "}
                        <a href="/politica-de-privacidade" target="_blank" className="text-[#DAA520] underline">
                          Política de Privacidade (LGPD)
                        </a>
                        .
                      </Label>
                    </div>
                    {errors.lgpdAccepted && (
                      <p className="text-sm text-red-500 -mt-2">{errors.lgpdAccepted.message}</p>
                    )}

                    <Button
                      type="submit"
                      className="w-full bg-[#DAA520] hover:bg-[#B8860B]"
                      disabled={isAccepting}
                    >
                      {isAccepting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Ativando conta...
                        </>
                      ) : (
                        <>
                          <UserPlus className="mr-2 h-4 w-4" />
                          Ativar Conta e Acessar
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
