import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";
import { buildApiUrl } from "@/lib/api-config";
import { normalizeItems } from "@/lib/normalize";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wrench, Car, Users, User, CheckCircle2 } from "lucide-react";

// Forms
import ServiceForm from "@/components/forms/ServiceForm";
import VehicleForm from "@/components/forms/VehicleForm";
import ClientForm from "@/components/forms/ClientForm";
import TechnicianForm from "@/components/forms/TechnicianForm";
import TeamForm from "@/components/forms/TempTeamForm";

import type { Service, Vehicle, Technician, Team, Client } from "@shared/schema";

interface OnboardingCounts {
    services: number;
    vehicles: number;
    technicians: number;
    teams: number;
    clients: number;
}

interface OnboardingBlockProps {
    counts: OnboardingCounts;
}

// Card data for the 4 onboarding steps
const onboardingCards = [
    {
        id: "services",
        number: 1,
        title: "Cadastrar Serviços",
        description: "Defina os tipos de serviços oferecidos pela sua empresa",
        icon: Wrench,
        countKey: "services" as const,
    },
    {
        id: "vehicles",
        number: 2,
        title: "Cadastrar Veículos",
        description: "Adicione os veículos utilizados pela sua equipe",
        icon: Car,
        countKey: "vehicles" as const,
    },
    {
        id: "technicians",
        number: 3,
        title: "Cadastrar Técnicos / Equipes",
        description: "Registre os profissionais que realizam os serviços",
        icon: Users,
        countKey: "technicians" as const,
    },
    {
        id: "clients",
        number: 4,
        title: "Cadastrar Clientes",
        description: "Adicione os clientes que receberão os serviços",
        icon: User,
        countKey: "clients" as const,
    },
];

