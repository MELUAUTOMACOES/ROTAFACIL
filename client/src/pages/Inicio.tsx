import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, Sparkles } from "lucide-react";

export default function Inicio() {
    const { user } = useAuth();

    return (
        <div className="space-y-6">
            {/* Cabeçalho */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">
                    Bem-vindo ao{" "}
                    <span className="text-amber-500">Rota Fácil Frotas</span>
                    {user?.name ? `, ${user.name.split(" ")[0]}` : ""}!
                </h1>
                <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
                    Este espaço será utilizado para avisos e informações internas do
                    sistema. Aguarde atualizações em breve.
                </p>
            </div>

            {/* Cards informativos */}
            <div className="grid gap-4 sm:grid-cols-2">
                {/* Card: Avisos do sistema */}
                <Card className="border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20">
                    <CardHeader className="pb-2 flex flex-row items-center gap-3">
                        <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/40">
                            <Bell className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <CardTitle className="text-base text-amber-800 dark:text-amber-300">
                            Avisos do sistema
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-gray-600 dark:text-zinc-400">
                            Nenhum aviso no momento. Quando houver comunicados importantes,
                            eles aparecerão aqui.
                        </p>
                    </CardContent>
                </Card>

                {/* Card: Em breve */}
                <Card className="border border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50">
                    <CardHeader className="pb-2 flex flex-row items-center gap-3">
                        <div className="p-2 rounded-lg bg-gray-100 dark:bg-zinc-800">
                            <Sparkles className="h-5 w-5 text-gray-500 dark:text-zinc-400" />
                        </div>
                        <CardTitle className="text-base text-gray-700 dark:text-zinc-300">
                            Em breve
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-gray-600 dark:text-zinc-400">
                            Novidades e melhorias estão a caminho. Atualizaremos esta área
                            conforme o sistema evoluir.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
