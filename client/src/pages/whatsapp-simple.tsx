import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  MessageCircle, 
  Power,
  PowerOff,
  Smartphone,
  QrCode
} from "lucide-react";

export default function WhatsApp() {
  const [sessionStatus, setSessionStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");

  return (
    <div className="flex h-[calc(100vh-5rem)]">
      {/* Sidebar */}
      <div className="w-80 apple-card border-r apple-divider">
        <div className="p-6 border-b apple-divider">
          <h1 className="text-2xl font-semibold text-gray-900">WhatsApp</h1>
        </div>
        
        {/* Session Management */}
        <div className="p-4">
          <Card className="apple-card-nested">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Sessão WhatsApp
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Status:</span>
                <Badge variant={sessionStatus === "connected" ? "default" : "secondary"}>
                  {sessionStatus === "connected" ? "Conectado" : 
                   sessionStatus === "connecting" ? "Conectando..." : "Desconectado"}
                </Badge>
              </div>
              
              <div className="flex gap-2">
                {sessionStatus === "disconnected" && (
                  <Button 
                    onClick={() => setSessionStatus("connecting")}
                    className="apple-button-primary flex-1"
                    size="sm"
                  >
                    <Power className="h-4 w-4 mr-2" />
                    Conectar
                  </Button>
                )}
                
                {sessionStatus === "connected" && (
                  <Button 
                    onClick={() => setSessionStatus("disconnected")}
                    variant="outline"
                    className="apple-button-secondary flex-1"
                    size="sm"
                  >
                    <PowerOff className="h-4 w-4 mr-2" />
                    Desconectar
                  </Button>
                )}
              </div>
              
              {sessionStatus === "connecting" && (
                <div className="p-4 bg-gray-50 rounded-lg text-center">
                  <QrCode className="h-16 w-16 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-600">
                    Escaneie o código QR com seu WhatsApp
                  </p>
                  <Button 
                    onClick={() => setSessionStatus("connected")}
                    className="apple-button-primary mt-3"
                    size="sm"
                  >
                    Simular Conexão
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Contacts List */}
        {sessionStatus === "connected" && (
          <div className="flex-1 p-4">
            <h3 className="font-medium text-gray-900 mb-3">Contatos Recentes</h3>
            <div className="space-y-2">
              <div className="p-3 bg-white rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-blue-600">JD</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">João Silva</p>
                    <p className="text-sm text-gray-500">+55 11 99999-9999</p>
                  </div>
                </div>
              </div>
              
              <div className="p-3 bg-white rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-green-600">MS</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Maria Santos</p>
                    <p className="text-sm text-gray-500">+55 11 88888-8888</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {sessionStatus === "connected" ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b apple-divider bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-blue-600">JD</span>
                </div>
                <div>
                  <h2 className="font-medium text-gray-900">João Silva</h2>
                  <p className="text-sm text-gray-500">+55 11 99999-9999</p>
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 p-4 bg-gray-50 overflow-y-auto">
              <div className="space-y-4">
                <div className="flex justify-end">
                  <div className="bg-blue-500 text-white p-3 rounded-lg max-w-xs">
                    <p className="text-sm">Olá! Como posso ajudar você hoje?</p>
                    <p className="text-xs opacity-70 mt-1">14:30</p>
                  </div>
                </div>
                
                <div className="flex justify-start">
                  <div className="bg-white p-3 rounded-lg max-w-xs border">
                    <p className="text-sm text-gray-800">Oi! Gostaria de mais informações sobre os produtos.</p>
                    <p className="text-xs text-gray-500 mt-1">14:32</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Message Input */}
            <div className="p-4 border-t apple-divider bg-white">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Digite sua mensagem..."
                  className="flex-1 p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Button className="apple-button-primary">
                  <MessageCircle className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">WhatsApp não conectado</h3>
              <p className="text-gray-500 max-w-sm">
                {sessionStatus === "connecting" 
                  ? "Conectando à sua conta WhatsApp..." 
                  : "Conecte sua conta WhatsApp para começar a enviar mensagens."
                }
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}