export default function OnboardingBlock({ counts }: OnboardingBlockProps) {
    const queryClient = useQueryClient();

    // Modal states
    const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
    const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
    const [isTechnicianModalOpen, setIsTechnicianModalOpen] = useState(false);
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);

    // Tab state for technician/team modal
    const [technicianTab, setTechnicianTab] = useState<"technician" | "team">("technician");

    // Fetch data needed for forms
    const { data: servicesData } = useQuery({
        queryKey: ["/api/services"],
        queryFn: async () => {
            const response = await fetch(buildApiUrl("/api/services?page=1&pageSize=50"), {
                headers: getAuthHeaders(),
            });
            return response.json();
        },
        staleTime: 5 * 60_000,
    });
    const services = normalizeItems<Service>(servicesData);

    const { data: techniciansData } = useQuery({
        queryKey: ["/api/technicians"],
        queryFn: async () => {
            const response = await fetch(buildApiUrl("/api/technicians?page=1&pageSize=50"), {
                headers: getAuthHeaders(),
            });
            return response.json();
        },
        staleTime: 2 * 60_000,
    });
    const technicians = normalizeItems<Technician>(techniciansData);

    const { data: teamsData } = useQuery({
        queryKey: ["/api/teams"],
        queryFn: async () => {
            const response = await fetch(buildApiUrl("/api/teams?page=1&pageSize=50"), {
                headers: getAuthHeaders(),
            });
            return response.json();
        },
        staleTime: 2 * 60_000,
    });
    const teams = normalizeItems<Team>(teamsData);

    const { data: vehiclesData } = useQuery({
        queryKey: ["/api/vehicles"],
        queryFn: async () => {
            const response = await fetch(buildApiUrl("/api/vehicles?page=1&pageSize=50"), {
                headers: getAuthHeaders(),
            });
            return response.json();
        },
        staleTime: 2 * 60_000,
    });
    const vehicles = normalizeItems<Vehicle>(vehiclesData);

    // Handlers to open modals
    const handleCardClick = (cardId: string) => {
        switch (cardId) {
            case "services":
                setIsServiceModalOpen(true);
                break;
            case "vehicles":
                setIsVehicleModalOpen(true);
                break;
            case "technicians":
                setIsTechnicianModalOpen(true);
                break;
            case "clients":
                setIsClientModalOpen(true);
                break;
        }
    };

    // Form close handlers that invalidate cache
    const handleServiceClose = () => {
        setIsServiceModalOpen(false);
        queryClient.invalidateQueries({ queryKey: ["/api/services"] });
    };

    const handleVehicleClose = () => {
        setIsVehicleModalOpen(false);
        queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
    };

    const handleTechnicianClose = () => {
        setIsTechnicianModalOpen(false);
        queryClient.invalidateQueries({ queryKey: ["/api/technicians"] });
        queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
    };

    const handleClientClose = () => {
        setIsClientModalOpen(false);
        queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
    };

    // Check if a step is completed (count for technicians includes teams)
    const isCompleted = (countKey: keyof OnboardingCounts) => {
        if (countKey === "technicians") {
            return counts.technicians > 0 || counts.teams > 0;
        }
        return counts[countKey] > 0;
    };

    return (
        <>
            {/* Onboarding Block */}
            <Card className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-zinc-800 dark:to-zinc-900 border-amber-200 dark:border-zinc-700 mb-6">
                <CardContent className="p-6">
                    <div className="mb-4">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100">
                            Configure o básico
                        </h2>
                        <p className="text-gray-600 dark:text-zinc-400">
                            Siga estes passos para criar seu primeiro agendamento.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {onboardingCards.map((card) => {
                            const completed = isCompleted(card.countKey);
                            const Icon = card.icon;

                            return (
                                <button
                                    key={card.id}
                                    onClick={() => handleCardClick(card.id)}
                                    className={`
                    relative p-4 rounded-lg border-2 text-left transition-all
                    hover:shadow-md hover:scale-[1.02]
                    ${completed
                                            ? "bg-green-50 border-green-300 dark:bg-green-900/20 dark:border-green-700"
                                            : "bg-white border-gray-200 dark:bg-zinc-800 dark:border-zinc-600 hover:border-amber-400"
                                        }
                  `}
                                >
                                    {/* Number badge */}
                                    <div className={`
                    absolute -top-2 -left-2 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold
                    ${completed
                                            ? "bg-green-500 text-white"
                                            : "bg-amber-500 text-white"
                                        }
                  `}>
                                        {completed ? <CheckCircle2 className="w-4 h-4" /> : card.number}
                                    </div>

                                    {/* Completion badge */}
                                    {completed && (
                                        <Badge className="absolute -top-2 -right-2 bg-green-500 text-white text-xs">
                                            ✅ Concluído
                                        </Badge>
                                    )}

                                    <div className="flex items-start gap-3 mt-2">
                                        <div className={`
                      p-2 rounded-lg
                      ${completed
                                                ? "bg-green-100 dark:bg-green-800/30"
                                                : "bg-amber-100 dark:bg-amber-800/30"
                                            }
                    `}>
                                            <Icon className={`w-5 h-5 ${completed ? "text-green-600" : "text-amber-600"}`} />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-gray-900 dark:text-zinc-100 text-sm">
                                                {card.title}
                                            </h3>
                                            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                                                {card.description}
                                            </p>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Service Modal */}
            <Dialog open={isServiceModalOpen} onOpenChange={setIsServiceModalOpen}>
                <DialogContent className="max-w-lg">
                    <ServiceForm service={null} onClose={handleServiceClose} />
                </DialogContent>
            </Dialog>

            {/* Vehicle Modal */}
            <Dialog open={isVehicleModalOpen} onOpenChange={setIsVehicleModalOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <VehicleForm
                        vehicle={null}
                        technicians={technicians}
                        teams={teams}
                        vehicles={vehicles}
                        onClose={handleVehicleClose}
                    />
                </DialogContent>
            </Dialog>

            {/* Technician/Team Modal with Tabs */}
            <Dialog open={isTechnicianModalOpen} onOpenChange={setIsTechnicianModalOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <Tabs value={technicianTab} onValueChange={(v) => setTechnicianTab(v as "technician" | "team")}>
                        <TabsList className="grid w-full grid-cols-2 mb-4">
                            <TabsTrigger value="technician">
                                <User className="w-4 h-4 mr-2" />
                                Técnico
                            </TabsTrigger>
                            <TabsTrigger value="team">
                                <Users className="w-4 h-4 mr-2" />
                                Equipe
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="technician">
                            <TechnicianForm
                                technician={null}
                                services={services}
                                onClose={handleTechnicianClose}
                            />
                        </TabsContent>

                        <TabsContent value="team">
                            <TeamForm
                                team={null}
                                technicians={technicians}
                                services={services}
                                onClose={handleTechnicianClose}
                            />
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>

            {/* Client Modal */}
            <Dialog open={isClientModalOpen} onOpenChange={setIsClientModalOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <ClientForm client={null} onClose={handleClientClose} />
                </DialogContent>
            </Dialog>
        </>
    );
}
