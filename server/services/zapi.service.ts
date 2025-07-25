import axios, { AxiosResponse } from 'axios';

interface ZApiConfig {
  instanceId: string;
  token: string;
  clientToken: string;
  baseUrl: string;
}

interface SendMessagePayload {
  phone: string;
  message: string;
  messageId?: string;
}

interface ZApiResponse {
  success: boolean;
  data?: any;
  error?: string;
}

interface InstanceStatus {
  connected: boolean;
  smartphoneConnected?: boolean;
  session?: boolean;
  phone?: string;
  status?: string;
}

export class ZApiService {
  private axios: import('axios').AxiosInstance;

  constructor() {
    const instanceId = process.env.ZAPI_INSTANCE_ID;
    const token = process.env.ZAPI_TOKEN;
    const clientToken = process.env.ZAPI_CLIENT_TOKEN;

    if (!instanceId || !token || !clientToken) {
      throw new Error('ZAPI_INSTANCE_ID, ZAPI_TOKEN e ZAPI_CLIENT_TOKEN são obrigatórios nas variáveis de ambiente');
    }

    this.axios = axios.create({
      baseURL: `https://api.z-api.io/instances/${instanceId}/token/${token}`,
      headers: { 'Client-Token': clientToken }
    });

    this.axios.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('Erro na chamada da Z-API:', error.response?.data || error.message);
        return Promise.reject(error.response?.data || { message: error.message });
      }
    );

    console.log('Z-API Service inicializado para instância:', instanceId);
  }

  async sendMessage(phone: string, message: string): Promise<any> {
    const payload: SendMessagePayload = {
      phone: this.formatPhone(phone),
      message
    };
    const response = await this.axios.post('/send-text', payload);
    return response.data;
  }

  async getInstanceStatus(): Promise<InstanceStatus> {
    const response = await this.axios.get('/status');
    const data = response.data;
    return {
      connected: data.connected === true,
      smartphoneConnected: data.smartphoneConnected === true,
      session: data.session === true,
      phone: data.phone,
      status: data.connected ? 'CONNECTED' : (data.error || 'DISCONNECTED')
    };
  }

  async getQrCode(): Promise<any> {
    const response = await this.axios.get('/qr-code/image.png');
    return response.data;
  }

  async sendImage(phone: string, imageUrl: string, caption?: string): Promise<any> {
    const payload = {
      phone: this.formatPhone(phone),
      image: imageUrl,
      caption: caption || ''
    };
    const response = await this.axios.post('/send-image', payload);
    return response.data;
  }

  async sendDocument(phone: string, documentUrl: string, filename?: string): Promise<any> {
    const payload = {
      phone: this.formatPhone(phone),
      document: documentUrl,
      filename: filename || 'documento.pdf'
    };
    const response = await this.axios.post('/send-document', payload);
    return response.data;
  }

  async getChatHistory(phone: string): Promise<any[]> {
    try {
      const response = await this.axios.get(`/chat-messages/${this.formatPhone(phone)}`);
      return response.data;
    } catch (error) {
      // Retorna array vazio em caso de erro (ex: chat não encontrado)
      return [];
    }
  }

  private formatPhone(phone: string): string {
    let cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone.startsWith('55')) {
      cleanPhone = '55' + cleanPhone;
    }
    return cleanPhone;
  }
}

export default new ZApiService();
