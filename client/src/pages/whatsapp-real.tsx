import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { 
  MessageCircle, 
  Power,
  PowerOff,
  Smartphone,
  QrCode,
  Send,
  Plus
} from "lucide-react";
import { io, Socket } from "socket.io-client";
import { apiRequest } from "@/lib/queryClient";

interface WhatsappSession {
  id: number;
  sessionName: string;
  status: string;
  phoneNumber?: string;
  isActive: boolean;
  createdAt: string;
}

interface WhatsappMessage {
  id: number;
  fromNumber: string;
  toNumber: string;
  content: string;
  timestamp: string;
  isIncoming: boolean;
}

export default function WhatsApp() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [selectedSession, setSelectedSession] = useState<WhatsappSession | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<string>("disconnected");
  const [newSessionName, setNewSessionName] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [selectedContact, setSelectedContact] = useState<string | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Initialize Socket.IO connection
  useEffect(() => {
    const socketInstance = io();
    setSocket(socketInstance);

    socketInstance.on('qr-code', (data: { sessionName: string; qrCode: string }) => {
      console.log('QR Code received:', data);
      setQrCode(data.qrCode);
      toast({
        title: "QR Code gerado",
        description: "Escaneie o código QR com seu WhatsApp"
      });
    });

    socketInstance.on('session-status', (data: { sessionName: string; status: string }) => {
      console.log('Session status:', data);
      setSessionStatus(data.status);

      if (data.status === 'isLogged') {
        setQrCode(null);
        toast({
          title: "WhatsApp conectado!",
          description: "Sua sessão foi autenticada com sucesso"
        });
        queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/sessions'] });
      }
    });

    return () => {
      socketInstance.disconnect();
    };
  }, [toast, queryClient]);

  // Fetch WhatsApp sessions
  const { data: sessionsData = [], error: sessionsError, isLoading: sessionsLoading } = useQuery({
    queryKey: ['/api/whatsapp/sessions'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/whatsapp/sessions', { credentials: 'include' });
        if (!response.ok) {
          throw new Error('Failed to fetch sessions');
        }
        const data = await response.json();
        console.log('Raw sessions data:', data);
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error('Error fetching sessions:', error);
        return [];
      }
    },
    retry: 3,
    retryDelay: 1000
  });

  // Ensure sessions is always an array
  const sessions = Array.isArray(sessionsData) ? sessionsData : [];

  // Debug logging
  console.log('sessionsData:', sessionsData);
  console.log('sessions:', sessions);

  // Fetch messages for selected session
  const { data: messages = [] } = useQuery({
    queryKey: ['/api/whatsapp/messages', selectedSession?.id, selectedContact],
    queryFn: () => {
      if (!selectedSession || !selectedContact) return [];
      return fetch(`/api/whatsapp/messages?sessionId=${selectedSession.id}&phoneNumber=${selectedContact}`, { 
        credentials: 'include' 
      }).then(res => res.json()) as Promise<WhatsappMessage[]>;
    },
    enabled: !!selectedSession && !!selectedContact
  });

  // Create new session mutation
  const createSessionMutation = useMutation({
    mutationFn: async (sessionName: string) => {
      const response = await fetch('/api/whatsapp/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sessionName })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create session');
      }
      return response.json();
    },
    onSuccess: (data) => {
      console.log('Session created successfully:', data);
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/sessions'] });
      setNewSessionName("");
      
      if (data.qrCode) {
        setQrCode(data.qrCode);
        toast({
          title: "Sessão criada",
          description: "Escaneie o QR Code para conectar"
        });
      } else {
        toast({
          title: "Sessão criada",
          description: "Nova sessão WhatsApp criada com sucesso"
        });
      }
    },
    onError: (error: any) => {
      console.error('Error creating session:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao criar sessão",
        variant: "destructive"
      });
    }
  });

  // Connect session mutation
  const connectSessionMutation = useMutation({
    mutationFn: async (sessionId: number) => {
      const response = await fetch(`/api/whatsapp/sessions/${sessionId}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to connect session');
      return response.json();
    },
    onSuccess: (data) => {
      if (data.qrCode) {
        setQrCode(data.qrCode);
      }
      setSessionStatus("connecting");
      toast({
        title: "Conectando...",
        description: "Iniciando conexão WhatsApp"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao conectar sessão",
        variant: "destructive"
      });
    }
  });

  // Disconnect session mutation
  const disconnectSessionMutation = useMutation({
    mutationFn: async (sessionId: number) => {
      const response = await fetch(`/api/whatsapp/sessions/${sessionId}/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to disconnect session');
      return response.json();
    },
    onSuccess: () => {
      setQrCode(null);
      setSessionStatus("disconnected");
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/sessions'] });
      toast({
        title: "Desconectado",
        description: "Sessão WhatsApp desconectada"
      });
    }
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ sessionId, phoneNumber, message }: { sessionId: number; phoneNumber: string; message: string }) => {
      const response = await fetch('/api/whatsapp/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sessionId, phoneNumber, message })
      });
      if (!response.ok) throw new Error('Failed to send message');
      return response.json();
    },
    onSuccess: () => {
      setMessageInput("");
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/messages', selectedSession?.id, selectedContact] });
      toast({
        title: "Mensagem enviada",
        description: "Sua mensagem foi enviada com sucesso"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao enviar mensagem",
        variant: "destructive"
      });
    }
  });

  const handleCreateSession = () => {
    if (newSessionName.trim()) {
      createSessionMutation.mutate(newSessionName.trim());
    }
  };

  const handleConnectSession = (session: WhatsappSession) => {
    setSelectedSession(session);
    connectSessionMutation.mutate(session.id);
  };

  const handleDisconnectSession = (session: WhatsappSession) => {
    disconnectSessionMutation.mutate(session.id);
  };

  const handleSendMessage = () => {
    if (selectedSession && selectedContact && messageInput.trim()) {
      sendMessageMutation.mutate({
        sessionId: selectedSession.id,
        phoneNumber: selectedContact,
        message: messageInput.trim()
      });
    }
  };

  return (
    <div className="flex h-[calc(100vh-5rem)]">
      {/* Sidebar */}
      <div className="w-80 apple-card border-r apple-divider">
        <div className="p-6 border-b apple-divider">
          <h1 className="text-2xl font-semibold text-gray-900">WhatsApp</h1>
        </div>

        {/* Create New Session */}
        <div className="p-4 border-b apple-divider">
          <div className="flex gap-2">
            <Input
              placeholder="Nome da sessão"
              value={newSessionName}
              onChange={(e) => setNewSessionName(e.target.value)}
              className="flex-1"
            />
            <Button 
              onClick={handleCreateSession}
              disabled={createSessionMutation.isPending || !newSessionName.trim()}
              className="apple-button-primary"
              size="sm"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 p-4 overflow-y-auto">
          <h3 className="font-medium text-gray-900 mb-3">Sessões WhatsApp</h3>
          <div className="space-y-2">
            {sessionsError && (
              <div className="text-sm text-red-600 mb-2">
                Erro ao carregar sessões: {sessionsError.message}
              </div>
            )}
            {sessionsLoading ? (
              <div className="text-sm text-gray-500">Carregando sessões...</div>
            ) : sessions.length > 0 ? (
              sessions.map((session) => (
                <Card key={session.id} className="apple-card-nested">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">{session.sessionName}</CardTitle>
                      <Badge variant={session.status === 'connected' ? "default" : "secondary"}>
                        {session.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {session.phoneNumber && (
                      <p className="text-xs text-gray-500 mb-2">{session.phoneNumber}</p>
                    )}
                    <div className="flex gap-1">
                      {session.status === 'disconnected' ? (
                        <Button 
                          onClick={() => handleConnectSession(session)}
                          disabled={connectSessionMutation.isPending}
                          className="apple-button-primary"
                          size="sm"
                        >
                          <Power className="h-3 w-3 mr-1" />
                          Conectar
                        </Button>
                      ) : (
                        <Button 
                          onClick={() => handleDisconnectSession(session)}
                          disabled={disconnectSessionMutation.isPending}
                          variant="outline"
                          className="apple-button-secondary"
                          size="sm"
                        >
                          <PowerOff className="h-3 w-3 mr-1" />
                          Desconectar
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-sm text-gray-500 text-center py-4">
                Nenhuma sessão encontrada
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {qrCode ? (
          /* QR Code Display */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="p-4 bg-white rounded-lg border border-gray-200 mb-4">
                <img 
                  src={`data:image/png;base64,${qrCode}`} 
                  alt="QR Code WhatsApp" 
                  className="w-64 h-64 mx-auto"
                />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Escaneie o QR Code</h3>
              <p className="text-gray-500 max-w-sm">
                Abra o WhatsApp no seu celular, vá em Dispositivos Conectados e escaneie este código QR.
              </p>
            </div>
          </div>
        ) : selectedSession && selectedSession.status === 'connected' ? (
          <>
            {/* Chat Interface */}
            <div className="p-4 border-b apple-divider bg-white">
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-gray-400" />
                <div>
                  <h2 className="font-medium text-gray-900">{selectedSession.sessionName}</h2>
                  <p className="text-sm text-gray-500">
                    {selectedContact || "Selecione um contato"}
                  </p>
                </div>
              </div>
            </div>

            {/* Contact Selection */}
            <div className="p-4 border-b apple-divider bg-gray-50">
              <Input
                placeholder="Digite o número do contato (ex: 5511999999999)"
                value={selectedContact || ""}
                onChange={(e) => setSelectedContact(e.target.value)}
                className="mb-2"
              />
            </div>

            {/* Messages Area */}
            <div className="flex-1 p-4 bg-gray-50 overflow-y-auto">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div 
                    key={message.id}
                    className={`flex ${message.isIncoming ? 'justify-start' : 'justify-end'}`}
                  >
                    <div 
                      className={`p-3 rounded-lg max-w-xs ${
                        message.isIncoming 
                          ? 'bg-white border' 
                          : 'bg-blue-500 text-white'
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                      <p className={`text-xs mt-1 ${
                        message.isIncoming ? 'text-gray-500' : 'opacity-70'
                      }`}>
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Message Input */}
            {selectedContact && (
              <div className="p-4 border-t apple-divider bg-white">
                <div className="flex gap-2">
                  <Input
                    placeholder="Digite sua mensagem..."
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    className="flex-1"
                  />
                  <Button 
                    onClick={handleSendMessage}
                    disabled={sendMessageMutation.isPending || !messageInput.trim()}
                    className="apple-button-primary"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Not Connected State */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">WhatsApp não conectado</h3>
              <p className="text-gray-500 max-w-sm">
                {sessionStatus === "connecting" 
                  ? "Conectando à sua conta WhatsApp..." 
                  : "Crie ou conecte uma sessão WhatsApp para começar a enviar mensagens."
                }
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}