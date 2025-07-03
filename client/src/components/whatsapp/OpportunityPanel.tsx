import React, { useState } from 'react';
import { 
  ChevronDown, 
  DollarSign, 
  Calendar,
  CheckCircle,
  XCircle,
  Circle,
  Edit,
  Save,
  ChevronRight,
  ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Deal {
  id: string;
  title: string;
  value: number;
  currency: string;
  stage: string;
  pipeline: string;
  probability: number;
  expectedCloseDate?: Date;
  createdAt: Date;
  description?: string;
  client: {
    name: string;
    company?: string;
  };
}

interface PipelineStage {
  id: string;
  name: string;
  position: number;
}

interface Pipeline {
  id: string;
  name: string;
  stages: PipelineStage[];
}

interface Note {
  id: string;
  content: string;
  createdAt: Date;
  userId: string;
  userName: string;
}

interface HistoryEntry {
  id: string;
  action: string;
  date: Date;
  user: string;
  details?: string;
}

interface OpportunityPanelProps {
  deal: Deal | null;
  pipelines: Pipeline[];
  notes: Note[];
  history: HistoryEntry[];
  onUpdateDeal: (dealId: string, updates: Partial<Deal>) => void;
  onUpdateStatus: (dealId: string, status: 'won' | 'lost' | 'open') => void;
  onAddNote: (dealId: string, content: string) => void;
  onUpdateNote: (noteId: string, content: string) => void;
  onDeleteNote: (noteId: string) => void;
}

export function OpportunityPanel({
  deal,
  pipelines,
  notes,
  history,
  onUpdateDeal,
  onUpdateStatus,
  onAddNote,
  onUpdateNote,
  onDeleteNote
}: OpportunityPanelProps) {
  const [isEditingNote, setIsEditingNote] = useState<string | null>(null);
  const [newNote, setNewNote] = useState('');
  const [expandedSections, setExpandedSections] = useState({
    deal: true,
    notes: true,
    history: false
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const formatCurrency = (value: number, currency: string = 'BRL') => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency
    }).format(value);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'won':
      case 'ganho':
        return 'bg-green-100 text-green-800';
      case 'lost':
      case 'perdido':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  const getCurrentPipeline = () => {
    return pipelines.find(p => p.name === deal?.pipeline);
  };

  const handleStatusUpdate = (status: 'won' | 'lost' | 'open') => {
    if (deal) {
      onUpdateStatus(deal.id, status);
    }
  };

  const handleAddNote = () => {
    if (deal && newNote.trim()) {
      onAddNote(deal.id, newNote.trim());
      setNewNote('');
    }
  };

  if (!deal) {
    return (
      <div className="h-full bg-gray-50 flex flex-col items-center justify-center p-6">
        <Circle className="w-16 h-16 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-600 mb-2">Nenhum negócio selecionado</h3>
        <p className="text-gray-500 text-center">
          Selecione uma conversa para ver os negócios relacionados
        </p>
      </div>
    );
  }

  return (
    <div className="h-full bg-white border-l border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-900">Oportunidade</h2>
          <div className="flex items-center gap-2">
            <Select
              value={deal.pipeline}
              onValueChange={(value) => onUpdateDeal(deal.id, { pipeline: value })}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pipelines.map((pipeline) => (
                  <SelectItem key={pipeline.id} value={pipeline.name}>
                    {pipeline.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Deal Value and Date */}
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            <span className="font-medium">{formatCurrency(deal.value, deal.currency)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>{formatDate(deal.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Status Actions */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700">
                <CheckCircle className="w-4 h-4 mr-2" />
                Ganho
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Marcar como Ganho</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja marcar este negócio como ganho? Esta ação não pode ser desfeita facilmente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleStatusUpdate('won')}>
                  Confirmar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive" className="flex-1">
                <XCircle className="w-4 h-4 mr-2" />
                Perdido
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Marcar como Perdido</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja marcar este negócio como perdido? Esta ação não pode ser desfeita facilmente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleStatusUpdate('lost')}>
                  Confirmar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button size="sm" variant="outline" className="flex-1">
            <Circle className="w-4 h-4 mr-2" />
            Aberto
          </Button>
        </div>
      </div>

      {/* Pipeline Stage */}
      <div className="p-4 border-b border-gray-200">
        <label className="text-sm font-medium text-gray-700 mb-2 block">Fase do Pipeline</label>
        <Select
          value={deal.stage}
          onValueChange={(value) => onUpdateDeal(deal.id, { stage: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {getCurrentPipeline()?.stages.map((stage) => (
              <SelectItem key={stage.id} value={stage.name}>
                {stage.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Expandable Sections */}
      <div className="flex-1 overflow-auto">
        {/* Deal Details */}
        <Collapsible open={expandedSections.deal} onOpenChange={() => toggleSection('deal')}>
          <CollapsibleTrigger className="w-full p-4 border-b border-gray-200 flex items-center justify-between hover:bg-gray-50">
            <h3 className="font-medium text-gray-900">Negócio</h3>
            {expandedSections.deal ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="p-4 border-b border-gray-200 space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Cliente</label>
              <p className="text-sm text-gray-900">{deal.client.name}</p>
              {deal.client.company && (
                <p className="text-xs text-gray-500">{deal.client.company}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Valor</label>
              <p className="text-sm text-gray-900">{formatCurrency(deal.value, deal.currency)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Probabilidade</label>
              <p className="text-sm text-gray-900">{deal.probability}%</p>
            </div>
            {deal.expectedCloseDate && (
              <div>
                <label className="text-sm font-medium text-gray-700">Data Esperada</label>
                <p className="text-sm text-gray-900">{formatDate(deal.expectedCloseDate)}</p>
              </div>
            )}
            {deal.description && (
              <div>
                <label className="text-sm font-medium text-gray-700">Descrição</label>
                <p className="text-sm text-gray-900">{deal.description}</p>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Notes */}
        <Collapsible open={expandedSections.notes} onOpenChange={() => toggleSection('notes')}>
          <CollapsibleTrigger className="w-full p-4 border-b border-gray-200 flex items-center justify-between hover:bg-gray-50">
            <h3 className="font-medium text-gray-900">Notas</h3>
            {expandedSections.notes ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="p-4 border-b border-gray-200 space-y-3">
            {/* Add New Note */}
            <div className="space-y-2">
              <Textarea
                placeholder="Adicionar nova nota..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="min-h-[80px]"
              />
              <Button 
                size="sm" 
                onClick={handleAddNote}
                disabled={!newNote.trim()}
                className="w-full"
              >
                <Save className="w-4 h-4 mr-2" />
                Salvar Nota
              </Button>
            </div>

            {/* Existing Notes */}
            <div className="space-y-3">
              {notes.map((note) => (
                <Card key={note.id} className="border border-gray-200">
                  <CardContent className="p-3">
                    {isEditingNote === note.id ? (
                      <div className="space-y-2">
                        <Textarea
                          defaultValue={note.content}
                          className="min-h-[60px]"
                          onBlur={(e) => {
                            onUpdateNote(note.id, e.target.value);
                            setIsEditingNote(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.ctrlKey) {
                              onUpdateNote(note.id, e.currentTarget.value);
                              setIsEditingNote(null);
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-gray-900 mb-2">{note.content}</p>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>{note.userName} • {formatDate(note.createdAt)}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsEditingNote(note.id)}
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* History */}
        <Collapsible open={expandedSections.history} onOpenChange={() => toggleSection('history')}>
          <CollapsibleTrigger className="w-full p-4 border-b border-gray-200 flex items-center justify-between hover:bg-gray-50">
            <h3 className="font-medium text-gray-900">Histórico</h3>
            {expandedSections.history ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="p-4 space-y-3">
            {history.map((entry) => (
              <div key={entry.id} className="flex items-start gap-3 text-sm">
                <div className="w-2 h-2 bg-gray-400 rounded-full mt-2 shrink-0" />
                <div className="flex-1">
                  <p className="text-gray-900">{entry.action}</p>
                  {entry.details && (
                    <p className="text-gray-600 text-xs">{entry.details}</p>
                  )}
                  <p className="text-gray-500 text-xs">
                    {entry.user} • {formatDate(entry.date)}
                  </p>
                </div>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}