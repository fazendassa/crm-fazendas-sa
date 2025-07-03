import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { MessageSquare, Plus, Loader2 } from 'lucide-react';

export default function WhatsAppSimple() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [sessionName, setSessionName] = useState('');

  const handleCreateSession = async () => {
    if (!sessionName.trim()) {
      toast({
        title: "Erro",
        description: "Digite um nome para a sessão",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/whatsapp/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionName: sessionName.trim(),
        }),
      });

      if (response.ok) {
        toast({
          title: "Sucesso",
          description: "Sessão criada com sucesso!",
        });
        setSessionName('');
      } else {
        throw new Error('Erro ao criar sessão');
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao criar sessão do WhatsApp",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          WhatsApp Integration
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Gerencie suas sessões do WhatsApp
        </p>
      </div>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Nova Sessão
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Input
              placeholder="Nome da sessão"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleCreateSession();
                }
              }}
            />
          </div>
          <Button 
            onClick={handleCreateSession}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Criando...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Criar Sessão
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}