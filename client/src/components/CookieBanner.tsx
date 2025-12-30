/**
 * 🍪 Cookie Banner Component
 * 
 * Banner de consentimento de cookies exibido na landing page.
 * Permite ao usuário escolher entre aceitar todos os cookies ou apenas os essenciais.
 * A escolha é salva no localStorage e afeta o disparo de analytics.
 */

import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { COOKIE_CONSENT_KEY, COOKIE_POLICY_VERSION, type CookieConsentType } from "../../../shared/constants";
import { Cookie, X } from "lucide-react";

export default function CookieBanner() {
    const [isVisible, setIsVisible] = useState(false);
    const [isClosing, setIsClosing] = useState(false);

    // Verificar se já existe consentimento salvo
    useEffect(() => {
        try {
            const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
            if (!consent) {
                // Aguarda um momento para animação suave
                setTimeout(() => setIsVisible(true), 1000);
            }
        } catch (error) {
            // localStorage indisponível (modo privado, etc.)
            console.warn("[CookieBanner] localStorage indisponível:", error);
        }
    }, []);

    const handleConsent = (type: CookieConsentType) => {
        try {
            if (type) {
                const consentData = JSON.stringify({
                    type,
                    version: COOKIE_POLICY_VERSION,
                    timestamp: new Date().toISOString(),
                });
                localStorage.setItem(COOKIE_CONSENT_KEY, consentData);
                console.log(`🍪 [CookieBanner] Consentimento registrado: ${type}`);
            }
        } catch (error) {
            console.warn("[CookieBanner] Erro ao salvar consentimento:", error);
        }

        // Animação de saída
        setIsClosing(true);
        setTimeout(() => setIsVisible(false), 300);
    };

    if (!isVisible) return null;

    return (
        <div
            className={`fixed bottom-0 left-0 right-0 z-50 p-4 transition-all duration-300 ${isClosing ? "translate-y-full opacity-0" : "translate-y-0 opacity-100"
                }`}
        >
            <div className="max-w-4xl mx-auto bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl shadow-black/50">
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        {/* Icon */}
                        <div className="hidden sm:flex w-12 h-12 bg-[#DAA520]/10 rounded-xl items-center justify-center flex-shrink-0">
                            <Cookie className="h-6 w-6 text-[#DAA520]" />
                        </div>

                        {/* Content */}
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                                <Cookie className="h-5 w-5 text-[#DAA520] sm:hidden" />
                                Usamos cookies
                            </h3>
                            <p className="text-sm text-slate-400 leading-relaxed mb-4">
                                Usamos cookies essenciais para o funcionamento do site e cookies adicionais para análise
                                e melhoria da sua experiência. Você pode aceitar todos ou usar apenas os essenciais.{" "}
                                <Link href="/cookies" className="text-[#DAA520] hover:underline">
                                    Política de Cookies
                                </Link>{" "}
                                •{" "}
                                <Link href="/privacy" className="text-[#DAA520] hover:underline">
                                    Política de Privacidade
                                </Link>
                            </p>

                            {/* Buttons */}
                            <div className="flex flex-col sm:flex-row gap-3">
                                <Button
                                    onClick={() => handleConsent("essential")}
                                    variant="outline"
                                    className="border-zinc-700 text-slate-300 hover:bg-zinc-800 hover:text-white"
                                >
                                    Apenas essenciais
                                </Button>
                                <Button
                                    onClick={() => handleConsent("all")}
                                    className="bg-gradient-to-r from-[#DAA520] to-[#B8860B] hover:from-[#B8860B] hover:to-[#8B6914] text-black font-semibold"
                                >
                                    Aceitar todos
                                </Button>
                            </div>
                        </div>

                        {/* Close button (optional - always closes with "essential") */}
                        <button
                            onClick={() => handleConsent("essential")}
                            className="hidden sm:flex p-2 text-slate-500 hover:text-white transition-colors"
                            title="Fechar (aceita apenas essenciais)"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
