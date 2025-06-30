
import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Copy, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DebugInfo {
  timestamp: string;
  type: 'frontend' | 'backend' | 'network';
  level: 'error' | 'warning' | 'info' | 'debug';
  message: string;
  details?: any;
  stack?: string;
  url?: string;
  status?: number;
  method?: string;
}

interface DebugDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debugLogs: DebugInfo[];
  title?: string;
}

export function DebugDialog({ open, onOpenChange, debugLogs, title = "Debug Logs - Erro Completo" }: DebugDialogProps) {
  const { toast } = useToast();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Copiado!",
        description: "Logs copiados para a área de transferência",
      });
    });
  };

  const copyAllLogs = () => {
    const allLogs = debugLogs.map(log => {
      return `[${log.timestamp}] ${log.type.toUpperCase()} - ${log.level.toUpperCase()}
Message: ${log.message}
${log.details ? `Details: ${JSON.stringify(log.details, null, 2)}` : ''}
${log.stack ? `Stack: ${log.stack}` : ''}
${log.url ? `URL: ${log.url}` : ''}
${log.status ? `Status: ${log.status}` : ''}
${log.method ? `Method: ${log.method}` : ''}
${'='.repeat(80)}`;
    }).join('\n');
    
    copyToClipboard(allLogs);
  };

  const formatLogLevel = (level: string) => {
    const variants = {
      error: "destructive",
      warning: "default",
      info: "secondary",
      debug: "outline"
    } as const;
    
    return variants[level as keyof typeof variants] || "default";
  };

  const formatLogType = (type: string) => {
    const colors = {
      frontend: "bg-blue-500",
      backend: "bg-red-500",
      network: "bg-yellow-500"
    } as const;
    
    return colors[type as keyof typeof colors] || "bg-gray-500";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              {title}
            </DialogTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyAllLogs}>
                <Copy className="w-4 h-4 mr-2" />
                Copiar Todos
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="space-y-4 p-2">
              {debugLogs.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  Nenhum log disponível
                </div>
              ) : (
                debugLogs.map((log, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={formatLogLevel(log.level)}>
                          {log.level.toUpperCase()}
                        </Badge>
                        <Badge className={`text-white ${formatLogType(log.type)}`}>
                          {log.type.toUpperCase()}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {log.timestamp}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(JSON.stringify(log, null, 2))}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                    
                    <div className="space-y-2">
                      <div>
                        <strong>Mensagem:</strong>
                        <pre className="mt-1 p-2 bg-muted rounded text-sm overflow-x-auto">
                          {log.message}
                        </pre>
                      </div>
                      
                      {log.url && (
                        <div>
                          <strong>URL:</strong> {log.url}
                          {log.method && <Badge variant="outline" className="ml-2">{log.method}</Badge>}
                          {log.status && <Badge variant="outline" className="ml-2">{log.status}</Badge>}
                        </div>
                      )}
                      
                      {log.details && (
                        <div>
                          <strong>Detalhes:</strong>
                          <pre className="mt-1 p-2 bg-muted rounded text-sm overflow-x-auto">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </div>
                      )}
                      
                      {log.stack && (
                        <div>
                          <strong>Stack Trace:</strong>
                          <pre className="mt-1 p-2 bg-muted rounded text-sm overflow-x-auto">
                            {log.stack}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type { DebugInfo };
