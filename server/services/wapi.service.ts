import axios, { AxiosInstance } from 'axios';

interface WApiConfig {
  instanceId: string;
  token: string;
  baseUrl: string;
}

interface WApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  resultCode?: number;
  message?: string;
}

interface SendTextRequest {
  phone: string;
  message: string;
}

interface SendImageRequest {
  phone: string;
  imageUrl: string;
  caption?: string;
}

interface InstanceStatus {
  connected: boolean;
  session: boolean;
  smartphoneConnected: boolean;
  created?: number;
  error?: string;
}

interface ChatMessage {
  id: string;
  fromMe: boolean;
  text?: string;
  caption?: string;
  type: string;
  timestamp: number;
  mediaUrl?: string;
  from?: string;
  to?: string;
}

class WApiService {
  private client: AxiosInstance;
  private config: WApiConfig;

  constructor() {
    this.config = {
      instanceId: process.env.WAPI_INSTANCE_ID || '',
      token: process.env.WAPI_TOKEN || '',
      baseUrl: 'https://api.w-api.app/v1'
    };

    if (!this.config.instanceId || !this.config.token) {
      throw new Error('WAPI_INSTANCE_ID e WAPI_TOKEN são obrigatórios');
    }

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.token}`
      },
      timeout: 30000
    });

    console.log('W-API Service inicializado para instância:', this.config.instanceId);
  }

  async sendMessage(phone: string, message: string): Promise<WApiResponse> {
    try {
      console.log(`Enviando mensagem para ${phone}: ${message}`);
      
      const response = await this.client.post('/message/send-text', 
        { phone, message },
        { params: { instanceId: this.config.instanceId } }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      console.error('Erro ao enviar mensagem via W-API:', error.response?.data || error.message);
      throw error;
    }
  }

  async sendImage(phone: string, imageUrl: string, caption?: string): Promise<WApiResponse> {
    try {
      console.log(`Enviando imagem para ${phone}: ${imageUrl}`);
      
      const response = await this.client.post('/message/send-image', 
        { phone, imageUrl, caption: caption || '' },
        { params: { instanceId: this.config.instanceId } }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      console.error('Erro ao enviar imagem via W-API:', error.response?.data || error.message);
      throw error;
    }
  }

  async getInstanceStatus(): Promise<WApiResponse<InstanceStatus>> {
    try {
      // Forçando a recarga do arquivo para garantir que o endpoint correto seja usado.
      console.log('Verificando status da instância W-API...');
      
      const response = await this.client.get('/instance/status-instance', {
        params: { instanceId: this.config.instanceId }
      });
      
      const status: InstanceStatus = {
        connected: response.data?.connected || false,
        session: response.data?.session || false,
        smartphoneConnected: response.data?.smartphoneConnected || false,
        created: response.data?.created,
        error: response.data?.error
      };

      return {
        success: true,
        data: status
      };
    } catch (error: any) {
      console.error('Erro ao verificar status da instância:', error.response?.data || error.message);
      throw error;
    }
  }

  async getQrCode(): Promise<WApiResponse<{ qrCode?: string; connected?: boolean }>> {
    try {
      console.log('Obtendo QR Code da instância W-API...');
      
      const response = await this.client.get('/instance/qrcode', {
        params: {
          instanceId: this.config.instanceId
        }
      });

      if (response.data?.qrCode) {
        return {
          success: true,
          data: {
            qrCode: response.data.qrCode,
            connected: false
          }
        };
      } else {
        return {
          success: false,
          error: 'QR Code não disponível - instância pode já estar conectada'
        };
      }
    } catch (error: any) {
      console.error('Erro ao obter QR Code:', error.response?.data || error.message);
      throw error;
    }
  }

  async getChatHistory(phone: string): Promise<ChatMessage[]> {
    try {
      console.log(`Buscando histórico de conversa para ${phone}...`);
      
      // W-API pode não ter endpoint de histórico - retornando array vazio por enquanto
      // Verificar documentação específica da W-API para este endpoint
      console.warn('W-API: Endpoint de histórico não implementado - retornando array vazio');
      return [];
      
    } catch (error: any) {
      console.error('Erro ao buscar histórico:', error.response?.data || error.message);
      return [];
    }
  }

  // Método para processar webhook da W-API
  parseWebhookData(webhookData: any): {
    phone: string;
    message: string;
    messageId: string;
    timestamp: number;
    fromMe: boolean;
    type: string;
    mediaUrl?: string;
  } | null {
    try {
      // Novo formato de webhook da W-API
      if (webhookData.event !== 'webhookReceived' || webhookData.fromMe) {
        return null;
      }

      const message = webhookData.msgContent?.conversation;

      if (!message) {
        return null;
      }

      const phone = webhookData.sender.id;
      const messageId = webhookData.messageId;
      const timestamp = webhookData.moment;
      const fromMe = webhookData.fromMe;
      const type = 'chat'; // Assumindo 'chat' por enquanto

      return { phone, message, messageId, timestamp, fromMe, type };
    } catch (error) {
      console.error('Erro ao fazer parse do webhook:', error);
      return null;
    } 
  }
}

// Singleton instance
const wapiService = new WApiService();
export default wapiService;
