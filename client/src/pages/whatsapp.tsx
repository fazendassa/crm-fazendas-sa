import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  MessageCircle, 
  Phone, 
  Paperclip, 
  Send, 
  Search, 
  MoreVertical,
  Settings,
  Power,
  PowerOff,
  Smartphone,
  QrCode,
  CheckCircle,
  XCircle,
  Clock,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface WhatsappSession {
  id: number;
  sessionName: string;
  status: "disconnected" | "connecting" | "connected" | "error";
  phoneNumber?: string;
  isActive: boolean;
  lastActivity?: string;
  createdAt: string;
  updatedAt: string;
}

interface WhatsappMessage {
  id: number;
  sessionId: number;
  messageId: string;
  fromNumber: string;
  toNumber: string;
  messageType: string;
  content?: string;
  mediaUrl?: string;
  timestamp: string;
  isIncoming: boolean;
  status: string;
  contact?: {
    id: number;
    name: string;
    email?: string;
  };
}

interface WhatsappContact {
  id: number;
  phoneNumber: string;
  name?: string;
  profilePic?: string;
  lastSeen?: string;
  contactId?: number;
  isBlocked: boolean;
  lastMessage?: string;
  unreadCount?: number;
}

const statusColors = {
  connected: "bg-green-500",
  connecting: "bg-yellow-500", 
  disconnected: "bg-gray-400",
  error: "bg-red-500"
};

const statusLabels = {
  connected: "Conectado",
  connecting: "Conectando",
  disconnected: "Desconectado", 
  error: "Erro"
};

