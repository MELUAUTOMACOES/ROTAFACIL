import React, { useRef, useState, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from "@/components/ui/button";
import { Eraser, Check, X } from "lucide-react";

interface SignaturePadProps {
    onSave: (signatureData: string) => void;
    onCancel: () => void;
}

export function SignaturePad({ onSave, onCancel }: SignaturePadProps) {
    const sigCanvas = useRef<SignatureCanvas>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isEmpty, setIsEmpty] = useState(true);
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const updateSize = () => {
            if (containerRef.current) {
                setCanvasSize({
                    width: containerRef.current.offsetWidth,
                    height: containerRef.current.offsetHeight
                });
            }
        };

        // Initial size
        updateSize();

        // Observer for changes
        const observer = new ResizeObserver(updateSize);
        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, []);

    // Atualiza canvas quando muda o tamanho (cuidado: isso limpa a assinatura)
    // Para mitigar, poderíamos salvar os dados e restaurar, mas 
    // como é um modal e o resize geralmente acontece na abertura, ok.
    useEffect(() => {
        if (sigCanvas.current && canvasSize.width > 0) {
            sigCanvas.current.clear(); // Limpa ao redimensionar para evitar distorção
            setIsEmpty(true);
        }
    }, [canvasSize.width, canvasSize.height]);

    const clear = () => {
        sigCanvas.current?.clear();
        setIsEmpty(true);
    };

    const save = () => {
        if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
            // Usando getCanvas() direto para evitar erro do trim-canvas no Vite
            const dataUrl = sigCanvas.current.getCanvas().toDataURL('image/png');
            onSave(dataUrl);
        }
    };

    const handleEnd = () => {
        if (sigCanvas.current) {
            setIsEmpty(sigCanvas.current.isEmpty());
        }
    };

    return (
        <div className="flex flex-col h-full bg-white overflow-hidden relative">
            {/* Área de assinatura - ocupa espaço disponível com margem para os botões */}
            <div ref={containerRef} className="flex-1 border-2 border-dashed border-gray-300 rounded-md m-1 relative bg-gray-50 mb-[80px] min-h-[300px]">
                {canvasSize.width > 0 && (
                    <SignatureCanvas
                        ref={sigCanvas}
                        penColor="black"
                        canvasProps={{
                            width: canvasSize.width,
                            height: canvasSize.height,
                            className: "absolute top-0 left-0 w-full h-full rounded-md cursor-crosshair"
                        }}
                        onEnd={handleEnd}
                    />
                )}
                {isEmpty && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-gray-400">
                        <span className="text-lg">Assine aqui</span>
                    </div>
                )}
            </div>

            {/* Botões - fixos na parte inferior */}
            <div className="absolute bottom-0 left-0 right-0 p-3 border-t flex gap-2 justify-between bg-white z-10">
                <Button variant="outline" onClick={onCancel} className="flex-1 h-12">
                    <X className="w-4 h-4 mr-1" />
                    Cancelar
                </Button>

                <Button variant="secondary" onClick={clear} disabled={isEmpty} className="flex-1 h-12">
                    <Eraser className="w-4 h-4 mr-1" />
                    Limpar
                </Button>

                <Button onClick={save} disabled={isEmpty} className="flex-1 h-12 bg-[#DAA520] hover:bg-[#B8860B] text-white">
                    <Check className="w-4 h-4 mr-1" />
                    Confirmar
                </Button>
            </div>
        </div>
    );
}
