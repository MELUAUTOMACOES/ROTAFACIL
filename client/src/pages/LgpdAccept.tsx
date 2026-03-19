/**
 * 🔐 Página de Aceite LGPD
 * 
 * Exibida para usuários logados que ainda não aceitaram os termos LGPD.
 * Usuário deve ler e aceitar antes de acessar qualquer outra parte do sistema.
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { LGPD_VERSION } from "../../../shared/constants";
import { Loader2, LogOut, Shield } from "lucide-react";
import { buildApiUrl } from "@/lib/api-config";
import logoImg from "@assets/SEM FUNDO_1750819798590.png";

export default function LgpdAccept() {
    const [, setLocation] = useLocation();
    const { logout } = useAuth();
    const { toast } = useToast();
    const [accepted, setAccepted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleAccept = async () => {
        if (!accepted) {
            toast({
                title: "Atenção",
                description: "Você precisa marcar a caixa confirmando que leu e concorda com os termos.",
                variant: "destructive",
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const token = localStorage.getItem("token");
            const response = await fetch(buildApiUrl("/api/lgpd/accept"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || "Erro ao aceitar os termos");
            }

            toast({
                title: "Termos aceitos!",
                description: "Você pode continuar usando o sistema normalmente.",
            });

            // Forçar refresh para atualizar os dados do usuário
            window.location.href = "/inicio";
        } catch (error: any) {
            console.error("❌ [LGPD] Erro ao aceitar termos:", error);
            toast({
                title: "Erro",
                description: error.message || "Não foi possível registrar o aceite. Tente novamente.",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleLogout = () => {
        logout();
        setLocation("/login");
    };

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
            <Card className="w-full max-w-2xl bg-zinc-900 border-zinc-800">
                <CardHeader className="text-center pb-6">
                    <div className="flex justify-center mb-4">
                        <img src={logoImg} alt="RotaFácil" className="h-12 w-12" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-[#DAA520] flex items-center justify-center gap-2">
                        <Shield className="h-6 w-6" />
                        Termos de Uso e Política de Privacidade (LGPD)
                    </CardTitle>
                    <p className="text-slate-400 text-sm mt-2">
                        Para continuar usando o RotaFácil, leia e aceite os termos abaixo.
                    </p>
                </CardHeader>

                <CardContent>
                    <ScrollArea className="h-[400px] rounded-lg border border-zinc-800 bg-black p-6">
                        <div className="space-y-6 text-slate-300 text-sm leading-relaxed">
                            <h3 className="text-lg font-semibold text-white">1. Introdução</h3>
                            <p>
                                Bem-vindo ao RotaFácil Frotas ("nós", "nosso" ou "Plataforma"). Esta Política de Privacidade
                                descreve como coletamos, usamos, armazenamos e protegemos seus dados pessoais em conformidade
                                com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 - LGPD).
                            </p>
                            <p>
                                Ao utilizar nossa plataforma, você concorda com as práticas descritas nesta política.
                                Recomendamos a leitura atenta deste documento.
                            </p>

                            <h3 className="text-lg font-semibold text-white">2. Dados Coletados</h3>
                            <p>Coletamos os seguintes tipos de dados:</p>
                            <ul className="list-disc pl-6 space-y-1">
                                <li><strong>Dados cadastrais:</strong> nome, e-mail, telefone, CPF/CNPJ, endereço.</li>
                                <li><strong>Dados de acesso:</strong> logs de login, IP, dispositivo utilizado.</li>
                                <li><strong>Dados operacionais:</strong> agendamentos, rotas, clientes, técnicos, veículos.</li>
                                <li><strong>Dados de localização:</strong> coordenadas GPS durante execução de rotas (quando autorizado).</li>
                                <li><strong>Dados financeiros:</strong> valores de serviços, custos de combustível, manutenções.</li>
                            </ul>

                            <h3 className="text-lg font-semibold text-white">3. Finalidade do Tratamento</h3>
                            <p>Seus dados são utilizados para:</p>
                            <ul className="list-disc pl-6 space-y-1">
                                <li>Fornecer e manter a Plataforma funcionando corretamente.</li>
                                <li>Otimizar rotas e agendamentos para sua operação.</li>
                                <li>Enviar comunicações relacionadas ao serviço (alertas, notificações).</li>
                                <li>Melhorar a experiência do usuário através de análises de uso.</li>
                                <li>Cumprir obrigações legais e regulatórias.</li>
                            </ul>

                            <h3 className="text-lg font-semibold text-white">4. Base Legal</h3>
                            <p>
                                O tratamento de seus dados está fundamentado nas seguintes bases legais previstas na LGPD:
                            </p>
                            <ul className="list-disc pl-6 space-y-1">
                                <li><strong>Execução de contrato:</strong> para prestar os serviços contratados.</li>
                                <li><strong>Consentimento:</strong> para funcionalidades opcionais e marketing.</li>
                                <li><strong>Legítimo interesse:</strong> para melhorias de produto e segurança.</li>
                                <li><strong>Obrigação legal:</strong> para cumprimento de exigências tributárias e fiscais.</li>
                            </ul>

                            <h3 className="text-lg font-semibold text-white">5. Compartilhamento de Dados</h3>
                            <p>
                                Seus dados podem ser compartilhados com:
                            </p>
                            <ul className="list-disc pl-6 space-y-1">
                                <li>Provedores de infraestrutura e hospedagem.</li>
                                <li>Serviços de mapas e geolocalização.</li>
                                <li>Autoridades governamentais, quando exigido por lei.</li>
                            </ul>
                            <p>
                                Não vendemos ou compartilhamos seus dados com terceiros para fins de marketing sem seu consentimento expresso.
                            </p>

                            <h3 className="text-lg font-semibold text-white">6. Segurança</h3>
                            <p>
                                Implementamos medidas técnicas e administrativas para proteger seus dados, incluindo:
                            </p>
                            <ul className="list-disc pl-6 space-y-1">
                                <li>Criptografia de dados em trânsito (HTTPS/TLS).</li>
                                <li>Controle de acesso por autenticação e autorização.</li>
                                <li>Backups regulares e recuperação de desastres.</li>
                                <li>Monitoramento contínuo de segurança.</li>
                            </ul>

                            <h3 className="text-lg font-semibold text-white">7. Seus Direitos (LGPD)</h3>
                            <p>
                                Você tem direito a:
                            </p>
                            <ul className="list-disc pl-6 space-y-1">
                                <li><strong>Acesso:</strong> saber quais dados temos sobre você.</li>
                                <li><strong>Correção:</strong> atualizar dados incorretos ou desatualizados.</li>
                                <li><strong>Exclusão:</strong> solicitar a remoção de dados não essenciais.</li>
                                <li><strong>Portabilidade:</strong> receber seus dados em formato estruturado.</li>
                                <li><strong>Revogação:</strong> retirar consentimento a qualquer momento.</li>
                                <li><strong>Informação:</strong> saber com quem compartilhamos seus dados.</li>
                            </ul>
                            <p>
                                Para exercer seus direitos, entre em contato pelo e-mail: <strong className="text-[#DAA520]">privacidade@rotafacil.app</strong>
                            </p>

                            <h3 className="text-lg font-semibold text-white">8. Retenção de Dados</h3>
                            <p>
                                Seus dados serão mantidos pelo tempo necessário para cumprir as finalidades descritas,
                                exceto quando houver obrigação legal de retenção por período maior (ex.: dados fiscais por 5 anos).
                            </p>

                            <h3 className="text-lg font-semibold text-white">9. Alterações nesta Política</h3>
                            <p>
                                Podemos atualizar esta política periodicamente. Você será notificado sobre alterações significativas
                                através da Plataforma ou por e-mail.
                            </p>

                            <h3 className="text-lg font-semibold text-white">10. Contato</h3>
                            <p>
                                Para dúvidas sobre esta política ou sobre o tratamento de seus dados, entre em contato:
                            </p>
                            <ul className="list-none space-y-1">
                                <li><strong>E-mail:</strong> privacidade@rotafacil.app</li>
                                <li><strong>Encarregado (DPO):</strong> dpo@rotafacil.app</li>
                            </ul>

                            <div className="pt-4 border-t border-zinc-800 mt-6">
                                <p className="text-xs text-slate-500">
                                    Última atualização: Janeiro de 2025
                                </p>
                            </div>
                        </div>
                    </ScrollArea>
                </CardContent>

                <CardFooter className="flex flex-col gap-4 pt-6">
                    {/* Checkbox de aceite */}
                    <div className="flex items-start gap-3 w-full">
                        <Checkbox
                            id="accept-lgpd"
                            checked={accepted}
                            onCheckedChange={(checked) => setAccepted(checked === true)}
                            className="mt-1 border-[#DAA520] data-[state=checked]:bg-[#DAA520] data-[state=checked]:text-black"
                        />
                        <label
                            htmlFor="accept-lgpd"
                            className="text-sm text-slate-300 cursor-pointer leading-relaxed"
                        >
                            Li e concordo com os <strong className="text-white">Termos de Uso</strong> e a{" "}
                            <strong className="text-white">Política de Privacidade</strong> do RotaFácil Frotas.
                        </label>
                    </div>

                    {/* Botões */}
                    <div className="flex flex-col sm:flex-row gap-3 w-full">
                        <Button
                            variant="outline"
                            onClick={handleLogout}
                            className="flex-1 border-zinc-700 text-slate-300 hover:bg-zinc-800 hover:text-white"
                        >
                            <LogOut className="h-4 w-4 mr-2" />
                            Sair
                        </Button>
                        <Button
                            onClick={handleAccept}
                            disabled={!accepted || isSubmitting}
                            className="flex-1 bg-gradient-to-r from-[#DAA520] to-[#B8860B] hover:from-[#B8860B] hover:to-[#8B6914] text-black font-semibold disabled:opacity-50"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Processando...
                                </>
                            ) : (
                                "Aceitar e continuar"
                            )}
                        </Button>
                    </div>

                    {/* Versão do termo */}
                    <p className="text-xs text-slate-500 text-center">
                        Versão do termo: {LGPD_VERSION}
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
}
