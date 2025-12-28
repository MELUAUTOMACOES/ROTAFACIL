import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signupCompanySchema, type SignupCompanyData } from "@shared/schema";
import InputMask from "react-input-mask";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { buscarEnderecoPorCep } from "@/lib/cep";
import { Loader2, Building2, User, Mail, Phone, MapPin, Briefcase, MessageSquare, Truck, Check } from "lucide-react";
import { Link } from "wouter";
import logoImg from "@assets/SEM FUNDO_1750819798590.png";

interface PinData {
  id: number;
  x: number;
  y: number;
  delay: number;
  size: number;
}

export default function SignupCompany() {
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();
  const [pins, setPins] = useState<PinData[]>([]);

  useEffect(() => {
    const newPins = Array.from({ length: 8 }, (_, i) => ({
      id: i,
      x: 5 + Math.random() * 90,
      y: 10 + Math.random() * 80,
      delay: Math.random() * 4,
      size: 3 + Math.random() * 3
    }));
    setPins(newPins);
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<SignupCompanyData>({
    resolver: zodResolver(signupCompanySchema),
  });

  const selectedServicos = watch("company.servicos") || [];

  const handleCepBlur = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;

    try {
      const address = await buscarEnderecoPorCep(cleanCep);
      setValue("company.logradouro", address.logradouro || "");
      setValue("company.cidade", address.localidade || "");
      setValue("company.estado", address.uf || "");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "CEP não encontrado",
        description: "Verifique o CEP digitado ou preencha manualmente.",
      });
    }
  };

  const onSubmit = async (data: SignupCompanyData) => {
    try {
      setIsLoading(true);

      const response = await fetch("/api/auth/signup-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Erro ao cadastrar empresa");
      }

      setSuccess(true);
      toast({
        title: "✅ Empresa cadastrada!",
        description: "Verifique seu e-mail para ativar a conta e definir sua senha.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "❌ Erro no cadastro",
        description: error.message || "Não foi possível cadastrar a empresa. Tente novamente.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const servicosOptions = [
    "Instalação",
    "Manutenção",
    "Vistorias",
    "Entregas/Coletas",
    "Outro(s)",
  ];

  const toggleServico = (servico: string) => {
    const current = selectedServicos;
    if (current.includes(servico)) {
      setValue("company.servicos", current.filter(s => s !== servico));
    } else {
      setValue("company.servicos", [...current, servico]);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-4 relative overflow-hidden">
        {/* Animated pins */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {pins.map(pin => (
            <div
              key={pin.id}
              className="absolute animate-pin-float"
              style={{
                left: `${pin.x}%`,
                top: `${pin.y}%`,
                animationDelay: `${pin.delay}s`,
              }}
            >
              <MapPin
                className="text-amber-500 drop-shadow-[0_0_6px_rgba(245,158,11,0.4)]"
                style={{ width: `${pin.size * 5}px`, height: `${pin.size * 5}px`, opacity: 0.2 }}
              />
            </div>
          ))}
        </div>

        <Card className="w-full max-w-md bg-zinc-900 border-zinc-800 relative z-10">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-amber-500/20 flex items-center justify-center">
              <Check className="h-8 w-8 text-amber-500" />
            </div>
            <CardTitle className="text-2xl text-white">Cadastro Concluído!</CardTitle>
            <CardDescription className="text-slate-400">
              Enviamos um e-mail de verificação para você.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-sm text-amber-400 font-semibold">
                Próximos passos:
              </p>
              <ol className="text-sm text-slate-300 mt-2 space-y-1 list-decimal list-inside">
                <li>Verifique sua caixa de entrada</li>
                <li>Clique no link de verificação</li>
                <li>Defina sua senha de acesso</li>
                <li>Faça login e comece a usar!</li>
              </ol>
            </div>
            <Button asChild className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white">
              <Link href="/login">Ir para Login</Link>
            </Button>
          </CardContent>
        </Card>

        <style>{`
          @keyframes pin-float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-12px); }
          }
          .animate-pin-float {
            animation: pin-float 4s ease-in-out infinite;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Road animation at bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-0">
        <svg className="w-full h-24 opacity-30" viewBox="0 0 1440 80" preserveAspectRatio="none">
          <path d="M0,80 L0,50 Q360,30 720,40 T1440,30 L1440,80 Z" fill="#1a1a1a" />
          <path d="M0,55 Q360,35 720,45 T1440,35" stroke="#f59e0b" strokeWidth="2" fill="none" strokeDasharray="20,15" className="animate-road-line" />
        </svg>
        <div className="absolute bottom-4 animate-truck-signup">
          <Truck className="h-6 w-6 text-amber-500/50" />
        </div>
      </div>

      {/* Animated pins */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {pins.map(pin => (
          <div
            key={pin.id}
            className="absolute animate-pin-float"
            style={{
              left: `${pin.x}%`,
              top: `${pin.y}%`,
              animationDelay: `${pin.delay}s`,
            }}
          >
            <MapPin
              className="text-amber-500 drop-shadow-[0_0_6px_rgba(245,158,11,0.4)]"
              style={{ width: `${pin.size * 5}px`, height: `${pin.size * 5}px`, opacity: 0.15 }}
            />
          </div>
        ))}
      </div>

      {/* Glow effect */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-b from-amber-500/10 to-transparent blur-3xl" />

      <div className="relative z-10 p-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <Link href="/">
              <div className="inline-flex items-center space-x-2 cursor-pointer hover:opacity-80 transition-opacity mb-4">
                <img src={logoImg} alt="RotaFácil Frotas Logo" className="h-12 w-12" />
                <h1 className="text-4xl font-bold text-white">
                  Rota<span className="text-amber-500">Fácil</span>
                  <span className="text-slate-400 font-normal ml-2">Frotas</span>
                </h1>
              </div>
            </Link>
            <p className="text-slate-400">Cadastre sua empresa e comece a usar</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-6">
              {/* Dados da Empresa */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Building2 className="h-5 w-5 text-amber-500" />
                    Dados da Empresa
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Informações necessárias para identificação e suporte
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="company.name" className="text-slate-200">Nome da Empresa *</Label>
                      <Input
                        id="company.name"
                        {...register("company.name")}
                        placeholder="Ex: Assistência Técnica XYZ"
                        className="bg-zinc-800 border-zinc-700 text-white placeholder:text-slate-500 focus:border-amber-500"
                      />
                      {errors.company?.name && (
                        <p className="text-sm text-red-400 mt-1">{errors.company.name.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="company.cnpj" className="text-slate-200">CNPJ *</Label>
                      <InputMask
                        mask="99.999.999/9999-99"
                        {...register("company.cnpj")}
                      >
                        {((inputProps: any) => (
                          <Input
                            {...inputProps}
                            id="company.cnpj"
                            placeholder="00.000.000/0000-00"
                            className="bg-zinc-800 border-zinc-700 text-white placeholder:text-slate-500 focus:border-amber-500"
                          />
                        )) as any}
                      </InputMask>
                      {errors.company?.cnpj && (
                        <p className="text-sm text-red-400 mt-1">{errors.company.cnpj.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="company.telefone" className="text-slate-200">Telefone (WhatsApp) *</Label>
                      <InputMask
                        mask="(99) 99999-9999"
                        {...register("company.telefone")}
                      >
                        {((inputProps: any) => (
                          <Input
                            {...inputProps}
                            id="company.telefone"
                            placeholder="(00) 00000-0000"
                            className="bg-zinc-800 border-zinc-700 text-white placeholder:text-slate-500 focus:border-amber-500"
                          />
                        )) as any}
                      </InputMask>
                      {errors.company?.telefone && (
                        <p className="text-sm text-red-400 mt-1">{errors.company.telefone.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="company.email" className="text-slate-200">E-mail da Empresa *</Label>
                      <Input
                        id="company.email"
                        type="email"
                        {...register("company.email")}
                        placeholder="contato@empresa.com"
                        className="bg-zinc-800 border-zinc-700 text-white placeholder:text-slate-500 focus:border-amber-500"
                      />
                      {errors.company?.email && (
                        <p className="text-sm text-red-400 mt-1">{errors.company.email.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-zinc-800">
                    <h4 className="font-semibold mb-3 flex items-center gap-2 text-white">
                      <MapPin className="h-4 w-4 text-amber-500" />
                      Endereço da Sede
                    </h4>
                    <div className="grid md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="company.cep" className="text-slate-200">CEP *</Label>
                        <InputMask
                          mask="99999-999"
                          {...register("company.cep")}
                          onBlur={(e) => handleCepBlur(e.target.value)}
                        >
                          {((inputProps: any) => (
                            <Input
                              {...inputProps}
                              id="company.cep"
                              placeholder="00000-000"
                              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-slate-500 focus:border-amber-500"
                            />
                          )) as any}
                        </InputMask>
                        {errors.company?.cep && (
                          <p className="text-sm text-red-400 mt-1">{errors.company.cep.message}</p>
                        )}
                      </div>

                      <div className="md:col-span-2">
                        <Label htmlFor="company.logradouro" className="text-slate-200">Logradouro *</Label>
                        <Input
                          id="company.logradouro"
                          {...register("company.logradouro")}
                          placeholder="Rua, Avenida, etc."
                          className="bg-zinc-800 border-zinc-700 text-white placeholder:text-slate-500 focus:border-amber-500"
                        />
                        {errors.company?.logradouro && (
                          <p className="text-sm text-red-400 mt-1">{errors.company.logradouro.message}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="company.numero" className="text-slate-200">Número *</Label>
                        <Input
                          id="company.numero"
                          {...register("company.numero")}
                          placeholder="123"
                          className="bg-zinc-800 border-zinc-700 text-white placeholder:text-slate-500 focus:border-amber-500"
                        />
                        {errors.company?.numero && (
                          <p className="text-sm text-red-400 mt-1">{errors.company.numero.message}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="company.cidade" className="text-slate-200">Cidade *</Label>
                        <Input
                          id="company.cidade"
                          {...register("company.cidade")}
                          placeholder="São Paulo"
                          className="bg-zinc-800 border-zinc-700 text-white placeholder:text-slate-500 focus:border-amber-500"
                        />
                        {errors.company?.cidade && (
                          <p className="text-sm text-red-400 mt-1">{errors.company.cidade.message}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="company.estado" className="text-slate-200">Estado *</Label>
                        <Input
                          id="company.estado"
                          {...register("company.estado")}
                          placeholder="SP"
                          maxLength={2}
                          className="bg-zinc-800 border-zinc-700 text-white placeholder:text-slate-500 focus:border-amber-500"
                        />
                        {errors.company?.estado && (
                          <p className="text-sm text-red-400 mt-1">{errors.company.estado.message}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Dados do Administrador */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <User className="h-5 w-5 text-amber-500" />
                    Dados do Administrador
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Você será o responsável pela conta
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="admin.name" className="text-slate-200">Nome Completo *</Label>
                      <Input
                        id="admin.name"
                        {...register("admin.name")}
                        placeholder="João Silva"
                        className="bg-zinc-800 border-zinc-700 text-white placeholder:text-slate-500 focus:border-amber-500"
                      />
                      {errors.admin?.name && (
                        <p className="text-sm text-red-400 mt-1">{errors.admin.name.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="admin.email" className="text-slate-200">E-mail (Login) *</Label>
                      <Input
                        id="admin.email"
                        type="email"
                        {...register("admin.email")}
                        placeholder="joao@empresa.com"
                        className="bg-zinc-800 border-zinc-700 text-white placeholder:text-slate-500 focus:border-amber-500"
                      />
                      {errors.admin?.email && (
                        <p className="text-sm text-red-400 mt-1">{errors.admin.email.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="admin.phone" className="text-slate-200">Telefone (WhatsApp) *</Label>
                      <InputMask
                        mask="(99) 99999-9999"
                        {...register("admin.phone")}
                      >
                        {((inputProps: any) => (
                          <Input
                            {...inputProps}
                            id="admin.phone"
                            placeholder="(00) 00000-0000"
                            className="bg-zinc-800 border-zinc-700 text-white placeholder:text-slate-500 focus:border-amber-500"
                          />
                        )) as any}
                      </InputMask>
                      {errors.admin?.phone && (
                        <p className="text-sm text-red-400 mt-1">{errors.admin.phone.message}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Segmento e Tipo de Serviço */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Briefcase className="h-5 w-5 text-amber-500" />
                    Segmento e Serviços
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="company.segmento" className="text-slate-200">Segmento Principal</Label>
                    <Select onValueChange={(value) => setValue("company.segmento", value)}>
                      <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-800 border-zinc-700">
                        <SelectItem value="Assistência técnica">Assistência técnica</SelectItem>
                        <SelectItem value="Telecom / Fibra">Telecom / Fibra</SelectItem>
                        <SelectItem value="Elétrica / Hidráulica">Elétrica / Hidráulica</SelectItem>
                        <SelectItem value="Manutenção predial">Manutenção predial</SelectItem>
                        <SelectItem value="Engenharia / Construção">Engenharia / Construção</SelectItem>
                        <SelectItem value="Outros">Outros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-slate-200">Serviços Oferecidos</Label>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      {servicosOptions.map((servico) => (
                        <div key={servico} className="flex items-center space-x-2">
                          <Checkbox
                            id={servico}
                            checked={selectedServicos.includes(servico)}
                            onCheckedChange={() => toggleServico(servico)}
                            className="border-zinc-600 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                          />
                          <Label htmlFor={servico} className="font-normal cursor-pointer text-slate-300">
                            {servico}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Marketing */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <MessageSquare className="h-5 w-5 text-amber-500" />
                    Como nos Conheceu?
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="company.comoConheceu" className="text-slate-200">Como conheceu o RotaFácil?</Label>
                      <Select onValueChange={(value) => setValue("company.comoConheceu", value)}>
                        <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-800 border-zinc-700">
                          <SelectItem value="Instagram">Instagram</SelectItem>
                          <SelectItem value="YouTube">YouTube</SelectItem>
                          <SelectItem value="Google">Google</SelectItem>
                          <SelectItem value="Indicação">Indicação</SelectItem>
                          <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                          <SelectItem value="Outro">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="company.problemaPrincipal" className="text-slate-200">Qual problema quer resolver?</Label>
                      <Select onValueChange={(value) => setValue("company.problemaPrincipal", value)}>
                        <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-800 border-zinc-700">
                          <SelectItem value="Organização de agenda">Organização de agenda</SelectItem>
                          <SelectItem value="Roteirização">Roteirização</SelectItem>
                          <SelectItem value="Gestão de técnicos">Gestão de técnicos</SelectItem>
                          <SelectItem value="Gestão de clientes">Gestão de clientes</SelectItem>
                          <SelectItem value="Outro">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Botões */}
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 border-zinc-700 text-slate-300 hover:bg-zinc-800 hover:text-white"
                  asChild
                >
                  <Link href="/login">Já tenho conta</Link>
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Cadastrando...
                    </>
                  ) : (
                    "Cadastrar Empresa"
                  )}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes pin-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
        @keyframes truck-signup {
          0% { transform: translateX(-50px); }
          100% { transform: translateX(calc(100vw + 50px)); }
        }
        @keyframes road-line {
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -35; }
        }
        .animate-pin-float {
          animation: pin-float 4s ease-in-out infinite;
        }
        .animate-truck-signup {
          animation: truck-signup 20s linear infinite;
        }
        .animate-road-line {
          animation: road-line 1.5s linear infinite;
        }
      `}</style>
    </div>
  );
}
