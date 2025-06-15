import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Truck, 
  MapPin, 
  Clock, 
  DollarSign, 
  Calendar, 
  Settings, 
  History,
  Plus,
  Menu,
  X
} from "lucide-react";

export default function Home() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const slides = [
    {
      title: "Roteirização Eficiente",
      subtitle: "Planeje suas rotas de forma prática e eficiente, otimizando o tempo e a distância para suas entregas.",
      buttonText: "Comece Agora",
      image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200&h=600&fit=crop"
    },
    {
      title: "Economia de Recursos",
      subtitle: "Com RotaFácil, você reduz custos operacionais com rotas inteligentes e planejamento eficiente.",
      buttonText: "Ver Benefícios",
      image: "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=1200&h=600&fit=crop"
    },
    {
      title: "Gestão Completa",
      subtitle: "Gerencie clientes, técnicos, veículos e agendamentos em uma única plataforma integrada.",
      buttonText: "Conhecer Sistema",
      image: "https://images.unsplash.com/photo-1559526324-593bc073d938?w=1200&h=600&fit=crop"
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex-shrink-0">
              <h1 className="text-2xl font-bold text-gray-900">
                Rota<span className="text-yellow-500">Fácil</span>
              </h1>
            </div>

            {/* Desktop Menu - Removido botão "Login", mantido apenas "Acessar Sistema" */}
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-8">
                <a href="#home" className="text-gray-900 hover:text-yellow-500 px-3 py-2 text-sm font-medium">
                  Home
                </a>
                <a href="#funcionalidades" className="text-gray-700 hover:text-yellow-500 px-3 py-2 text-sm font-medium">
                  Funcionalidades
                </a>
                <a href="#precos" className="text-gray-700 hover:text-yellow-500 px-3 py-2 text-sm font-medium">
                  Preços
                </a>
                <Link href="/login">
                  <Button className="bg-gray-900 text-white hover:bg-gray-800">
                    Acessar Sistema
                  </Button>
                </Link>
              </div>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Menu - Removido botão "Login", mantido apenas "Acessar Sistema" */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white border-t border-gray-200">
              <a href="#home" className="text-gray-900 hover:text-yellow-500 block px-3 py-2 text-base font-medium">
                Home
              </a>
              <a href="#funcionalidades" className="text-gray-700 hover:text-yellow-500 block px-3 py-2 text-base font-medium">
                Funcionalidades
              </a>
              <a href="#precos" className="text-gray-700 hover:text-yellow-500 block px-3 py-2 text-base font-medium">
                Preços
              </a>
              <div className="px-3 py-2">
                <Link href="/login">
                  <Button className="w-full bg-gray-900 text-white hover:bg-gray-800">
                    Acessar Sistema
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section with Carousel */}
      <section id="home" className="relative h-96 md:h-[500px] overflow-hidden">
        {slides.map((slide, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              index === currentSlide ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
              backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url(${slide.image})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-white px-4 max-w-4xl">
                <h1 className="text-4xl md:text-6xl font-bold mb-4">
                  {slide.title}
                </h1>
                <p className="text-lg md:text-xl mb-8 max-w-2xl mx-auto">
                  {slide.subtitle}
                </p>
                <Link href="/login">
                  <Button size="lg" className="bg-yellow-500 text-gray-900 hover:bg-yellow-400 font-semibold px-8 py-3">
                    {slide.buttonText}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        ))}

        {/* Slide Indicators */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
          {slides.map((_, index) => (
            <button
              key={index}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                index === currentSlide ? 'bg-yellow-500' : 'bg-white bg-opacity-50'
              }`}
              onClick={() => setCurrentSlide(index)}
            />
          ))}
        </div>
      </section>

      {/* Features Overview */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Simplifique sua operação com o RotaFácil
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Nossa plataforma foi projetada para tornar sua operação logística mais eficiente,
              economizando tempo e recursos enquanto melhora a satisfação do cliente.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="text-center p-6 hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Truck className="h-6 w-6 text-yellow-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Otimize Entregas
                </h3>
                <p className="text-gray-600">
                  Reduza o tempo de entrega com rotas inteligentes e eficientes
                  para sua frota.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center p-6 hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <MapPin className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Gerencie sua frota num só lugar
                </h3>
                <p className="text-gray-600">
                  Pensado para gestores e operadores, tudo em um
                  único lugar!
                </p>
              </CardContent>
            </Card>

            <Card className="text-center p-6 hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Calendar className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Agendamento Simples
                </h3>
                <p className="text-gray-600">
                  Planeje suas entregas com antecedência e
                  organize seus recursos de forma eficiente.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center p-6 hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <DollarSign className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Redução de Custos
                </h3>
                <p className="text-gray-600">
                  Economize combustível e tempo com rotas
                  otimizadas e melhor gerenciamento.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Detailed Features */}
      <section id="funcionalidades" className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Funcionalidades do RotaFácil
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Conheça as ferramentas que vão transformar sua logística e otimizar suas
              entregas
            </p>
          </div>

          <div className="flex justify-center gap-4 mb-12">
            <Button variant="default" className="bg-gray-900 text-white">
              Ver Planos
            </Button>
            <Button variant="outline">
              Começar Agora
            </Button>
          </div>

          {/* Main Features */}
          <div className="mb-16">
            <h3 className="text-2xl font-bold text-center text-gray-900 mb-8">
              Recursos Principais
            </h3>
            <p className="text-center text-gray-600 mb-12">
              Conheça as funcionalidades essenciais do RotaFácil
            </p>

            <div className="grid md:grid-cols-2 gap-8">
              <Card className="p-6 border-2 border-yellow-200 bg-yellow-50">
                <CardContent className="pt-0">
                  <div className="flex items-center mb-4">
                    <div className="w-12 h-12 bg-yellow-500 rounded-lg flex items-center justify-center mr-4">
                      <MapPin className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      Roteirização Inteligente
                    </h3>
                  </div>
                  <p className="text-gray-700">
                    Sistema inteligente de criação de rotas que otimiza percursos,
                    economizando tempo e combustível.
                  </p>
                </CardContent>
              </Card>

              <Card className="p-6">
                <CardContent className="pt-0">
                  <div className="flex items-center mb-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mr-4">
                      <Calendar className="h-6 w-6 text-gray-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      Agendamento de Serviços
                    </h3>
                  </div>
                  <p className="text-gray-700">
                    Agende entregas e serviços com facilidade e garanta o
                    planejamento eficiente da sua operação.
                  </p>
                </CardContent>
              </Card>

              <Card className="p-6">
                <CardContent className="pt-0">
                  <div className="flex items-center mb-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mr-4">
                      <History className="h-6 w-6 text-gray-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      Histórico de Rotas
                    </h3>
                  </div>
                  <p className="text-gray-700">
                    Acesse e analise o histórico completo das rotas realizadas para
                    otimizar futuras operações.
                  </p>
                </CardContent>
              </Card>

              <Card className="p-6 border-2 border-yellow-200 bg-yellow-50">
                <CardContent className="pt-0">
                  <div className="flex items-center mb-4">
                    <div className="w-12 h-12 bg-yellow-500 rounded-lg flex items-center justify-center mr-4">
                      <Calendar className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      Encontre uma data
                    </h3>
                  </div>
                  <p className="text-gray-700">
                    Procure por uma data, com a menor distância de acordo com seus serviços já agendados.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Advanced Features */}
          <div>
            <h3 className="text-2xl font-bold text-center text-gray-900 mb-8">
              Recursos Avançados
            </h3>
            <p className="text-center text-gray-600 mb-12">
              Funcionalidades para levar sua operação ao próximo nível
            </p>

            <div className="grid md:grid-cols-2 gap-8">
              <Card className="p-6">
                <CardContent className="pt-0">
                  <div className="flex items-center mb-4">
                    <div className="w-8 h-8 bg-gray-900 rounded flex items-center justify-center mr-4">
                      <Plus className="h-4 w-4 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Inclusão de Rota
                    </h3>
                  </div>
                  <p className="text-gray-700">
                    Adicione rotas manualmente quando necessário, com total
                    flexibilidade para sua operação.
                  </p>
                </CardContent>
              </Card>

              <Card className="p-6">
                <CardContent className="pt-0">
                  <div className="flex items-center mb-4">
                    <div className="w-8 h-8 bg-gray-900 rounded flex items-center justify-center mr-4">
                      <Settings className="h-4 w-4 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Configurações Personalizadas
                    </h3>
                  </div>
                  <p className="text-gray-700">
                    Adapte o sistema às necessidades específicas da sua operação
                    com diversas opções de personalização.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Comparison */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Compare os Planos
            </h2>
            <p className="text-lg text-gray-600">
              Veja quais funcionalidades estão disponíveis em cada plano
            </p>
          </div>

          {/* Tabela alterada para 4 colunas com novos dados conforme solicitado */}
          <div className="overflow-x-auto">
            <table className="w-full bg-white rounded-lg shadow-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-4 px-6 font-semibold text-gray-900">Funcionalidade</th>
                  <th className="text-center py-4 px-6 font-semibold text-gray-900">Básico</th>
                  <th className="text-center py-4 px-6 font-semibold text-gray-900 bg-yellow-50">Profissional</th>
                  <th className="text-center py-4 px-6 font-semibold text-gray-900">Empresarial</th>
                  <th className="text-center py-4 px-6 font-semibold text-gray-900">Personalizado</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-4 px-6 text-gray-700">Nº de Roteirização</td>
                  <td className="text-center py-4 px-6 text-gray-600">até 150 requisições/mês</td>
                  <td className="text-center py-4 px-6 bg-yellow-50 text-gray-900">até 800 requisições/mês</td>
                  <td className="text-center py-4 px-6 text-gray-900">até 5000 requisições/mês</td>
                  <td className="text-center py-4 px-6 text-gray-900">Sob consulta</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-4 px-6 text-gray-700">Número de veículos</td>
                  <td className="text-center py-4 px-6 text-gray-600">até 5 veículos</td>
                  <td className="text-center py-4 px-6 bg-yellow-50 text-gray-900">até 12 veículos</td>
                  <td className="text-center py-4 px-6 text-gray-900">até 30 veículos</td>
                  <td className="text-center py-4 px-6 text-gray-900">Sob consulta</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-4 px-6 text-gray-700">Número de técnicos</td>
                  <td className="text-center py-4 px-6 text-gray-600">até 5 técnicos</td>
                  <td className="text-center py-4 px-6 bg-yellow-50 text-gray-900">até 12 técnicos</td>
                  <td className="text-center py-4 px-6 text-gray-900">até 30 técnicos</td>
                  <td className="text-center py-4 px-6 text-gray-900">Sob consulta</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-4 px-6 text-gray-700">Histórico de rotas</td>
                  <td className="text-center py-4 px-6 text-gray-600">30 dias</td>
                  <td className="text-center py-4 px-6 bg-yellow-50 text-gray-900">120 dias</td>
                  <td className="text-center py-4 px-6 text-gray-900">360 dias</td>
                  <td className="text-center py-4 px-6 text-gray-900">Sob consulta</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-4 px-6 text-gray-700">Agendamento de serviços</td>
                  <td className="text-center py-4 px-6 text-gray-600">✓</td>
                  <td className="text-center py-4 px-6 bg-yellow-50 text-gray-900">✓</td>
                  <td className="text-center py-4 px-6 text-gray-900">✓</td>
                  <td className="text-center py-4 px-6 text-gray-900">Sob consulta</td>
                </tr>
                <tr>
                  <td className="py-4 px-6 text-gray-700">Ache uma data</td>
                  <td className="text-center py-4 px-6 text-gray-600">✓</td>
                  <td className="text-center py-4 px-6 bg-yellow-50 text-gray-900">✓</td>
                  <td className="text-center py-4 px-6 text-gray-900">✓</td>
                  <td className="text-center py-4 px-6 text-gray-900">Sob consulta</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Pricing Plans */}
      <section id="precos" className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Planos e Preços
            </h2>
            <p className="text-lg text-gray-600">
              Escolha o plano ideal para o seu negócio e otimize suas rotas com
              RotaFácil
            </p>
          </div>

          {/* Seção de planos ajustada para refletir os dados da tabela "Compare os Planos" */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Basic Plan */}
            <Card className="relative">
              <CardContent className="p-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Básico</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">R$ 99</span>
                  <span className="text-gray-600">/mês</span>
                </div>
                <p className="text-gray-600 mb-6">
                  Ideal para pequenas empresas e autônomos
                </p>
                
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                    Até 150 requisições/mês
                  </li>
                  <li className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                    Até 5 veículos
                  </li>
                  <li className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                    Até 5 técnicos
                  </li>
                  <li className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                    Histórico de rotas (30 dias)
                  </li>
                  <li className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                    Agendamento de serviços
                  </li>
                  <li className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                    Ache uma data
                  </li>
                </ul>

                <Button variant="outline" className="w-full">
                  Comece Grátis
                </Button>
              </CardContent>
            </Card>

            {/* Professional Plan */}
            <Card className="relative border-2 border-yellow-200">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-yellow-500 text-gray-900 px-4 py-1 rounded-full text-sm font-semibold">
                  Mais Popular
                </span>
              </div>
              <CardContent className="p-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Profissional</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">R$ 199</span>
                  <span className="text-gray-600">/mês</span>
                </div>
                <p className="text-gray-600 mb-6">
                  Perfeito para empresas em crescimento
                </p>
                
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                    Até 800 requisições/mês
                  </li>
                  <li className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                    Até 12 veículos
                  </li>
                  <li className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                    Até 12 técnicos
                  </li>
                  <li className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                    Histórico de rotas (120 dias)
                  </li>
                  <li className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                    Agendamento de serviços
                  </li>
                  <li className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                    Ache uma data
                  </li>
                </ul>

                <Button className="w-full bg-yellow-500 text-gray-900 hover:bg-yellow-400">
                  Escolher Plano
                </Button>
              </CardContent>
            </Card>

            {/* Enterprise Plan */}
            <Card className="relative">
              <CardContent className="p-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Empresarial</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">R$ 399</span>
                  <span className="text-gray-600">/mês</span>
                </div>
                <p className="text-gray-600 mb-6">
                  Para frotas grandes e operações complexas
                </p>
                
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                    Até 5000 requisições/mês
                  </li>
                  <li className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                    Até 30 veículos
                  </li>
                  <li className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                    Até 30 técnicos
                  </li>
                  <li className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                    Histórico de rotas (360 dias)
                  </li>
                  <li className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                    Agendamento de serviços
                  </li>
                  <li className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                    Ache uma data
                  </li>
                </ul>

                <Button variant="outline" className="w-full">
                  Contatar Vendas
                </Button>
              </CardContent>
            </Card>

            {/* Personalizado Plan */}
            <Card className="relative">
              <CardContent className="p-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Personalizado</h3>
                <div className="mb-6">
                  <span className="text-2xl font-bold text-gray-900">Sob consulta</span>
                </div>
                <p className="text-gray-600 mb-6">
                  Soluções personalizadas para suas necessidades específicas
                </p>
                
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                    Roteirização sob consulta
                  </li>
                  <li className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                    Veículos sob consulta
                  </li>
                  <li className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                    Técnicos sob consulta
                  </li>
                  <li className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                    Histórico sob consulta
                  </li>
                  <li className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                    Recursos sob consulta
                  </li>
                </ul>

                <Button variant="outline" className="w-full">
                  Contatar Vendas
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h3 className="text-2xl font-bold mb-4">
              Rota<span className="text-yellow-500">Fácil</span>
            </h3>
            <p className="text-gray-400 mb-8 max-w-2xl mx-auto">
              Otimize suas rotas, economize recursos e melhore a eficiência da sua operação
              com nossa plataforma completa de gestão logística.
            </p>
            
            <div className="flex justify-center space-x-6 mb-8">
              <Link href="/login" className="text-gray-400 hover:text-yellow-500 transition-colors">
                Acessar Sistema
              </Link>
              <a href="#funcionalidades" className="text-gray-400 hover:text-yellow-500 transition-colors">
                Funcionalidades
              </a>
              <a href="#precos" className="text-gray-400 hover:text-yellow-500 transition-colors">
                Preços
              </a>
            </div>
            
            <div className="border-t border-gray-800 pt-8">
              <p className="text-gray-400 text-sm">
                © 2025 RotaFácil. Todos os direitos reservados.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}