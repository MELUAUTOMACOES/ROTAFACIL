/**
 * 💬 Botão Flutuante de WhatsApp
 * 
 * Componente para exibir botão flutuante de WhatsApp na landing page.
 * Busca configurações (número e mensagem) do backend.
 */

import { useQuery } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

interface WhatsAppSettings {
    whatsappNumber: string;
    defaultMessage: string;
}

async function fetchWhatsAppSettings(): Promise<WhatsAppSettings> {
    const res = await fetch("/api/public/whatsapp-settings");
    if (!res.ok) {
        // Se não tiver configuração, retorna vazio
        return { whatsappNumber: "", defaultMessage: "" };
    }
    const data = await res.json();
    return {
        whatsappNumber: data.whatsappNumber || "",
        defaultMessage: data.defaultMessage || "Olá! Gostaria de saber mais sobre o RotaFácil."
    };
}

export function WhatsAppFloatingButton() {
    const { data: settings } = useQuery({
        queryKey: ["whatsapp-settings-public"],
        queryFn: fetchWhatsAppSettings,
        // Revalidar a cada 5 minutos
        staleTime: 5 * 60 * 1000,
    });

    // Não mostrar se não tiver número configurado
    if (!settings?.whatsappNumber) {
        return null;
    }

    const handleClick = () => {
        // Tracking do clique (landing page)
        trackEvent("click_whatsapp", { source: "landing_button" });

        // Abrir WhatsApp
        const url = `https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(settings.defaultMessage)}`;
        window.open(url, "_blank");
    };

    return (
        <button
            onClick={handleClick}
            className="fixed bottom-6 right-6 z-50 w-16 h-16 bg-green-500 hover:bg-green-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center group"
            title="Fale conosco no WhatsApp"
            aria-label="Fale conosco no WhatsApp"
        >
            <MessageCircle className="h-8 w-8 group-hover:scale-110 transition-transform" />
        </button>
    );
}
