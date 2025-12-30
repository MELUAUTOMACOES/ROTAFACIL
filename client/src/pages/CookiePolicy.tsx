/**
 * 🍪 Página de Política de Cookies
 * 
 * Página pública acessível a partir da landing page.
 * Exibe a política de cookies completa do RotaFácil.
 */

import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Cookie } from "lucide-react";
import logoImg from "@assets/SEM FUNDO_1750819798590.png";

export default function CookiePolicy() {
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
                            <Cookie className="h-6 w-6" />
                            Política de Cookies
                        </CardTitle>
                        <p className="text-slate-400 text-sm mt-2">
                            Última atualização: Janeiro de 2025
                        </p>
                    </CardHeader>

                    <CardContent>
                        <ScrollArea className="h-[600px]">
                            <div className="space-y-6 text-slate-300 text-sm leading-relaxed pr-4">
                                <h3 className="text-lg font-semibold text-white">1. O que são Cookies?</h3>
                                <p>
                                    Cookies são pequenos arquivos de texto que são armazenados no seu dispositivo (computador,
                                    tablet ou celular) quando você visita um site. Eles são amplamente utilizados para fazer
                                    os sites funcionarem de forma mais eficiente e fornecer informações aos proprietários do site.
                                </p>

                                <h3 className="text-lg font-semibold text-white">2. Por que Usamos Cookies?</h3>
                                <p>
                                    Utilizamos cookies para diversos fins, incluindo:
                                </p>
                                <ul className="list-disc pl-6 space-y-1">
                                    <li><strong>Funcionamento do site:</strong> garantir que as funcionalidades básicas operem corretamente.</li>
                                    <li><strong>Autenticação:</strong> manter você logado enquanto navega pelo sistema.</li>
                                    <li><strong>Preferências:</strong> lembrar suas configurações e preferências (tema, idioma, etc.).</li>
                                    <li><strong>Análise:</strong> entender como os visitantes usam nosso site para melhorar a experiência.</li>
                                    <li><strong>Marketing:</strong> medir a eficácia de campanhas publicitárias (com seu consentimento).</li>
                                </ul>

                                <h3 className="text-lg font-semibold text-white">3. Tipos de Cookies que Utilizamos</h3>

                                <h4 className="text-md font-semibold text-[#DAA520] mt-4">3.1 Cookies Essenciais</h4>
                                <p>
                                    Estes cookies são necessários para o funcionamento básico do site e não podem ser desativados.
                                    Eles incluem, por exemplo, cookies para autenticação e sessão.
                                </p>
                                <ul className="list-disc pl-6 space-y-1">
                                    <li><strong>token:</strong> armazena o token de autenticação do usuário.</li>
                                    <li><strong>rotafacil_session_id:</strong> identifica a sessão do usuário para analytics internos.</li>
                                </ul>

                                <h4 className="text-md font-semibold text-[#DAA520] mt-4">3.2 Cookies de Preferências</h4>
                                <p>
                                    Permitem que o site lembre suas escolhas e preferências.
                                </p>
                                <ul className="list-disc pl-6 space-y-1">
                                    <li><strong>theme:</strong> armazena a preferência de tema (claro/escuro).</li>
                                    <li><strong>rotafacil_cookie_consent:</strong> armazena sua escolha sobre cookies.</li>
                                </ul>

                                <h4 className="text-md font-semibold text-[#DAA520] mt-4">3.3 Cookies de Análise (Analytics)</h4>
                                <p>
                                    Estes cookies nos ajudam a entender como os visitantes interagem com o site,
                                    coletando informações de forma anônima. Só são ativados com seu consentimento.
                                </p>
                                <ul className="list-disc pl-6 space-y-1">
                                    <li>Rastreamento de página visualizada</li>
                                    <li>Tempo gasto no site</li>
                                    <li>Origem do visitante (campanhas, UTMs)</li>
                                    <li>Tipo de dispositivo (mobile/desktop)</li>
                                </ul>

                                <h4 className="text-md font-semibold text-[#DAA520] mt-4">3.4 Cookies de Marketing</h4>
                                <p>
                                    Utilizados para medir a eficácia de campanhas publicitárias.
                                    Só são ativados com seu consentimento explícito.
                                </p>
                                <ul className="list-disc pl-6 space-y-1">
                                    <li>Google Analytics (preparado para integração futura)</li>
                                    <li>Meta Pixel (preparado para integração futura)</li>
                                </ul>

                                <h3 className="text-lg font-semibold text-white">4. Como Gerenciar Cookies</h3>
                                <p>
                                    Ao visitar nosso site pela primeira vez, você verá um banner de cookies que permite:
                                </p>
                                <ul className="list-disc pl-6 space-y-1">
                                    <li><strong>Aceitar todos:</strong> aceita cookies essenciais e de análise/marketing.</li>
                                    <li><strong>Apenas essenciais:</strong> aceita apenas cookies necessários para o funcionamento do site.</li>
                                </ul>
                                <p>
                                    Você também pode gerenciar cookies diretamente nas configurações do seu navegador:
                                </p>
                                <ul className="list-disc pl-6 space-y-1">
                                    <li><strong>Chrome:</strong> Configurações {'>'} Privacidade e segurança {'>'} Cookies</li>
                                    <li><strong>Firefox:</strong> Opções {'>'} Privacidade e Segurança {'>'} Cookies</li>
                                    <li><strong>Safari:</strong> Preferências {'>'} Privacidade {'>'} Gerenciar Dados do Site</li>
                                    <li><strong>Edge:</strong> Configurações {'>'} Cookies e permissões de site</li>
                                </ul>
                                <p className="text-amber-400">
                                    ⚠️ Desativar cookies essenciais pode prejudicar o funcionamento do site.
                                </p>

                                <h3 className="text-lg font-semibold text-white">5. Tempo de Armazenamento</h3>
                                <p>
                                    Os cookies têm diferentes tempos de vida:
                                </p>
                                <ul className="list-disc pl-6 space-y-1">
                                    <li><strong>Cookies de sessão:</strong> são excluídos quando você fecha o navegador.</li>
                                    <li><strong>Cookies persistentes:</strong> permanecem até a data de expiração configurada ou até você excluí-los manualmente.</li>
                                </ul>

                                <h3 className="text-lg font-semibold text-white">6. Alterações nesta Política</h3>
                                <p>
                                    Podemos atualizar esta política de cookies periodicamente. A data da última atualização
                                    está indicada no topo desta página.
                                </p>

                                <h3 className="text-lg font-semibold text-white">7. Contato</h3>
                                <p>
                                    Se você tiver dúvidas sobre nossa política de cookies, entre em contato:
                                </p>
                                <ul className="list-none space-y-1">
                                    <li><strong>E-mail:</strong> privacidade@rotafacil.app</li>
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
