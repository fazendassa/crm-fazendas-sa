import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Paperclip, 
  Image, 
  Smile, 
  Video, 
  Mic, 
  Phone, 
  MoreVertical,
  X,
  Check,
  MessageSquare,
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Message {
  id: string;
  content: string;
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read' | 'pending';
  isFromMe: boolean;
  type: 'text' | 'image' | 'file' | 'audio' | 'video' | 'system';
  mediaUrl?: string;
  fileName?: string;
}

interface Contact {
  id: string;
  name: string;
  phone: string;
  avatar?: string;
  isOnline: boolean;
  lastSeen?: Date;
}

interface ChatWindowProps {
  contact: Contact | null;
  messages: Message[];
  onSendMessage: (content: string, type: 'text' | 'image' | 'file' | 'audio' | 'video') => void;
  onStartNewChat: () => void;
  onCloseChat: () => void;
  isTyping: boolean;
  deviceInfo?: string;
}

export function ChatWindow({ 
  contact, 
  messages, 
  onSendMessage, 
  onStartNewChat, 
  onCloseChat, 
  isTyping,
  deviceInfo 
}: ChatWindowProps) {
  const [messageContent, setMessageContent] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = () => {
    if (messageContent.trim()) {
      onSendMessage(messageContent.trim(), 'text');
      setMessageContent('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Hoje';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Ontem';
    } else {
      return date.toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return <Check className="w-3 h-3 text-gray-500" />;
      case 'read':
        return <div className="flex"><Check className="w-3 h-3 text-blue-500" /><Check className="w-3 h-3 text-blue-500 -ml-1" /></div>;
      case 'pending':
        return <div className="w-3 h-3 border border-gray-400 rounded-full animate-pulse" />;
      default:
        return <div className="w-3 h-3 bg-red-500 rounded-full" />;
    }
  };

  const getInitials = (name: string | undefined) => {
    if (!name || typeof name !== 'string') return 'U';
    const cleanName = name.trim();
    if (!cleanName) return 'U';
    return cleanName.split(' ').map(n => n && n[0] ? n[0].toUpperCase() : '').filter(Boolean).join('').slice(0, 2) || 'U';
  };

  const groupMessagesByDate = (messages: Message[]) => {
    const grouped: { [key: string]: Message[] } = {};

    messages.forEach(message => {
      const dateKey = message.timestamp.toDateString();
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(message);
    });

    return grouped;
  };

  const groupedMessages = groupMessagesByDate(messages);

  if (!contact) {
    return (
      <div className="h-full bg-gray-50 flex flex-col items-center justify-center">
        <MessageSquare className="w-16 h-16 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-600 mb-2">Nenhuma conversa selecionada</h3>
        <p className="text-gray-500 text-center mb-4">
          Selecione uma conversa da lista para começar a conversar
        </p>
        <Button onClick={onStartNewChat} variant="outline">
          Iniciar Nova Conversa
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full bg-white flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={contact.avatar} />
              <AvatarFallback className="bg-gray-100 text-gray-600 text-sm">
                {getInitials(contact.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-medium text-gray-900">{contact.name}</h3>
              <p className="text-sm text-gray-500">
                {deviceInfo || 'WhatsApp Web'} • {contact.phone}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onStartNewChat}>
              <MessageSquare className="w-4 h-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Settings className="w-4 h-4 mr-2" />
                  Configurações
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Phone className="w-4 h-4 mr-2" />
                  Ligar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="sm" onClick={onCloseChat}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {Object.entries(groupedMessages).map(([dateKey, dayMessages]) => (
            <div key={dateKey}>
              {/* Date Separator */}
              <div className="flex items-center justify-center py-2">
                <div className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full">
                  {formatDate(new Date(dateKey))}
                </div>
              </div>

              {/* Messages for this date */}
              {dayMessages.map((message) => (
                <div key={message.id} className="mb-3">
                  {message.type === 'system' ? (
                    <div className="flex justify-center">
                      <div className="bg-yellow-100 text-yellow-800 text-xs px-3 py-1 rounded-lg max-w-xs text-center">
                        {message.content}
                      </div>
                    </div>
                  ) : (
                    <div className={`flex ${message.isFromMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        message.isFromMe 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-gray-100 text-gray-900'
                      }`}>
                        <p className="text-sm">{message.content}</p>
                        <div className={`flex items-center gap-1 mt-1 ${
                          message.isFromMe ? 'justify-end' : 'justify-start'
                        }`}>
                          <span className={`text-xs ${
                            message.isFromMe ? 'text-blue-100' : 'text-gray-500'
                          }`}>
                            {formatTime(message.timestamp)}
                          </span>
                          {message.isFromMe && (
                            <div className="ml-1">
                              {getStatusIcon(message.status)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-900 px-4 py-2 rounded-lg">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Message Input */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-end gap-2">
          {/* Attachment Options */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm">
              <Paperclip className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <Image className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <Video className="w-4 h-4" />
            </Button>
          </div>

          {/* Message Input */}
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              placeholder="Responda aqui"
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              onKeyPress={handleKeyPress}
              className="min-h-[40px] max-h-[120px] resize-none pr-20"
              rows={1}
            />
            <div className="absolute right-2 top-2 flex items-center gap-1">
              <Button variant="ghost" size="sm">
                <Smile className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onMouseDown={() => setIsRecording(true)}
                onMouseUp={() => setIsRecording(false)}
                onMouseLeave={() => setIsRecording(false)}
                className={isRecording ? 'bg-red-100' : ''}
              >
                <Mic className={`w-4 h-4 ${isRecording ? 'text-red-500' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Send Button */}
          <Button 
            onClick={handleSendMessage}
            disabled={!messageContent.trim()}
            className="shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}