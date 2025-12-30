/**
 * 📜 Página de Política de Privacidade
 * 
 * Página pública acessível a partir da landing page.
 * Exibe a política de privacidade completa do RotaFácil.
 */

import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Shield } from "lucide-react";
import logoImg from "@assets/SEM FUNDO_1750819798590.png";

export default function PrivacyPolicy() {
    return (
        <div className="min-h-screen bg-black">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-lg border-b border-slate-800/50">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <Link href="/">
                        <div className="flex items-center space-x-2 cursor-pointer">
                            <img src={logoImg} alt="RotaFácil Frotas Logo" className="h-8 w-8" />
                            <h1 className="text-xl font-bold">
                                Rota<span className="text-amber-500">Fácil</span>
                                <span className="text-slate-400 font-normal ml-1">Frotas</span>
                            </h1>
                        </div>
                    </Link>
                    <Link href="/">
                        <Button variant="ghost" className="text-slate-400 hover:text-white">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Voltar
                        </Button>
                    </Link>
                </div>
            </header>

            {/* Content */}
            <main className="pt-24 pb-16 px-4">
                <Card className="max-w-4xl mx-auto bg-zinc-900 border-zinc-800">
                    <CardHeader className="text-center pb-6">
                        <CardTitle className="text-2xl font-bold text-[#DAA520] flex items-center justify-center gap-2">
                            <Shield className="h-6 w-6" />
                            Política de Privacidade
                        </CardTitle>
                        <p className="text-slate-400 text-sm mt-2">
                            Última atualização: Janeiro de 2025
                        </p>
                    </CardHeader>

                    <CardContent>
                        <ScrollArea className="h-[600px]">
                            <div className="space-y-6 text-slate-300 text-sm leading-relaxed pr-4">
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
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </main>

            {/* Footer */}
            <footer className="bg-zinc-950 border-t border-zinc-800 py-8">
                <div className="max-w-4xl mx-auto px-4 text-center">
                    <p className="text-slate-500 text-sm">
                        © 2025 RotaFácil Frotas. Todos os direitos reservados.
                    </p>
                </div>
            </footer>
        </div>
    );
}
