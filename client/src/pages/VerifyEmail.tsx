import { useEffect, useState } from "react";
import { useLocation, useSearch, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, XCircle, Mail, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { buildApiUrl } from "@/lib/api-config";
import logoImg from "@assets/SEM FUNDO_1750819798590.png";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  // Estado do formulário de reenvio
  const [resendEmail, setResendEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const token = params.get("token");

    if (!token) {
      setStatus("error");
      setMessage("Token de verificação não encontrado.");
      return;
    }

    verifyEmail(token);
  }, [searchString]);

  const verifyEmail = async (token: string) => {
    try {
      const response = await fetch(buildApiUrl("/api/auth/verify-email"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus("success");
        setMessage(data.message || "Email verificado com sucesso!");

        // Redirecionar para definição de senha após 3 segundos
        setTimeout(() => {
          setLocation(`/set-password?token=${token}`);
        }, 3000);
      } else {
        setStatus("error");
        setMessage(data.message || "Erro ao verificar email.");
      }
    } catch (error) {
      setStatus("error");
      setMessage("Erro de conexão. Verifique sua internet e tente novamente.");
    }
  };

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail || resendLoading) return;

    setResendLoading(true);
    try {
      const response = await fetch(buildApiUrl("/api/auth/resend-verification"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resendEmail }),
      });

      const data = await response.json();

      setResendSent(true);
      toast({
        title: "📧 Verificação reenviada",
        description: data.message || "Se o email estiver cadastrado, um novo link será enviado.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "❌ Erro",
        description: "Erro de conexão. Tente novamente.",
      });
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/">
            <div className="inline-flex items-center space-x-2 cursor-pointer hover:opacity-80 transition-opacity">
              <img src={logoImg} alt="RotaFácil Frotas Logo" className="h-10 w-10" />
              <span className="text-2xl font-bold text-white">
                Rota<span className="text-amber-500">Fácil</span>
              </span>
            </div>
          </Link>
        </div>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="text-center pb-4">
            {status === "loading" && (
              <>
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
                </div>
                <CardTitle className="text-xl text-white">Verificando email...</CardTitle>
                <CardDescription className="text-slate-400">
                  Aguarde enquanto verificamos seu email.
                </CardDescription>
              </>
            )}

            {status === "success" && (
              <>
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                </div>
                <CardTitle className="text-xl text-white">Email Verificado!</CardTitle>
                <CardDescription className="text-slate-400">
                  {message}
                </CardDescription>
              </>
            )}

            {status === "error" && (
              <>
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-red-500/20 flex items-center justify-center">
                  <XCircle className="h-8 w-8 text-red-500" />
                </div>
                <CardTitle className="text-xl text-white">Erro na Verificação</CardTitle>
                <CardDescription className="text-red-400">
                  {message}
                </CardDescription>
              </>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            {status === "success" && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <p className="text-sm text-emerald-400">
                  ✅ Redirecionando para definição de senha em instantes...
                </p>
              </div>
            )}

            {status === "error" && (
              <>
                {/* Formulário de reenvio */}
                <div className="pt-2 border-t border-zinc-800">
                  <p className="text-sm text-slate-400 mb-3">
                    Link expirado ou inválido? Solicite um novo:
                  </p>

                  {resendSent ? (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <p className="text-sm text-amber-400 flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Se o email estiver cadastrado, um novo link será enviado. Verifique sua caixa de entrada.
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleResend} className="space-y-3">
                      <div>
                        <Label htmlFor="resendEmail" className="text-slate-200 text-sm">
                          Seu email de cadastro
                        </Label>
                        <Input
                          id="resendEmail"
                          type="email"
                          value={resendEmail}
                          onChange={(e) => setResendEmail(e.target.value)}
                          placeholder="joao@empresa.com"
                          className="bg-zinc-800 border-zinc-700 text-white placeholder:text-slate-500 focus:border-amber-500"
                          required
                        />
                      </div>
                      <Button
                        type="submit"
                        disabled={resendLoading || !resendEmail}
                        className="w-full bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:bg-amber-500/30"
                        variant="outline"
                      >
                        {resendLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Reenviar link de verificação
                          </>
                        )}
                      </Button>
                    </form>
                  )}
                </div>

                <Button asChild variant="outline" className="w-full border-zinc-700 text-slate-300 hover:bg-zinc-800 hover:text-white">
                  <Link href="/login">Voltar para Login</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
