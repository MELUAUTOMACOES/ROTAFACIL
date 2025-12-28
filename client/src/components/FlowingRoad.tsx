/**
 * FlowingRoad (suave)
 *
 * Gera uma estrada "rio / S" usando uma linha central senoidal ao longo do eixo Y
 * e cria as bordas (esq/dir) deslocando perpendicularmente à curva.
 * Assim: sem curvas quebradas e com largura consistente mesmo nas curvas.
 */

import { useEffect, useRef, useState } from "react";

interface FlowingRoadProps {
    color?: string;
    opacity?: number;
    /**
     * Intensidade do "S" (0-1). Ex: 0.6 fica sutil, 1 fica mais marcado
     */
    intensity?: number;
    /**
     * Se true, a estrada fica estática (sem animação de scroll)
     */
    static?: boolean;
}

type Pt = { x: number; y: number };

export default function FlowingRoad({
    // Sugestão: usar o amarelo oficial do RotaFácil (#DAA520)
    color = "#DAA520",
    opacity = 0.14,
    intensity = 0.85,
    static: isStatic = false,
}: FlowingRoadProps) {
    const [scrollProgress, setScrollProgress] = useState(0);
    const rafRef = useRef<number | null>(null);

    useEffect(() => {
        // Se estático, não adiciona listener de scroll
        if (isStatic) return;

        const onScroll = () => {
            // evita disparar state muitas vezes por segundo
            if (rafRef.current) return;

            rafRef.current = window.requestAnimationFrame(() => {
                const scrollY = window.scrollY;
                const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
                const p = maxScroll > 0 ? scrollY / maxScroll : 0;
                setScrollProgress(p);
                rafRef.current = null;
            });
        };

        window.addEventListener("scroll", onScroll, { passive: true });
        onScroll();

        return () => {
            window.removeEventListener("scroll", onScroll);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [isStatic]);

    /**
     * Converte pontos em um path suave com Catmull-Rom -> Bezier
     * (isso elimina as “quebras” entre segmentos)
     */
    const catmullRomToBezierPath = (points: Pt[]) => {
        if (points.length < 2) return "";

        const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

        let d = `M ${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;

        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[clamp(i - 1, 0, points.length - 1)];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[clamp(i + 2, 0, points.length - 1)];

            // fator de suavidade (0.5 é bem padrão)
            const t = 0.5;

            const c1x = p1.x + ((p2.x - p0.x) * t) / 6;
            const c1y = p1.y + ((p2.y - p0.y) * t) / 6;
            const c2x = p2.x - ((p3.x - p1.x) * t) / 6;
            const c2y = p2.y - ((p3.y - p1.y) * t) / 6;

            d += ` C ${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(
                2
            )} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
        }

        return d;
    };

    /**
     * Gera pontos da linha central (S) ao longo do Y (0..100).
     * Depois gera bordas deslocando perpendicularmente (normal da curva).
     */
    const buildRoadPaths = () => {
        // Ajustes “macro” do S (mexe aqui pra ficar mais “rio” ou mais “S”)
        const centerBaseX = 62; // onde a estrada “mora” no X (0..100). ex: 62 joga pra direita
        const amplitude = 18 * intensity; // “largura” do S
        const waves = 1.35; // quantas voltas ao longo da tela (1.2~1.6 costuma ficar elegante)

        // A fase muda com scroll (dá a sensação de movimento contínuo)
        const phase = scrollProgress * Math.PI * 2 * 1.1;

        // Qualidade: mais pontos = curva mais suave
        const stepY = 4; // 3-5 é ótimo. Quanto menor, mais suave e mais custo.

        // “meia largura” da estrada (deslocamento das bordas)
        const halfWidth = 2.7; // mexa: 2.2 (fina) até 3.4 (larga)

        const center: Pt[] = [];
        const left: Pt[] = [];
        const right: Pt[] = [];

        // Para calcular a normal, usamos a diferença entre pontos (tangente)
        const getX = (y: number) => {
            const yy = y / 100;
            return (
                centerBaseX +
                Math.sin(yy * Math.PI * 2 * waves + phase) * amplitude * 0.85 +
                Math.sin(yy * Math.PI * 2 * (waves * 0.55) + phase * 0.7) * (amplitude * 0.25)
            );
        };

        // gera pontos
        for (let y = 0; y <= 100; y += stepY) {
            const x = getX(y);
            center.push({ x, y });
        }

        // bordas por normal
        for (let i = 0; i < center.length; i++) {
            const p = center[i];
            const prev = center[Math.max(0, i - 1)];
            const next = center[Math.min(center.length - 1, i + 1)];

            // tangente aproximada (direção da curva)
            const dx = next.x - prev.x;
            const dy = next.y - prev.y;

            // normal (perpendicular)
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const nx = -dy / len;
            const ny = dx / len;

            left.push({ x: p.x + nx * halfWidth, y: p.y + ny * halfWidth });
            right.push({ x: p.x - nx * halfWidth, y: p.y - ny * halfWidth });
        }

        return {
            leftPath: catmullRomToBezierPath(left),
            centerPath: catmullRomToBezierPath(center),
            rightPath: catmullRomToBezierPath(right),
        };
    };

    const { leftPath, centerPath, rightPath } = buildRoadPaths();

    // movimento do pontilhado: combina scroll + um “empurrão” extra (fica mais vivo)
    const dashOffset = -(scrollProgress * 260);

    return (
        <svg
            className="fixed inset-0 w-full h-full pointer-events-none z-0"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{ opacity }}
            aria-hidden="true"
        >
            {/* Borda esquerda */}
            <path
                d={leftPath}
                stroke={color}
                strokeWidth="0.28"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* Linha central pontilhada */}
            <path
                d={centerPath}
                stroke={color}
                strokeWidth="0.20"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="2.6,2.2"
                style={{
                    strokeDashoffset: dashOffset,
                    transition: "stroke-dashoffset 0.08s linear",
                }}
            />

            {/* Borda direita */}
            <path
                d={rightPath}
                stroke={color}
                strokeWidth="0.28"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}