export default function WhatsApp() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [selectedContact, setSelectedContact] = useState<WhatsappContact | null>(null);
  const [messageText, setMessageText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [newSessionName, setNewSessionName] = useState("");
  const [qrCode, setQrCode] = useState<string | null>(null);

  // Setup Socket.IO connection
  useEffect(() => {
    const socket = io();
    
    socket.on('qr-code', (data) => {
      console.log('QR Code received:', data);
      if (data.qrCode) {
        setQrCode(data.qrCode);
        toast({
          title: "QR Code atualizado",
          description: "Escaneie o código QR com seu WhatsApp",
        });
      }
    });

    socket.on('session-status', (data) => {
      console.log('Session status update:', data);
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/sessions"] });
      
      if (data.status === 'connected') {
        setQrCode(null);
        toast({
          title: "WhatsApp conectado!",
          description: "Sessão conectada com sucesso",
        });
      }
    });

    socket.on('new-message', (data) => {
      console.log('New message received:', data);
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/contacts"] });
    });

    return () => socket.disconnect();
  }, [toast, queryClient]);

  // Fetch WhatsApp sessions
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<WhatsappSession[]>({
    queryKey: ["/api/whatsapp/sessions"],
    refetchInterval: 5000,
  });

  // Get active session
  const activeSession = sessions.find(s => s.isActive && s.status === "connected");

  // Fetch WhatsApp contacts for active session
  const { data: contacts = [], isLoading: contactsLoading } = useQuery<WhatsappContact[]>({
    queryKey: ["/api/whatsapp/contacts", activeSession?.id],
    enabled: !!activeSession,
    refetchInterval: 10000,
  });

  // Fetch messages for selected contact
  const { data: messages = [], isLoading: messagesLoading } = useQuery<WhatsappMessage[]>({
    queryKey: ["/api/whatsapp/messages", selectedContact?.phoneNumber],
    enabled: !!selectedContact && !!activeSession,
    refetchInterval: 2000,
  });

  // Create session mutation
  const createSessionMutation = useMutation({
    mutationFn: async (sessionName: string) => {
      const response = await fetch("/api/whatsapp/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionName }),
      });
      if (!response.ok) throw new Error("Failed to create session");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sessão criada",
        description: "Nova sessão WhatsApp criada com sucesso",
      });
      setNewSessionName("");
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/sessions"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar sessão",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Connect session mutation
  const connectSessionMutation = useMutation({
    mutationFn: async (sessionId: number) => {
      const response = await fetch(`/api/whatsapp/sessions/${sessionId}/connect`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to connect session");
      }
      return response.json();
    },
    onSuccess: (data) => {
      console.log('Connect response:', data);
      if (data.qrCode) {
        setQrCode(data.qrCode);
        toast({
          title: "QR Code gerado",
          description: "Escaneie o código QR com seu WhatsApp",
        });
      } else {
        toast({
          title: "Conectando",
          description: "Iniciando conexão WhatsApp...",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/sessions"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao conectar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Disconnect session mutation
  const disconnectSessionMutation = useMutation({
    mutationFn: async (sessionId: number) => {
      const response = await fetch(`/api/whatsapp/sessions/${sessionId}/disconnect`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to disconnect session");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Desconectado",
        description: "Sessão WhatsApp desconectada",
      });
      setQrCode(null);
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/sessions"] });
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ phoneNumber, message }: { phoneNumber: string; message: string }) => {
      const response = await fetch("/api/whatsapp/send-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          sessionId: activeSession?.id,
          phoneNumber,
          message,
        }),
      });
      if (!response.ok) throw new Error("Failed to send message");
      return response.json();
    },
    onSuccess: () => {
      setMessageText("");
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/messages", selectedContact?.phoneNumber] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao enviar mensagem",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (!messageText.trim() || !selectedContact || !activeSession) return;
    
    sendMessageMutation.mutate({
      phoneNumber: selectedContact.phoneNumber,
      message: messageText.trim(),
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const filteredContacts = contacts.filter(contact =>
    contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.phoneNumber.includes(searchTerm)
  );

  // Auto scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const renderStatusIcon = (status: string) => {
    switch (status) {
      case "connected":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "connecting":
        return <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Left Sidebar - Contacts */}
      <div className="w-80 bg-gray-50 border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src="" />
                <AvatarFallback className="bg-green-500 text-white">
                  <MessageCircle className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="font-semibold text-gray-900">WhatsApp</h2>
                {activeSession && (
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    {renderStatusIcon(activeSession.status)}
                    <span>{statusLabels[activeSession.status]}</span>
                  </div>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSettingsOpen(true)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Search */}
          <div className="mt-3 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Pesquisar contatos"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Session Status */}
        {!activeSession && (
          <div className="p-4">
            <Alert>
              <AlertDescription>
                Nenhuma sessão WhatsApp conectada. Configure uma sessão nas configurações.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Contacts List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-2 text-sm font-medium text-gray-500 bg-gray-100">
            Todos os contatos
          </div>
          {contactsLoading ? (
            <div className="p-4 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              Nenhum contato encontrado
            </div>
          ) : (
            filteredContacts.map((contact) => (
              <div
                key={contact.id}
                onClick={() => setSelectedContact(contact)}
                className={`p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                  selectedContact?.id === contact.id ? "bg-blue-50 border-l-4 border-l-blue-500" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={contact.profilePic} />
                    <AvatarFallback className="bg-gray-300 text-gray-600">
                      {contact.name?.charAt(0).toUpperCase() || contact.phoneNumber.slice(-2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-gray-900 truncate">
                        {contact.name || contact.phoneNumber}
                      </p>
                      {contact.lastSeen && (
                        <span className="text-xs text-gray-500">
                          {formatTime(contact.lastSeen)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-500 truncate">
                        {contact.lastMessage || "Sem mensagens"}
                      </p>
                      {contact.unreadCount && contact.unreadCount > 0 && (
                        <Badge variant="default" className="bg-green-500 text-white text-xs px-2 py-1">
                          {contact.unreadCount}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedContact ? (
          <>
            {/* Chat Header */}
            <div className="p-4 bg-white border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedContact.profilePic} />
                    <AvatarFallback className="bg-gray-300 text-gray-600">
                      {selectedContact.name?.charAt(0).toUpperCase() || selectedContact.phoneNumber.slice(-2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {selectedContact.name || selectedContact.phoneNumber}
                    </h3>
                    {selectedContact.lastSeen && (
                      <p className="text-sm text-gray-500">
                        Visto por último {formatDistanceToNow(new Date(selectedContact.lastSeen), { 
                          locale: ptBR, addSuffix: true 
                        })}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-gray-500">
                  {/* Deal info if linked */}
                  <div className="text-right">
                    <Select defaultValue="base">
                      <SelectTrigger className="w-32 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="base">Base</SelectItem>
                        <SelectItem value="contato">Contato</SelectItem>
                        <SelectItem value="negocio">Negócio</SelectItem>
                        <SelectItem value="notas">Notas</SelectItem>
                        <SelectItem value="historico">Histórico</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {messagesLoading ? (
                <div className="text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-gray-500">
                  Nenhuma mensagem encontrada
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.isIncoming ? "justify-start" : "justify-end"}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        message.isIncoming
                          ? "bg-white border border-gray-200"
                          : "bg-green-500 text-white"
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                      <p
                        className={`text-xs mt-1 ${
                          message.isIncoming ? "text-gray-500" : "text-green-100"
                        }`}
                      >
                        {formatTime(message.timestamp)}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 bg-white border-t border-gray-200">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm">
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Input
                  placeholder="Digite uma mensagem"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="flex-1"
                  disabled={!activeSession || activeSession.status !== "connected"}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!messageText.trim() || sendMessageMutation.isPending || !activeSession}
                  className="bg-green-500 hover:bg-green-600"
                >
                  {sendMessageMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <MessageCircle className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Bem-vindo ao WhatsApp
              </h3>
              <p className="text-gray-500">
                Selecione um contato para começar a conversar
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configurações WhatsApp</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Sessions List */}
            <div>
              <h4 className="font-medium mb-3">Sessões</h4>
              <div className="space-y-2">
                {sessions.map((session) => (
                  <div key={session.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${statusColors[session.status]}`} />
                      <div>
                        <p className="font-medium">{session.sessionName}</p>
                        <p className="text-sm text-gray-500">{statusLabels[session.status]}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {session.status === "disconnected" ? (
                        <Button
                          size="sm"
                          onClick={() => connectSessionMutation.mutate(session.id)}
                          disabled={connectSessionMutation.isPending}
                        >
                          <Power className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => disconnectSessionMutation.mutate(session.id)}
                          disabled={disconnectSessionMutation.isPending}
                        >
                          <PowerOff className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Create New Session */}
            <div>
              <h4 className="font-medium mb-3">Nova Sessão</h4>
              <div className="flex gap-2">
                <Input
                  placeholder="Nome da sessão"
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                />
                <Button
                  onClick={() => createSessionMutation.mutate(newSessionName)}
                  disabled={!newSessionName.trim() || createSessionMutation.isPending}
                >
                  Criar
                </Button>
              </div>
            </div>

            {/* QR Code */}
            {qrCode && (
              <div className="text-center">
                <h4 className="font-medium mb-3">Escaneie o QR Code</h4>
                <div className="bg-white p-4 rounded-lg border inline-block">
                  <img src={qrCode} alt="QR Code" className="w-48 h-48" />
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Use o WhatsApp do seu celular para escanear
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}