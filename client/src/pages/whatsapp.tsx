import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { MessageCircle, Phone, Send, QrCode, Wifi, WifiOff, Loader2, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';

interface WhatsAppSession {
  id: number;
  userId: string;
  sessionName: string;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  phoneNumber: string | null;
  qrCode: string | null;
  isActive: boolean;
  lastActivity: string;
  createdAt: string;
  updatedAt: string;
}

interface WhatsAppMessage {
  id: number;
  sessionId: number;
  messageId: string;
  chatId: string;
  fromNumber: string;
  toNumber: string;
  content: string;
  messageType: string;
  direction: 'incoming' | 'outgoing';
  isRead: boolean;
  timestamp: string;
  createdAt: string;
}

export default function WhatsApp() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [sessions, setSessions] = useState<WhatsAppSession[]>([]);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [currentSession, setCurrentSession] = useState<WhatsAppSession | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [messageText, setMessageText] = useState('');
  const [recipientNumber, setRecipientNumber] = useState('');
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    loadSessions();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (user?.id) {
      connectWebSocket();
    }
  }, [user?.id]);

  const connectWebSocket = () => {
    if (!user?.id) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?userId=${user.id}`;

    const websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      console.log('📡 WebSocket connected');
      setWs(websocket);
      wsRef.current = websocket;
    };

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    websocket.onclose = () => {
      console.log('📡 WebSocket disconnected');
      setWs(null);
      wsRef.current = null;

      // Reconnect after 3 seconds
      setTimeout(() => {
        if (user?.id) {
          connectWebSocket();
        }
      }, 3000);
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  };

  const handleWebSocketMessage = (data: any) => {
    console.log('📱 WebSocket message received:', data);
    
    switch (data.type) {
      case 'wa:qr':
        console.log('📱 QR Code received via WebSocket:', data.qrCode ? 'Present' : 'Missing');
        setQrCode(data.qrCode);
        setConnectionError(null);
        
        // Also update the session with QR code
        setSessions(prev => prev.map(session => 
          session.id === data.sessionId 
            ? { ...session, qrCode: data.qrCode, status: 'connecting' }
            : session
        ));
        break;

      case 'wa:status':
        console.log('📱 Status update received:', data.status, 'for session:', data.sessionId);
        
        setSessions(prev => prev.map(session => 
          session.id === data.sessionId 
            ? { 
                ...session, 
                status: data.status, 
                phoneNumber: data.phoneNumber,
                lastActivity: new Date().toISOString()
              }
            : session
        ));

        if (data.status === 'connected') {
          setQrCode(null);
          toast({
            title: "WhatsApp Conectado",
            description: "Sua sessão do WhatsApp foi conectada com sucesso!",
          });
        } else if (data.status === 'error') {
          setQrCode(null);
          toast({
            title: "Erro na Conexão",
            description: "Houve um erro na conexão do WhatsApp. Tente novamente.",
            variant: "destructive"
          });
        }
        break;

      case 'wa:message':
        setMessages(prev => [data.message, ...prev]);
        break;

      case 'wa:error':
        setQrCode(null);
        toast({
          title: "Erro no WhatsApp",
          description: data.message,
          variant: "destructive"
        });
        break;

      default:
        console.log('Unknown WebSocket message:', data);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setIsLoading(true);
      const response = await apiRequest('/api/whatsapp/sessions');
      console.log('sessionsData:', response);

      // Ensure response is always treated as an array
      const sessionsArray = Array.isArray(response) ? response : (response?.sessions || []);
      setSessions(sessionsArray);
      console.log('sessions:', sessionsArray);
    } catch (error) {
      console.error('Error loading sessions:', error);
      setSessions([]);
      toast({
        title: "Erro",
        description: "Falha ao carregar sessões do WhatsApp",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async (sessionId: number) => {
    try {
      const response = await apiRequest(`/api/whatsapp/messages?sessionId=${sessionId}`);
      setMessages(response.messages || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const createSession = async () => {
    const trimmedSessionName = sessionName?.trim();
    
    if (!trimmedSessionName) {
      toast({
        title: "Erro",
        description: "Nome da sessão é obrigatório",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsLoading(true);
      setConnectionError(null);
      setQrCode(null);
      
      const response = await apiRequest('/api/whatsapp/create-session', 'POST', { sessionName: trimmedSessionName });

      console.log('Create session response:', response);

      if (response?.success !== false) {
        toast({
          title: "Sucesso",
          description: response?.message || "Sessão criada com sucesso. Aguarde o QR Code...",
        });

        setSessionName('');
        
        // Reload sessions immediately
        loadSessions();
        
        // Set a timeout to reload sessions again after QR generation
        setTimeout(() => {
          loadSessions();
        }, 3000);
      } else {
        throw new Error(response?.message || "Falha ao criar sessão");
      }
    } catch (error) {
      console.error('Error creating session:', error);
      const errorMessage = error instanceof Error ? error.message : "Falha ao criar sessão do WhatsApp";
      setConnectionError(errorMessage);
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteSession = async (sessionId: number) => {
    try {
      await apiRequest('/api/whatsapp/session', 'DELETE');
      toast({
        title: "Sucesso",
        description: "Sessão excluída com sucesso",
      });
      loadSessions();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Falha ao excluir sessão",
        variant: "destructive"
      });
    }
  };

  const sendMessage = async () => {
    if (!messageText.trim() || !recipientNumber.trim()) {
      toast({
        title: "Erro",
        description: "Número e mensagem são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    try {
      await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          to: recipientNumber,
          text: messageText
        })
      });

      setMessageText('');
      toast({
        title: "Mensagem Enviada",
        description: "Sua mensagem foi enviada com sucesso!",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Falha ao enviar mensagem",
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const safeStatus = status ? status.toString().toLowerCase() : 'unknown';
    
    switch (safeStatus) {
      case 'connected':
        return <Badge className="bg-green-500"><Wifi className="w-3 h-3 mr-1" />Conectado</Badge>;
      case 'connecting':
        return <Badge className="bg-yellow-500"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Conectando</Badge>;
      case 'disconnected':
        return <Badge variant="secondary"><WifiOff className="w-3 h-3 mr-1" />Desconectado</Badge>;
      case 'error':
        return <Badge variant="destructive"><WifiOff className="w-3 h-3 mr-1" />Erro</Badge>;
      default:
        return <Badge variant="outline">{safeStatus}</Badge>;
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPhoneNumber = (phone: string) => {
    // Add safety check for phone parameter
    if (!phone || typeof phone !== 'string') {
      return '';
    }
    // Remove WhatsApp suffix if present
    const cleanPhone = phone.replace('@c.us', '');
    return cleanPhone;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">WhatsApp Integration</h1>
          <p className="text-gray-600">Gerencie suas conversas do WhatsApp diretamente no CRM</p>
        </div>
        <MessageCircle className="w-8 h-8 text-green-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Session Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5" />
              Sessões WhatsApp
            </CardTitle>
            <CardDescription>
              Gerencie suas conexões do WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Create New Session */}
            <div className="space-y-2">
              <Input
                placeholder="Nome da sessão"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createSession()}
              />
              <Button 
                onClick={createSession} 
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  'Criar Sessão'
                )}
              </Button>
            </div>

            <Separator />

            {/* Connection Error */}
            {connectionError && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-800 text-sm">
                {connectionError}
              </div>
            )}

            {/* Sessions List */}
            <div className="space-y-2">
              {Array.isArray(sessions) && sessions.length > 0 ? (
                sessions.map((session) => (
                  <Card 
                    key={session.id} 
                    className={`transition-colors ${
                      currentSession?.id === session.id ? 'ring-2 ring-blue-500' : ''
                    }`}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div onClick={() => {
                          setCurrentSession(session);
                          loadMessages(session.id);
                        }} className="flex-1 cursor-pointer">
                          <p className="font-medium">{session.sessionName}</p>
                          {session.phoneNumber && (
                            <p className="text-sm text-gray-600">
                              {formatPhoneNumber(session.phoneNumber)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(session.status)}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSession(session.id);
                            }}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            Excluir
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <p className="text-gray-500 text-sm">Nenhuma sessão encontrada</p>
              )}
            </div>

            {/* QR Code Display */}
            {(qrCode || sessions.some(s => s.qrCode)) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <QrCode className="w-5 h-5" />
                    QR Code
                  </CardTitle>
                  <CardDescription>
                    Escaneie com seu WhatsApp
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-center">
                    <img 
                      src={qrCode || sessions.find(s => s.qrCode)?.qrCode} 
                      alt="WhatsApp QR Code" 
                      className="w-full max-w-[250px] h-auto border rounded-lg"
                      onError={(e) => {
                        console.error('Error loading QR code image');
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 text-center mt-2">
                    Abra o WhatsApp no seu celular e escaneie este código
                  </p>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>

        {/* Message Management */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              Mensagens
            </CardTitle>
            <CardDescription>
              {currentSession 
                ? `Sessão: ${currentSession.sessionName}` 
                : 'Selecione uma sessão para ver as mensagens'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {currentSession?.status === 'connected' ? (
              <div className="space-y-4">
                {/* Send Message */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <Input
                    placeholder="Número (ex: 5511999999999)"
                    value={recipientNumber}
                    onChange={(e) => setRecipientNumber(e.target.value)}
                    className="md:col-span-1"
                  />
                  <Input
                    placeholder="Digite sua mensagem..."
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    className="md:col-span-2"
                  />
                  <Button onClick={sendMessage} className="md:col-span-1">
                    <Send className="w-4 h-4 mr-2" />
                    Enviar
                  </Button>
                </div>

                <Separator />

                {/* Messages List */}
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {messages.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Nenhuma mensagem ainda</p>
                        <p className="text-sm">Envie uma mensagem para começar</p>
                      </div>
                    ) : (
                      messages.map((message) => (
                        <Card key={message.id} className={`${
                          message.direction === 'outgoing' 
                            ? 'bg-blue-50 ml-8' 
                            : 'bg-gray-50 mr-8'
                        }`}>
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant={message.direction === 'outgoing' ? 'default' : 'secondary'}>
                                    {message.direction === 'outgoing' ? 'Enviada' : 'Recebida'}
                                  </Badge>
                                  <span className="text-sm text-gray-600">
                                    {formatPhoneNumber(
                                      message.direction === 'outgoing' 
                                        ? message.toNumber 
                                        : message.fromNumber
                                    )}
                                  </span>
                                </div>
                                <p className="text-sm">{message.content}</p>
                              </div>
                              <span className="text-xs text-gray-500 ml-2">
                                {formatTime(message.timestamp)}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>WhatsApp não conectado</p>
                <p className="text-sm">
                  {currentSession 
                    ? 'Aguarde a conexão ser estabelecida' 
                    : 'Selecione ou crie uma sessão para começar'
                  }
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}