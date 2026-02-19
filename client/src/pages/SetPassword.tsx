import { useState } from "react";
import { useLocation, useSearch, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, Lock, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { buildApiUrl } from "@/lib/api-config";
import logoImg from "@assets/SEM FUNDO_1750819798590.png";

export default function SetPassword() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const params = new URLSearchParams(searchString);
  const token = params.get("token");

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) return "A senha deve ter no mínimo 8 caracteres.";
    if (!/[A-Z]/.test(pwd)) return "A senha deve conter pelo menos uma letra maiúscula.";
    if (!/[a-z]/.test(pwd)) return "A senha deve conter pelo menos uma letra minúscula.";
    if (!/[0-9]/.test(pwd)) return "A senha deve conter pelo menos um número.";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("Token não encontrado. Volte ao email e clique no link novamente.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    const validationError = validatePassword(password);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(buildApiUrl("/api/auth/set-first-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        toast({
          title: "✅ Senha definida!",
          description: "Sua senha foi criada com sucesso. Você já pode fazer login.",
        });

        setTimeout(() => {
          setLocation("/login");
        }, 3000);
      } else {
        setError(data.message || "Erro ao definir senha.");
      }
    } catch (err) {
      setError("Erro de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const getPasswordStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score;
  };

  const strength = getPasswordStrength(password);
  const strengthLabels = ["", "Fraca", "Fraca", "Média", "Boa", "Forte"];
  const strengthColors = ["", "bg-red-500", "bg-red-500", "bg-amber-500", "bg-emerald-400", "bg-emerald-500"];

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
        <div className="w-full max-w-md">
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
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              </div>
              <CardTitle className="text-xl text-white">Senha Definida!</CardTitle>
              <CardDescription className="text-slate-400">
                Sua conta está pronta. Redirecionando para login...
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white">
                <Link href="/login">Ir para Login</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

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
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-amber-500/20 flex items-center justify-center">
              <Lock className="h-8 w-8 text-amber-500" />
            </div>
            <CardTitle className="text-xl text-white">Defina sua Senha</CardTitle>
            <CardDescription className="text-slate-400">
              Crie uma senha segura para acessar sua conta.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-200 text-sm">Nova Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="bg-zinc-800 border-zinc-700 text-white placeholder:text-slate-500 pl-10 pr-10 focus:border-amber-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>

                {/* Indicador de força */}
                {password.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div
                          key={level}
                          className={`h-1.5 flex-1 rounded-full transition-colors ${level <= strength ? strengthColors[strength] : "bg-zinc-700"
                            }`}
                        />
                      ))}
                    </div>
                    <p className={`text-xs ${strength >= 4 ? "text-emerald-400" : strength >= 3 ? "text-amber-400" : "text-red-400"}`}>
                      Força: {strengthLabels[strength]}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-slate-200 text-sm">Confirmar Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a senha"
                    className="bg-zinc-800 border-zinc-700 text-white placeholder:text-slate-500 pl-10 focus:border-amber-500"
                    required
                  />
                </div>
                {confirmPassword && confirmPassword !== password && (
                  <p className="text-xs text-red-400">As senhas não coincidem.</p>
                )}
              </div>

              <div className="p-3 bg-zinc-800/50 border border-zinc-700 rounded-lg">
                <p className="text-xs text-slate-400 font-medium mb-2">Requisitos da senha:</p>
                <ul className="text-xs text-slate-500 space-y-1">
                  <li className={password.length >= 8 ? "text-emerald-400" : ""}>
                    {password.length >= 8 ? "✓" : "○"} Mínimo 8 caracteres
                  </li>
                  <li className={/[A-Z]/.test(password) ? "text-emerald-400" : ""}>
                    {/[A-Z]/.test(password) ? "✓" : "○"} Uma letra maiúscula
                  </li>
                  <li className={/[a-z]/.test(password) ? "text-emerald-400" : ""}>
                    {/[a-z]/.test(password) ? "✓" : "○"} Uma letra minúscula
                  </li>
                  <li className={/[0-9]/.test(password) ? "text-emerald-400" : ""}>
                    {/[0-9]/.test(password) ? "✓" : "○"} Um número
                  </li>
                </ul>
              </div>

              <Button
                type="submit"
                disabled={isLoading || !password || !confirmPassword || password !== confirmPassword}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold h-12"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Definindo senha...
                  </>
                ) : (
                  "Definir Senha"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
