# Exemplo de Teste - Warmup com Grupos e Números Externos

## Configuração de Teste

### 1. Configuração Básica
```json
{
  "phoneInstances": [
    {
      "instanceId": "test-instance-1",
      "phoneNumber": "5511999999999"
    },
    {
      "instanceId": "test-instance-2",
      "phoneNumber": "5511888888888"
    }
  ],
  "contents": {
    "texts": [
      "Olá! Como vai?",
      "Tudo bem por aí?",
      "Que dia lindo!",
      "Como está o clima aí?",
      "Bom dia!",
      "Boa tarde!",
      "Boa noite!",
      "Tudo tranquilo?",
      "Que tal o dia?",
      "Fala aí!"
    ],
    "images": [],
    "audios": [],
    "videos": [],
    "stickers": [],
    "emojis": ["👍", "❤️", "😂", "😮", "😢", "🙏", "👏", "🔥"]
  },
  "config": {
    "textChance": 1.0,
    "audioChance": 0.0,
    "reactionChance": 0.3,
    "stickerChance": 0.0,
    "imageChance": 0.0,
    "videoChance": 0.0,
    "minDelay": 5000,
    "maxDelay": 15000,
    "groupChance": 0.5,           // 50% chance de enviar para grupo
    "externalNumbersChance": 0.6,  // 60% chance de usar números externos
    "groupId": "120363419940617369@g.us",
    "externalNumbers": []
  }
}
```

### 2. Configuração para Teste de Grupos
```json
{
  "phoneInstances": [
    {
      "instanceId": "test-instance-1",
      "phoneNumber": "5511999999999"
    }
  ],
  "contents": {
    "texts": [
      "Bom dia grupo!",
      "Como estão todos?",
      "Que dia lindo!",
      "Alguém aí?",
      "Tudo bem pessoal?",
      "Boa tarde grupo!",
      "Como foi o dia de vocês?",
      "Boa noite a todos!",
      "Até mais pessoal!",
      "Foi um prazer conversar!"
    ],
    "images": [],
    "audios": [],
    "videos": [],
    "stickers": [],
    "emojis": ["👍", "❤️", "👋", "🙏"]
  },
  "config": {
    "textChance": 1.0,
    "audioChance": 0.0,
    "reactionChance": 0.2,
    "stickerChance": 0.0,
    "imageChance": 0.0,
    "videoChance": 0.0,
    "minDelay": 8000,
    "maxDelay": 20000,
    "groupChance": 0.8,           // 80% chance de enviar para grupo
    "externalNumbersChance": 0.0,  // 0% chance de usar números externos
    "groupId": "120363419940617369@g.us",
    "externalNumbers": []
  }
}
```

### 3. Configuração para Teste de Números Externos
```json
{
  "phoneInstances": [
    {
      "instanceId": "test-instance-1",
      "phoneNumber": "5511999999999"
    }
  ],
  "contents": {
    "texts": [
      "Oi! Tudo bem?",
      "Como vai?",
      "Que tal o dia?",
      "Tudo tranquilo?",
      "Bom dia!",
      "Boa tarde!",
      "Boa noite!",
      "Como está?",
      "Fala aí!",
      "Até mais!"
    ],
    "images": [],
    "audios": [],
    "videos": [],
    "stickers": [],
    "emojis": ["👍", "❤️", "👋"]
  },
  "config": {
    "textChance": 1.0,
    "audioChance": 0.0,
    "reactionChance": 0.1,
    "stickerChance": 0.0,
    "imageChance": 0.0,
    "videoChance": 0.0,
    "minDelay": 10000,
    "maxDelay": 25000,
    "groupChance": 0.0,           // 0% chance de enviar para grupo
    "externalNumbersChance": 0.8,  // 80% chance de usar números externos
    "groupId": "120363419940617369@g.us",
    "externalNumbers": []
  }
}
```

## Como Testar

### 1. Teste de Grupos
1. Use a configuração 2 (Teste de Grupos)
2. Verifique se a instância é membro do grupo `120363419940617369@g.us`
3. Inicie o warmup
4. Monitore os logs para ver mensagens sendo enviadas para o grupo

### 2. Teste de Números Externos
1. Use a configuração 3 (Teste de Números Externos)
2. Inicie o warmup
3. Monitore os logs para ver mensagens sendo enviadas para números externos
4. Verifique que apenas 1-3 números são selecionados por ciclo

### 3. Teste Misto
1. Use a configuração 1 (Configuração Básica)
2. Inicie o warmup
3. Monitore os logs para ver:
   - Mensagens para grupo (50% das vezes)
   - Mensagens para números externos (60% das vezes)
   - Mensagens para instâncias (40% das vezes)

## Logs Esperados

### Para Grupos
```
Simulando digitação para grupo...
Enviando text para grupo
Mensagem text enviada com sucesso
Aguardando antes da próxima mensagem...
```

### Para Números Externos
```
Simulando digitação para 5511999151515...
Enviando text para 5511999151515
Mensagem text enviada com sucesso
Aguardando antes da próxima mensagem...
```

### Para Instâncias
```
Simulando digitação para 5511888888888...
Enviando text para 5511888888888
Mensagem text enviada com sucesso
Aguardando antes da próxima mensagem...
```

## Verificações

### 1. Verificar Status
```bash
GET /api/warmup/status
```

### 2. Verificar Estatísticas
```bash
GET /api/warmup/stats/{instanceId}
```

### 3. Parar Warmup
```bash
POST /api/warmup/stop/{instanceId}
```

### 4. Parar Todos
```bash
POST /api/warmup/stop-all
```

## Observações Importantes

1. **Grupo**: Certifique-se de que a instância é membro do grupo configurado
2. **Números Externos**: São apenas para envio, não recebem respostas
3. **Limites**: O sistema respeita os limites diários do plano
4. **Delays**: Mantém delays aleatórios para simular comportamento humano
5. **Logs**: Monitore os logs para verificar o funcionamento correto

## Status da Implementação

✅ **Tipos Atualizados**: O `WarmupConfig` já inclui as propriedades:
- `groupChance?: number` - Chance de enviar para grupo (0-1)
- `externalNumbersChance?: number` - Chance de usar números externos (0-1)
- `groupId?: string` - ID do grupo para enviar mensagens
- `externalNumbers?: string[]` - Lista de números externos customizados

✅ **Lógica Implementada**: O serviço de warmup já possui:
- Método `shouldSendToGroup()` - Decide se envia para grupo
- Método `shouldUseExternalNumbers()` - Decide se usa números externos
- Método `getMessageDestination()` - Determina o destino da mensagem
- Método `selectRandomExternalNumbers()` - Seleciona 1-3 números externos aleatórios
- Lista de números externos padrão em `constants/externalNumbers.ts`

✅ **Funcionalidades Disponíveis**:
- Envio para grupos do WhatsApp
- Envio para números externos (lista padrão + customizados)
- Seleção aleatória de destinos baseada em probabilidades
- Logs detalhados do processo de envio
- Respeito aos limites do plano do usuário