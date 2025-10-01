# Limpeza de Metadados - Documentação

## Visão Geral

Esta funcionalidade remove automaticamente metadados de imagens, vídeos e áudios antes do envio pelo WhatsApp, garantindo privacidade e segurança dos dados.

## Funcionalidades

### ✅ Tipos de Mídia Suportados

#### Imagens

- **Formatos**: JPEG, PNG, GIF, WebP
- **Metadados Removidos**: EXIF, GPS, data/hora, informações da câmera
- **Processamento**: Re-codificação para JPEG otimizado

#### Vídeos

- **Formatos**: MP4, AVI, MOV, WMV
- **Metadados Removidos**: Data de criação, localização, informações do dispositivo
- **Processamento**: Re-codificação com FFmpeg

#### Áudios

- **Formatos**: MP3, WAV, OGG
- **Metadados Removidos**: Tags ID3, informações do artista, álbum
- **Processamento**: Re-codificação para MP3 otimizado

## Integração com o Sistema

### 1. Serviço de Limpeza (`MetadataCleanerService`)

```typescript
// Limpeza automática antes do envio
const cleanResult = await metadataCleanerService.cleanMediaMetadata(
  base64Data,
  fileName,
  mimetype,
);
```

### 2. Integração no Dispatcher

O serviço está integrado no `campaign-dispatcher.service.ts` e executa automaticamente antes de cada envio de mídia.

### 3. APIs de Teste

#### Testar Limpeza de Metadados

```http
POST /api/metadata-cleaner/test
Content-Type: application/json

{
  "base64Data": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...",
  "fileName": "foto.jpg",
  "mimetype": "image/jpeg"
}
```

#### Obter Tipos Suportados

```http
GET /api/metadata-cleaner/supported-types
```

## Benefícios

### 🔒 Privacidade

- Remove dados de localização GPS
- Elimina informações pessoais dos metadados
- Protege dados de dispositivos

### 📦 Otimização

- Reduz tamanho dos arquivos
- Melhora performance de envio
- Padroniza formatos

### 🛡️ Segurança

- Remove metadados sensíveis
- Previne vazamento de informações
- Conformidade com LGPD

## Exemplo de Uso

```typescript
// No campaign-dispatcher.service.ts
private async sendMedia(instanceName: string, phone: string, media: any) {
  // Limpeza automática de metadados
  const cleanResult = await metadataCleanerService.cleanMediaMetadata(
    media.media,
    media.fileName,
    media.mimetype
  );

  if (!cleanResult.success) {
    throw new Error(`Falha ao limpar metadados: ${cleanResult.error}`);
  }

  // Envio da mídia limpa
  const payload = {
    media: cleanResult.cleanedMedia!.data,
    fileName: cleanResult.cleanedMedia!.fileName,
    mimetype: cleanResult.cleanedMedia!.mimetype
  };

  // ... resto do código de envio
}
```

## Logs e Monitoramento

O sistema registra logs detalhados:

```typescript
// Exemplo de log
{
  "context": "MetadataCleaner",
  "message": "Metadados removidos com sucesso: foto.jpg",
  "data": {
    "originalSize": 1024000,
    "cleanedSize": 850000,
    "reduction": 174000
  }
}
```

## Dependências

- **Sharp**: Processamento de imagens
- **FFmpeg**: Processamento de vídeos e áudios
- **Node.js**: Runtime

## Instalação

```bash
npm install sharp ffmpeg-static
```

## Configuração

O serviço cria automaticamente um diretório `temp/` para processamento temporário de arquivos.

## Troubleshooting

### Erro: "FFmpeg não encontrado"

- Instale o FFmpeg no sistema
- Ou use `ffmpeg-static` (já incluído)

### Erro: "Sharp falhou"

- Verifique se as dependências estão instaladas
- Confirme permissões de escrita no diretório temp

### Arquivo muito grande

- O sistema suporta arquivos até 300MB
- Configure limites no `server.ts` se necessário

## Status da API

### Resposta de Sucesso

```json
{
  "success": true,
  "message": "Metadados removidos com sucesso",
  "data": {
    "originalSize": 1024000,
    "cleanedSize": 850000,
    "reduction": 174000,
    "reductionPercentage": 17,
    "cleanedMedia": {
      "fileName": "clean_foto_1234567890.jpg",
      "mimetype": "image/jpeg",
      "size": 850000
    }
  }
}
```

### Resposta de Erro

```json
{
  "success": false,
  "error": "Tipo de mídia não suportado: application/pdf",
  "data": {
    "originalSize": 1024000,
    "cleanedSize": 0
  }
}
```

## Contribuição

Para adicionar suporte a novos formatos:

1. Implemente o método no `MetadataCleanerService`
2. Adicione testes
3. Atualize a documentação
4. Teste com diferentes tipos de arquivo