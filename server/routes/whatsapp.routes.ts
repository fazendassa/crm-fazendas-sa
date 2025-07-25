import { Router, Request, Response } from 'express';
import { db } from '../db';
import { whatsappMessages, whatsappSessions, contacts } from '@shared/schema';
import { and, eq, sql, desc, inArray, or, asc } from 'drizzle-orm';
import wapiService from "../services/wapi.service";
import { requireUser } from '../supabaseAuth';

const router = Router();

/**
 * POST /api/whatsapp/webhook
 * Recebe mensagens da W-API via webhook (Rota Pública)
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const webhookData = req.body;


    const parsed = wapiService.parseWebhookData(webhookData);
    if (!parsed) {
      return res.status(200).json({ received: true, message: 'Payload não processável ou ignorado.' });
    }

    const { phone: chatId, message: incomingMessage, messageId: incomingId, timestamp, fromMe, type, mediaUrl } = parsed;

    const lastSentMessage = await db.query.whatsappMessages.findFirst({
      where: and(
        eq(whatsappMessages.chatId, chatId),
        eq(whatsappMessages.direction, 'outgoing')
      ),
      orderBy: [desc(whatsappMessages.timestamp)],
    });

    let session;
    if (lastSentMessage) {
      session = await db.query.whatsappSessions.findFirst({
        where: eq(whatsappSessions.id, lastSentMessage.sessionId)
      });
    } else {
      console.log(`Nenhuma conversa anterior encontrada para ${chatId}. Usando primeira sessão ativa como fallback.`);
      session = await db.query.whatsappSessions.findFirst({
        where: eq(whatsappSessions.isActive, true)
      });
    }

    if (!session) {
      console.error('Nenhuma sessão ativa encontrada para processar webhook. Mensagem não será salva.');
      return res.status(200).json({ received: true, error: 'Nenhuma sessão ativa encontrada.' });
    }

    await db.insert(whatsappMessages).values({
      sessionId: session.id,
      messageId: incomingId,
      chatId: chatId,
      fromNumber: fromMe ? session.phoneNumber || '' : chatId,
      toNumber: fromMe ? chatId : session.phoneNumber || '',
      content: incomingMessage,
      messageType: type,
      mediaUrl: mediaUrl || null,
      direction: fromMe ? 'outgoing' : 'incoming',
      timestamp: new Date(timestamp),
      isRead: fromMe
    });

    await db.update(whatsappSessions)
      .set({ lastActivity: new Date() })
      .where(eq(whatsappSessions.id, session.id));

    let contact = await db.query.contacts.findFirst({
      where: eq(contacts.phone, chatId)
    });

    if (!contact) {
      await db.insert(contacts).values({
        name: `Contato ${chatId}`,
        phone: chatId,
        status: 'prospect',
        source: 'whatsapp',
      });
    }

    res.status(200).json({ received: true });

  } catch (error: any) {
    console.error('Erro ao processar webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao processar webhook'
    });
  }
});

/**
 * GET /api/whatsapp/status
 * Verifica o status da instância W-API (Rota Pública)
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = await wapiService.getInstanceStatus();
    res.json(status);
  } catch (error: any) {
    console.error('Erro ao obter status:', error);
    res.status(500).json({ success:false, error:'Erro ao obter status' });
  }
});

/**
 * GET /api/whatsapp/qrcode
 * Obtém o QR Code para conexão (Rota Pública)
 */
router.get('/qrcode', async (req: Request, res: Response) => {
  try {
    const qr = await wapiService.getQrCode();
    res.json(qr);
  } catch (error: any) {
    console.error('Erro ao obter QR Code:', error);
    res.status(500).json({ success:false, error:'Erro ao obter QR Code' });
  }
});

/**
 * POST /api/whatsapp/send
 * Envia uma mensagem via W-API
 */
