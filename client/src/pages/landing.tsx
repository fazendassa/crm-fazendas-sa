
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export default function Landing() {
  const [showLogo, setShowLogo] = useState(false);

  useEffect(() => {
    // Trigger logo appearance after tractor animation
    const timer = setTimeout(() => {
      setShowLogo(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex flex-col">
      {/* Header */}
      <header className="w-full px-8 py-6 flex justify-between items-center">
        <div className="text-lg font-medium text-gray-800">
          Fazendas S/A CRM
        </div>
        <div className="flex items-center space-x-6 text-sm text-gray-600">
          <button 
            className="hover:text-gray-800 transition-colors"
            onClick={() => window.location.href = '/api/login'}
          >
            Iniciar sessão
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        {/* Animated Circle with Logo */}
        <div className="relative mb-16">
          {/* Animated Dots Circle */}
          <div className="relative w-80 h-80 mx-auto mb-8">
            <div className="absolute inset-0 animate-spin-slow">
              {[...Array(60)].map((_, i) => {
                const angle = (i * 360) / 60;
                const radius = 140;
                const x = Math.cos((angle * Math.PI) / 180) * radius;
                const y = Math.sin((angle * Math.PI) / 180) * radius;
                const hue = (i * 360) / 60;
                
                return (
                  <div
                    key={i}
                    className="absolute w-3 h-3 rounded-full opacity-70"
                    style={{
                      left: `calc(50% + ${x}px - 6px)`,
                      top: `calc(50% + ${y}px - 6px)`,
                      backgroundColor: `hsl(${hue}, 70%, 60%)`,
                      animationDelay: `${i * 0.1}s`,
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* Tractor Animation */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="tractor-container relative">
              {/* Tractor moving across */}
              <div className="tractor animate-tractor-move">
                🚜
              </div>
              
              {/* Logo appears after tractor */}
              <div className={`logo-container absolute inset-0 flex items-center justify-center transition-all duration-1000 ${showLogo ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
                <div className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                  F/A
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Title */}
        <h1 className="text-5xl font-bold text-gray-900 mb-4 leading-tight">
          O CRM Exclusivo da Fazendas S/A
        </h1>

        {/* Subtitle */}
        <p className="text-xl text-gray-600 mb-12 max-w-2xl leading-relaxed">
          Uma única plataforma para gerenciar todos os seus contatos, empresas e oportunidades de negócio no agronegócio.
          <br />
          Inicie sessão para acessar sua conta.
        </p>

        {/* CTA Button */}
        <Button 
          size="lg" 
          className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-full text-lg font-medium transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
          onClick={() => window.location.href = '/api/login'}
        >
          Iniciar sessão
        </Button>

        
      </main>

      {/* Footer */}
      <footer className="w-full px-8 py-6 text-center text-sm text-gray-500">
        © 2024 Fazendas S/A. Todos os direitos reservados.
      </footer>
    </div>
  );
}
