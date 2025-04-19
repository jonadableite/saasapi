// src/lib/pubsub.ts
type Subscriber = (data: any) => void;

export class PubSub {
  private topics: Map<string, Subscriber[]> = new Map();

  subscribe(topic: string, subscriber: Subscriber): () => void {
    if (!this.topics.has(topic)) {
      this.topics.set(topic, []);
    }
    const subscribers = this.topics.get(topic)!;
    subscribers.push(subscriber);

    // Retornar função para cancelar a inscrição
    return () => {
      const index = subscribers.indexOf(subscriber);
      if (index !== -1) {
        subscribers.splice(index, 1);
      }
    };
  }

  publish(topic: string, data: any = {}): void {
    const subscribers = this.topics.get(topic) || [];
    subscribers.forEach((subscriber) => {
      try {
        subscriber(data);
      } catch (error) {
        console.error(`Erro ao publicar no tópico ${topic}:`, error);
      }
    });
  }
}

// Singleton para uso em toda a aplicação
export const pubsub = new PubSub();
