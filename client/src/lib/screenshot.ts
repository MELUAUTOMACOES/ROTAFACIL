import { toPng } from "html-to-image";
import logoImg from "@assets/SEM FUNDO_1750819798590.png";

/**
 * Captura o elemento usando html-to-image.
 * Retorna um canvas com a imagem capturada.
 */
async function captureElement(element: HTMLElement): Promise<HTMLCanvasElement> {
    // Salva scroll atual da página
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    // Scroll para o topo para garantir captura completa
    window.scrollTo(0, 0);

    // Aguarda o reflow
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

    // Mede o tamanho TOTAL do elemento (incluindo conteúdo com scroll)
    const rect = element.getBoundingClientRect();
    const width = Math.ceil(Math.max(rect.width, element.scrollWidth));
    const height = Math.ceil(Math.max(rect.height, element.scrollHeight));

    try {
        // Captura usando html-to-image com alta qualidade
        // Força dimensões explícitas para capturar todo o conteúdo
        const dataUrl = await toPng(element, {
            quality: 1,
            pixelRatio: 2,
            cacheBust: true,
            width: width,
            height: height,
            // Filtro para ignorar elementos problemáticos
            filter: (node) => {
                // Ignora elementos de script e style inline
                if (node instanceof Element) {
                    const tagName = node.tagName.toLowerCase();
                    if (tagName === "script" || tagName === "noscript") {
                        return false;
                    }
                }
                return true;
            },
        });

        // Converte dataUrl para canvas
        const img = new Image();
        img.crossOrigin = "anonymous";

        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = reject;
            img.src = dataUrl;
        });

        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
            throw new Error("Could not get 2d context");
        }

        ctx.drawImage(img, 0, 0);
        return canvas;
    } finally {
        // Restaura scroll original
        window.scrollTo(scrollX, scrollY);
    }
}

/**
 * Desenha o conteúdo capturado com moldura e footer.
 */
function drawFinalImage(
    canvas: HTMLCanvasElement,
    logoImage: HTMLImageElement
): HTMLCanvasElement {
    // Design Configuration
    const padding = 40;
    const footerHeight = 80;
    const borderWidth = 2;
    const themeColor = "#DAA520";

    // Detecta o tema atual do sistema
    const isDarkMode = document.documentElement.classList.contains("dark");
    const backgroundColor = isDarkMode ? "#09090b" : "#ffffff";

    // Prepare final canvas
    const finalCanvas = document.createElement("canvas");
    const finalWidth = canvas.width + (padding * 2);
    const finalHeight = canvas.height + (padding * 2) + footerHeight;

    finalCanvas.width = finalWidth;
    finalCanvas.height = finalHeight;
    const ctx = finalCanvas.getContext("2d");

    if (!ctx) {
        throw new Error("Could not get 2d context");
    }

    // Draw Background (Dark Theme)
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, finalWidth, finalHeight);

    // Draw Border
    ctx.strokeStyle = themeColor;
    ctx.lineWidth = borderWidth * 2;
    ctx.strokeRect(0, 0, finalWidth, finalHeight);

    // Draw Content (Centered)
    ctx.drawImage(canvas, padding, padding);

    // Draw Footer Background
    ctx.fillStyle = themeColor;
    ctx.fillRect(0, finalHeight - footerHeight, finalWidth, footerHeight);

    // Logo Layout
    const logoTargetHeight = 50;
    const logoTargetWidth = (logoImage.width / logoImage.height) * logoTargetHeight;
    const footerCenterY = finalHeight - (footerHeight / 2);

    // Draw Logo
    ctx.drawImage(logoImage, padding, footerCenterY - (logoTargetHeight / 2), logoTargetWidth, logoTargetHeight);

    // Draw Text
    ctx.font = "bold 28px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#1a1a1a";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText("Feito por: RotaFácil Frotas", padding + logoTargetWidth + 20, footerCenterY);

    return finalCanvas;
}

export async function captureAndShare(element: HTMLElement, fileName: string = "dashboard-rotafacil.png") {
    const originalOverflowX = document.documentElement.style.overflowX;
    try {
        document.documentElement.style.overflowX = "hidden";

        // 0) Garante que as fontes terminaram de carregar
        if ((document as any).fonts?.ready) {
            await (document as any).fonts.ready;
        }

        // 1. Captura o elemento usando html-to-image
        const canvas = await captureElement(element);

        // 2. Carrega o logo
        const logoImage = new Image();
        logoImage.crossOrigin = "anonymous";
        logoImage.src = logoImg;

        await new Promise((resolve, reject) => {
            logoImage.onload = resolve;
            logoImage.onerror = reject;
        });

        // 3. Desenha imagem final com moldura e footer
        const finalCanvas = drawFinalImage(canvas, logoImage);

        // 4. Trigger Download
        const link = document.createElement("a");
        link.download = fileName;
        link.href = finalCanvas.toDataURL("image/png");
        link.click();
    } catch (error) {
        alert("Erro ao gerar imagem. Tente novamente.");
    } finally {
        document.documentElement.style.overflowX = originalOverflowX;
    }
}
