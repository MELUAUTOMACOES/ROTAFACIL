import { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    LayoutDashboard,
    CalendarCheck,
    DollarSign,
    PieChart,
    Truck
} from "lucide-react";

export type DashboardTabKey = "overview" | "operations" | "financial" | "quality" | "fleet";

interface DashboardTabsProps {
    activeTab: DashboardTabKey;
    onTabChange: (tab: DashboardTabKey) => void;
    children: {
        overview: ReactNode;
        operations: ReactNode;
        financial: ReactNode;
        quality: ReactNode;
        fleet: ReactNode;
    };
}

export function DashboardTabs({ activeTab, onTabChange, children }: DashboardTabsProps) {
    const tabs: { key: DashboardTabKey; label: string; icon: typeof LayoutDashboard }[] = [
        { key: "overview", label: "Visão Geral", icon: LayoutDashboard },
        { key: "operations", label: "Operação", icon: CalendarCheck },
        { key: "financial", label: "Financeiro", icon: DollarSign },
        { key: "quality", label: "Qualidade", icon: PieChart },
        { key: "fleet", label: "Frota", icon: Truck },
    ];

    return (
        <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as DashboardTabKey)} className="w-full">
            <TabsList className="w-full grid grid-cols-5 mb-6 h-auto p-1">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <TabsTrigger
                            key={tab.key}
                            value={tab.key}
                            className="flex items-center gap-2 py-2.5 data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-sm dark:data-[state=active]:bg-zinc-800 dark:data-[state=active]:text-zinc-100"
                        >
                            <Icon className="w-4 h-4" />
                            <span className="hidden sm:inline">{tab.label}</span>
                        </TabsTrigger>
                    );
                })}
            </TabsList>

            <TabsContent value="overview" className="mt-0">
                {children.overview}
            </TabsContent>

            <TabsContent value="operations" className="mt-0">
                {children.operations}
            </TabsContent>

            <TabsContent value="financial" className="mt-0">
                {children.financial}
            </TabsContent>

            <TabsContent value="quality" className="mt-0">
                {children.quality}
            </TabsContent>

            <TabsContent value="fleet" className="mt-0">
                {children.fleet}
            </TabsContent>
        </Tabs>
    );
}
