# Integração n8n - Criação de Usuário Integrado

## Visão Geral

Este documento descreve como usar o endpoint integrado para criar usuários simultaneamente na plataforma Evo AI e SaaSAPI através do n8n.

## Endpoint

**POST** `/api/users/register-integrated`

## Descrição

Este endpoint cria um usuário de forma integrada nas duas plataformas:
1. **Evo AI**: Cria o usuário com `is_active=true` e `email_verified=true`
2. **SaaSAPI**: Cria o usuário usando a mesma hash de senha e vincula o `client_id` da Evo AI

## Parâmetros de Entrada

```json
{
  "name": "string (obrigatório)",
  "email": "string (obrigatório)",
  "password": "string (obrigatório)",
  "plan": "string (opcional, padrão: 'free')"
}
```

### Exemplo de Requisição

```json
{
  "name": "João Silva",
  "email": "joao.silva@exemplo.com",
  "password": "minhasenha123",
  "plan": "premium"
}
```

## Resposta de Sucesso

**Status Code:** `201 Created`

```json
{
  "success": true,
  "message": "Usuário criado com sucesso nas duas plataformas",
  "data": {
    "user": {
      "id": "uuid-saasapi",
      "name": "João Silva",
      "email": "joao.silva@exemplo.com",
      "plan": "premium",
      "evoAiUserId": "uuid-evo-ai",
      "client_Id": "uuid-client-evo-ai"
    },
    "companyId": "uuid-company",
    "token": "jwt-token"
  }
}
```

## Resposta de Erro

**Status Code:** `400 Bad Request` ou `500 Internal Server Error`

```json
{
  "success": false,
  "error": "Mensagem de erro específica"
}
```

### Possíveis Erros

- `400`: Dados obrigatórios ausentes
- `400`: Email já cadastrado
- `500`: Erro ao comunicar com a Evo AI
- `500`: Erro interno do servidor

## Configuração no n8n

### 1. Nó HTTP Request

Configure um nó HTTP Request com as seguintes configurações:

- **Method**: POST
- **URL**: `http://seu-servidor/api/users/register-integrated`
- **Headers**:
  ```json
  {
    "Content-Type": "application/json"
  }
  ```
- **Body**: JSON com os dados do usuário

### 2. Exemplo de Workflow n8n

```json
{
  "nodes": [
    {
      "parameters": {
        "method": "POST",
        "url": "http://localhost:3000/api/users/register-integrated",
        "options": {
          "headers": {
            "Content-Type": "application/json"
          }
        },
        "body": {
          "name": "{{ $json.name }}",
          "email": "{{ $json.email }}",
          "password": "{{ $json.password }}",
          "plan": "{{ $json.plan || 'free' }}"
        }
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 1,
      "position": [250, 300],
      "name": "Create Integrated User"
    }
  ]
}
```

## Variáveis de Ambiente Necessárias

Certifique-se de que as seguintes variáveis estejam configuradas no seu ambiente:

```env
# URL base da Evo AI
EVO_AI_BASE_URL=http://localhost:8000

# Outras configurações necessárias...
DATABASE_URL=postgresql://...
```

## Fluxo de Funcionamento

1. **Validação**: Os dados de entrada são validados
2. **Hash da Senha**: A senha é processada com bcrypt (10 rounds)
3. **Criação na Evo AI**: 
   - Usuário criado com `auto_verify=true`
   - Cliente associado é criado automaticamente
   - Retorna `user_id` e `client_id`
4. **Criação na SaaSAPI**:
   - Usa a mesma hash de senha
   - Vincula `evoAiUserId` e `client_Id`
   - Cria empresa temporária
   - Gera token JWT
5. **Resposta**: Retorna dados completos do usuário criado

## Benefícios

- ✅ **Consistência**: Mesma hash de senha nas duas plataformas
- ✅ **Integração**: `client_id` da Evo AI vinculado na SaaSAPI
- ✅ **Automação**: Usuário ativo e verificado automaticamente
- ✅ **Single Point**: Um único endpoint para criar em ambas as plataformas
- ✅ **Transacional**: Se falhar em uma plataforma, não cria na outra

## Troubleshooting

### Erro de Comunicação com Evo AI

Se você receber erros relacionados à comunicação com a Evo AI:

1. Verifique se a Evo AI está rodando
2. Confirme a variável `EVO_AI_BASE_URL`
3. Verifique conectividade de rede
4. Consulte os logs da aplicação

### Usuário Já Existe

Se o email já estiver cadastrado em qualquer uma das plataformas, o processo será interrompido e retornará erro.

### Logs

Para debug, consulte os logs da aplicação que incluem:
- Tentativas de criação de usuário
- Comunicação com Evo AI
- Erros de transação no banco de dados

## Suporte

Para suporte técnico ou dúvidas sobre a integração, consulte:
- Logs da aplicação SaaSAPI
- Logs da aplicação Evo AI
- Documentação das APIs individuais