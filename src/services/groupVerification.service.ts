// src/services/groupVerification.service.ts
import axios from 'axios';
import { DEFAULT_GROUP_ID } from '../constants/externalNumbers';

interface GroupParticipant {
  id: string;
  admin?: string;
}

interface GroupInfo {
  id: string;
  subject: string;
  participants: GroupParticipant[];
}

export class GroupVerificationService {
  private apiUrl: string;
  private apiKey: string;

  constructor() {
    this.apiUrl = process.env.API_EVO_URL || '';
    this.apiKey = process.env.EVO_API_KEY || '';
  }

  /**
   * Verifica se uma instância está presente no grupo padrão
   */
  async isInstanceInGroup(instanceId: string): Promise<boolean> {
    try {
      const participants = await this.getGroupParticipants(instanceId);
      const instanceNumber = this.extractInstanceNumber(instanceId);
      
      return participants.some(participant => 
        participant.id.includes(instanceNumber)
      );
    } catch (error) {
      console.error(`Erro ao verificar se instância ${instanceId} está no grupo:`, error);
      return false;
    }
  }

  /**
   * Obtém os participantes do grupo padrão
   */
  private async getGroupParticipants(instanceId: string): Promise<GroupParticipant[]> {
    try {
      const response = await axios.get(
        `${this.apiUrl}/group/participants/${instanceId}`,
        {
          headers: {
            'apikey': this.apiKey,
            'Content-Type': 'application/json'
          },
          params: {
            groupJid: DEFAULT_GROUP_ID
          }
        }
      );

      return response.data.participants || [];
    } catch (error) {
      console.error(`Erro ao obter participantes do grupo para instância ${instanceId}:`, error);
      throw error;
    }
  }

  /**
   * Adiciona uma instância ao grupo padrão
   */
  async addInstanceToGroup(instanceId: string): Promise<boolean> {
    try {
      const instanceNumber = this.extractInstanceNumber(instanceId);
      
      const response = await axios.post(
        `${this.apiUrl}/group/updateParticipant/${instanceId}`,
        {
          action: 'add',
          participants: [instanceNumber]
        },
        {
          headers: {
            'apikey': this.apiKey,
            'Content-Type': 'application/json'
          },
          params: {
            groupJid: DEFAULT_GROUP_ID
          }
        }
      );

      console.log(`Instância ${instanceId} adicionada ao grupo com sucesso`);
      return response.status === 200;
    } catch (error) {
      console.error(`Erro ao adicionar instância ${instanceId} ao grupo:`, error);
      return false;
    }
  }

  /**
   * Verifica e adiciona múltiplas instâncias ao grupo se necessário
   */
  async verifyAndAddInstancesToGroup(instanceIds: string[]): Promise<{
    verified: string[];
    added: string[];
    failed: string[];
  }> {
    const result = {
      verified: [] as string[],
      added: [] as string[],
      failed: [] as string[]
    };

    for (const instanceId of instanceIds) {
      try {
        const isInGroup = await this.isInstanceInGroup(instanceId);
        
        if (isInGroup) {
          result.verified.push(instanceId);
          console.log(`Instância ${instanceId} já está no grupo`);
        } else {
          const added = await this.addInstanceToGroup(instanceId);
          if (added) {
            result.added.push(instanceId);
            console.log(`Instância ${instanceId} foi adicionada ao grupo`);
          } else {
            result.failed.push(instanceId);
            console.log(`Falha ao adicionar instância ${instanceId} ao grupo`);
          }
        }
      } catch (error) {
        result.failed.push(instanceId);
        console.error(`Erro ao processar instância ${instanceId}:`, error);
      }
    }

    return result;
  }

  /**
   * Extrai o número da instância do instanceId
   * Assume que o instanceId contém o número do WhatsApp
   */
  private extractInstanceNumber(instanceId: string): string {
    // Se o instanceId já é um número, retorna como está
    if (/^\d+$/.test(instanceId)) {
      return instanceId;
    }
    
    // Tenta extrair números do instanceId
    const numbers = instanceId.match(/\d+/g);
    if (numbers && numbers.length > 0) {
      // Pega o maior número encontrado (provavelmente o número do WhatsApp)
      return numbers.reduce((a, b) => a.length > b.length ? a : b);
    }
    
    // Se não conseguir extrair, retorna o instanceId original
    return instanceId;
  }

  /**
   * Obtém informações do grupo padrão
   */
  async getGroupInfo(instanceId: string): Promise<GroupInfo | null> {
    try {
      const response = await axios.get(
        `${this.apiUrl}/group/findGroupInfos/${instanceId}`,
        {
          headers: {
            'apikey': this.apiKey,
            'Content-Type': 'application/json'
          },
          params: {
            groupJid: DEFAULT_GROUP_ID
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error(`Erro ao obter informações do grupo para instância ${instanceId}:`, error);
      return null;
    }
  }
}

export const groupVerificationService = new GroupVerificationService();