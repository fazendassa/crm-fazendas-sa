import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Send, Phone, Video, MoreVertical, Paperclip, Smile, Mic, Image, FileText, Users, Settings, X, Plus, Forward, Share, Download, Play, Pause } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface Contact {
  id: string;
  name: string;
  phone: string;
  isOnline: boolean;
  lastSeen?: Date;
}

interface Message {
  id: string;
  content: string;
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read' | 'pending';
  isFromMe: boolean;
  type: 'text' | 'image' | 'audio' | 'video' | 'file' | 'sticker' | 'contact';
  mediaUrl?: string;
}

interface ChatWindowProps {
  contact: Contact | null;
  messages: Message[];
  onSendMessage: (content: string, type: string) => void;
  onStartNewChat: () => void;
  onCloseChat: () => void;
  isTyping: boolean;
  deviceInfo: string;
  sessionId?: number;
}

export function ChatWindow({
  contact,
  messages,
  onSendMessage,
  onStartNewChat,
  onCloseChat,
  isTyping,
  deviceInfo,
  sessionId
}: ChatWindowProps) {
  const [newMessage, setNewMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showMessageMenu, setShowMessageMenu] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState<string>('');
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !contact) return;

    onSendMessage(newMessage.trim(), 'text');
    setNewMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatMessageTime = (timestamp: Date) => {
    return format(timestamp, 'HH:mm', { locale: ptBR });
  };

  const formatMessageDate = (timestamp: Date) => {
    if (isToday(timestamp)) {
      return 'Hoje';
    } else if (isYesterday(timestamp)) {
      return 'Ontem';
    } else {
      return format(timestamp, 'dd/MM/yyyy', { locale: ptBR });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return '✓';
      case 'delivered':
        return '✓✓';
      case 'read':
        return '✓✓';
      default:
        return '⏳';
    }
  };

  const handleFileSelect = (type: string) => {
    setUploadType(type);
    setShowAttachMenu(false);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !contact || !sessionId) return;

    setSelectedFile(file);

    try {
      // Convert file to base64 for sending
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;

        await apiRequest(`/api/whatsapp/sessions/${sessionId}/send-media`, 'POST', {
          contactPhone: contact.phone,
          media: base64Data,
          mediaType: uploadType,
          fileName: file.name,
          caption: ''
        });

        toast({
          title: "Mídia enviada",
          description: "Arquivo enviado com sucesso!"
        });
      };

      reader.readAsDataURL(file);
    } catch (error) {
      toast({
        title: "Erro ao enviar mídia",
        description: "Não foi possível enviar o arquivo",
        variant: "destructive"
      });
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleForwardMessage = async (messageId: string) => {
    if (!sessionId) return;

    try {
      // This would open a contact selector dialog
      // For now, we'll just show a toast
      toast({
        title: "Encaminhar mensagem",
        description: "Funcionalidade será implementada em breve"
      });
    } catch (error) {
      toast({
        title: "Erro ao encaminhar",
        description: "Não foi possível encaminhar a mensagem",
        variant: "destructive"
      });
    }
  };

  const handleSendSticker = async () => {
    if (!contact || !sessionId) return;

    try {
      // This would open a sticker picker
      toast({
        title: "Stickers",
        description: "Seletor de stickers será implementado em breve"
      });
    } catch (error) {
      toast({
        title: "Erro ao enviar sticker",
        description: "Não foi possível enviar o sticker",
        variant: "destructive"
      });
    }
  };

  const startRecording = () => {
    setIsRecording(true);
    // Implement audio recording
    toast({
      title: "Gravação de áudio",
      description: "Funcionalidade será implementada em breve"
    });
  };

  const stopRecording = () => {
    setIsRecording(false);
  };

  if (!contact) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 p-8">
        <div className="text-center max-w-md">
          <div className="w-32 h-32 mx-auto mb-6 bg-gray-200 rounded-full flex items-center justify-center">
            <Users className="w-16 h-16 text-gray-400" />
          </div>
          <h3 className="text-xl font-medium text-gray-900 mb-2">Nenhuma conversa selecionada</h3>
          <p className="text-gray-600 mb-6">
            Selecione uma conversa da lista para começar a conversar
          </p>
          <Button onClick={onStartNewChat} className="bg-green-600 hover:bg-green-700">
            <Plus className="w-4 h-4 mr-2" />
            Iniciar Nova Conversa
          </Button>
        </div>
      </div>
    );
  }

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = formatMessageDate(message.timestamp);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {} as Record<string, Message[]>);

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage 
                src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(contact.name)}&backgroundColor=random`} 
                alt={contact.name}
              />
              <AvatarFallback>
                {contact?.name ? contact.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-medium text-gray-900">{contact.name}</h3>
              <p className="text-sm text-gray-500">
                {contact.isOnline ? (
                  <span className="text-green-600">Online</span>
                ) : contact.lastSeen ? (
                  `Visto por último ${format(contact.lastSeen, 'HH:mm', { locale: ptBR })}`
                ) : (
                  contact.phone
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm">
              <Phone className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <Video className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <MoreVertical className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onCloseChat}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {Object.entries(groupedMessages).map(([date, dateMessages]) => (
            <div key={date}>
              {/* Date separator */}
              <div className="flex items-center justify-center my-4">
                <div className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">
                  {date}
                </div>
              </div>

              {/* Messages for this date */}
              {dateMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.isFromMe ? 'justify-end' : 'justify-start'} mb-2 group`}
                >
                  <div className="relative">
                    <div
                      className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg ${
                        message.isFromMe
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-200 text-gray-900'
                      }`}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setShowMessageMenu(showMessageMenu === message.id ? null : message.id);
                      }}
                    >
                      {message.type === 'text' && (
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      )}

                      {message.type === 'image' && (
                        <div>
                          <img 
                            src={message.mediaUrl} 
                            alt="Imagem" 
                            className="rounded-lg max-w-full h-auto mb-1 cursor-pointer"
                            onClick={() => window.open(message.mediaUrl, '_blank')}
                          />
                          {message.content && (
                            <p className="text-sm">{message.content}</p>
                          )}
                        </div>
                      )}

                      {message.type === 'audio' && (
                        <div className="flex items-center gap-2 min-w-[150px]">
                          <Button variant="ghost" size="sm" className="p-1">
                            <Play className="w-4 h-4" />
                          </Button>
                          <div className="flex-1 h-1 bg-gray-300 rounded">
                            <div className="w-1/3 h-full bg-current rounded"></div>
                          </div>
                          <span className="text-xs">0:15</span>
                        </div>
                      )}

                      {message.type === 'video' && (
                        <div className="relative">
                          <video 
                            src={message.mediaUrl}
                            className="rounded-lg max-w-full h-auto"
                            controls
                          />
                          {message.content && (
                            <p className="text-sm mt-1">{message.content}</p>
                          )}
                        </div>
                      )}

                      {message.type === 'file' && (
                        <div className="flex items-center gap-2 p-2 bg-white bg-opacity-20 rounded">
                          <FileText className="w-8 h-8" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{message.content}</p>
                            <p className="text-xs opacity-75">Documento</p>
                          </div>
                          <Button variant="ghost" size="sm" className="p-1">
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      )}

                      {message.type === 'sticker' && (
                        <div>
                          <img 
                            src={message.mediaUrl} 
                            alt="Sticker" 
                            className="w-32 h-32 object-contain"
                          />
                        </div>
                      )}

                      {message.type === 'contact' && (
                        <div className="flex items-center gap-2 p-2 bg-white bg-opacity-20 rounded">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {message.content.split(' ').map(n => n[0]).join('').toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{message.content}</p>
                            <p className="text-xs opacity-75">Contato</p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-1 mt-1">
                        <span className="text-xs opacity-75">
                          {formatMessageTime(message.timestamp)}
                        </span>
                        {message.isFromMe && (
                          <span className={`text-xs ${
                            message.status === 'read' ? 'text-blue-200' : 'opacity-75'
                          }`}>
                            {getStatusIcon(message.status)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Message context menu */}
                    {showMessageMenu === message.id && (
                      <div className="absolute top-0 right-full mr-2 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start px-3 py-2"
                          onClick={() => handleForwardMessage(message.id)}
                        >
                          <Forward className="w-4 h-4 mr-2" />
                          Encaminhar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start px-3 py-2"
                          onClick={() => {
                            navigator.clipboard.writeText(message.content);
                            setShowMessageMenu(null);
                            toast({ title: "Copiado!", description: "Mensagem copiada para a área de transferência" });
                          }}
                        >
                          <Share className="w-4 h-4 mr-2" />
                          Copiar
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start mb-2">
              <div className="bg-gray-200 text-gray-900 px-3 py-2 rounded-lg">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="flex items-end gap-2">
          {/* Attach button */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAttachMenu(!showAttachMenu)}
            >
              <Paperclip className="w-4 h-4" />
            </Button>

            {showAttachMenu && (
              <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg p-2 min-w-[200px]">
                <div className="space-y-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => handleFileSelect('image')}
                  >
                    <Image className="w-4 h-4 mr-2" />
                    Imagem
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => handleFileSelect('document')}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Documento
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => handleFileSelect('video')}
                  >
                    <Video className="w-4 h-4 mr-2" />
                    Vídeo
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={handleSendSticker}
                  >
                    <Smile className="w-4 h-4 mr-2" />
                    Sticker
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Message input */}
          <div className="flex-1">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Digite uma mensagem..."
              className="resize-none"
            />
          </div>

          {/* Emoji button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          >
            <Smile className="w-4 h-4" />
          </Button>

          {/* Voice/Send button */}
          {newMessage.trim() ? (
            <Button
              onClick={handleSendMessage}
              className="bg-green-600 hover:bg-green-700"
            >
              <Send className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              className={`${isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
            >
              <Mic className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Device info */}
        <div className="mt-2 text-xs text-gray-500 text-center">
          {deviceInfo && typeof deviceInfo === 'string' ? (
            deviceInfo.split(' – ').map((part, index) => (
              <span key={index}>
                {index > 0 && ' – '}
                {part}
              </span>
            ))
          ) : (
            <span>WhatsApp Web</span>
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={uploadType === 'image' ? 'image/*' : uploadType === 'video' ? 'video/*' : uploadType === 'audio' ? 'audio/*' : '*/*'}
        onChange={handleFileChange}
      />

      {/* Click outside to close menus */}
      {(showAttachMenu || showMessageMenu) && (
        <div 
          className="fixed inset-0 z-0" 
          onClick={() => {
            setShowAttachMenu(false);
            setShowMessageMenu(null);
          }}
        />
      )}
    </div>
  );
}