router.post('/send', requireUser, async (req: Request, res: Response) => {
  try {
    const { phone, message } = req.body;
    const { user } = (req as any);

    if (!phone || !message) {
      return res.status(400).json({ success: false, error: 'Telefone e mensagem são obrigatórios' });
    }

    const result = await wapiService.sendMessage(phone, message);

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    let session = await db.query.whatsappSessions.findFirst({
      where: and(
        eq(whatsappSessions.userId, user.sub!),
        eq(whatsappSessions.isActive, true)
      )
    });

    if (!session) {
      const [newSession] = await db.insert(whatsappSessions).values({
        userId: user.sub!,
        sessionName: 'W-API Session',
        status: 'connected',
        phoneNumber: '', // O número será preenchido pelo webhook ou status
        isActive: true,
        lastActivity: new Date()
      }).returning();
      session = newSession;
    }

    const [savedMessage] = await db.insert(whatsappMessages).values({
      sessionId: session.id,
      messageId: result.data?.id || `wapi_${Date.now()}`,
      chatId: phone,
      fromNumber: session.phoneNumber || '',
      toNumber: phone,
      content: message,
      messageType: 'text',
      direction: 'outgoing',
      timestamp: new Date(),
      isRead: true
    }).returning();

    res.json({ success: true, data: { message: savedMessage, wapiResponse: result.data } });

  } catch (error: any) {
    console.error('Erro ao enviar mensagem:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

/**
 * GET /api/whatsapp/history/:contactId
 * Busca o histórico de mensagens de um contato
 */
router.get('/history/:contactId', requireUser, async (req: Request, res: Response) => {
  try {
    const { contactId } = req.params;
    const { user } = (req as any);

    let contact;
    if (/^\d+$/.test(contactId) && contactId.length <= 9) {
      contact = await db.query.contacts.findFirst({ where: eq(contacts.id, Number(contactId)) });
    } else {
      contact = await db.query.contacts.findFirst({ where: eq(contacts.phone, contactId) });
    }

    const phoneToSearch = (contact?.phone) || (typeof contactId === 'string' && contactId.length > 9 ? contactId : null);

    if (!phoneToSearch) {
      // Se não temos um número de telefone válido para buscar, retorna vazio.
      return res.json({ success: true, data: { messages: [], contact } });
    }

    const userSessions = await db.query.whatsappSessions.findMany({
      where: eq(whatsappSessions.userId, user.sub!),
      columns: { id: true },
    });

    if (userSessions.length === 0) {
      return res.json({ success: true, data: { messages: [], contact } });
    }

    const sessionIds = userSessions.map(s => s.id);

    const messages = await db
      .select()
      .from(whatsappMessages)
      .where(
        and(
          inArray(whatsappMessages.sessionId, sessionIds),
          or(
            eq(whatsappMessages.chatId, phoneToSearch),
            and(
              eq(whatsappMessages.fromNumber, phoneToSearch),
              eq(whatsappMessages.toNumber, phoneToSearch)
            )
          )
        )
      )
      .orderBy(asc(whatsappMessages.timestamp));

    res.json({ success: true, data: { messages, contact } });

  } catch (error: any) {
    console.error(`Erro ao buscar histórico para ${req.params.contactId}:`, error);
    res.status(500).json({ success: false, error: 'Erro ao buscar histórico de mensagens' });
  }
});

/**
 * GET /api/whatsapp/conversations
 * Lista todas as conversas ativas
 */
router.get('/conversations', requireUser, async (req: Request, res: Response) => {
  try {
    const { user } = (req as any);

    const latestMessageSubquery = db
      .select({
        chatId: whatsappMessages.chatId,
        maxTimestamp: sql<Date>`MAX(${whatsappMessages.timestamp})`.as('maxTimestamp'),
      })
      .from(whatsappMessages)
      .innerJoin(whatsappSessions, eq(whatsappMessages.sessionId, whatsappSessions.id))
      .where(eq(whatsappSessions.userId, user.sub!))
      .groupBy(whatsappMessages.chatId)
      .as('latest');

    const latestMessages = await db
      .select({
        chatId: whatsappMessages.chatId,
        content: whatsappMessages.content,
        timestamp: whatsappMessages.timestamp,
        direction: whatsappMessages.direction,
        isRead: whatsappMessages.isRead,
      })
      .from(whatsappMessages)
      .innerJoin(
        latestMessageSubquery,
        and(
          eq(whatsappMessages.chatId, latestMessageSubquery.chatId),
          eq(whatsappMessages.timestamp, latestMessageSubquery.maxTimestamp)
        )
      )
      .orderBy(desc(whatsappMessages.timestamp));

    const conversations = await Promise.all(latestMessages.map(async (msg) => {
      const contact = await db.query.contacts.findFirst({
        where: eq(contacts.phone, msg.chatId)
      });
      return {
        contact: contact || { name: msg.chatId, phone: msg.chatId },
        lastMessage: msg
      };
    }));

    res.json({ success: true, data: conversations });

  } catch (error: any) {
    console.error('Erro ao buscar conversas:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar conversas' });
  }
});

/**
 * POST /api/whatsapp/send-image
 * Envia uma imagem via W-API
 */
router.post('/send-image', requireUser, async (req: Request, res: Response) => {
  try {
    const { phone, imageUrl, caption } = req.body;
    const { user } = (req as any);

    if (!phone || !imageUrl) {
      return res.status(400).json({ success: false, error: 'Telefone e URL da imagem são obrigatórios' });
    }

    const result = await wapiService.sendImage(phone, imageUrl, caption);

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error || 'Falha ao enviar imagem' });
    }

    let session = await db.query.whatsappSessions.findFirst({
      where: and(
        eq(whatsappSessions.userId, user.sub!),
        eq(whatsappSessions.isActive, true)
      )
    });

    if (!session) {
      const [newSession] = await db.insert(whatsappSessions).values({
        userId: user.sub!,
        sessionName: 'W-API Session',
        status: 'connected',
        phoneNumber: '',
        isActive: true,
        lastActivity: new Date()
      }).returning();
      session = newSession;
    }

    await db.insert(whatsappMessages).values({
      sessionId: session.id,
      messageId: result.data?.messageId || `wapi_img_${Date.now()}`,
      chatId: phone,
      fromNumber: session.phoneNumber || '',
      toNumber: phone,
      content: caption || '',
      messageType: 'image',
      mediaUrl: imageUrl,
      direction: 'outgoing',
      timestamp: new Date(),
      isRead: true
    });

    res.json({ success: true, data: { message: `Imagem enviada para ${phone}`, wapiResponse: result.data } });

  } catch (error: any) {
    console.error('Erro ao enviar imagem:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// Rota para importar histórico de um contato (W-API não suporta, retorna vazio)
router.get('/import-history/:phone', requireUser, async (req: Request, res: Response) => {
  res.json({ success: true, message: 'W-API não suporta importação de histórico.', importedCount: 0 });
});

export default router;
