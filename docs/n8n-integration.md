# Integração n8n - Criação de Usuários Integrados

## Visão Geral

Este endpoint permite criar usuários simultaneamente na **Evo AI** e **SaaSAPI** através de uma única requisição, ideal para automações via n8n.

## Endpoint

**POST** `/api/users/register-integrated`

## Descrição

O endpoint cria um usuário primeiro na **Evo AI** (plataforma de IA) e depois na **SaaSAPI** (plataforma SaaS), garantindo que ambos os sistemas tenham o mesmo usuário com dados consistentes.

### Funcionalidades:
- ✅ Criação dual de usuários (Evo AI + SaaSAPI)
- ✅ Sincronização de senhas (mesmo hash)
- ✅ Vinculação via `client_id` e `evoAiUserId`
- ✅ Usuário ativo e verificado automaticamente na Evo AI
- ✅ Criação automática de empresa temporária na SaaSAPI
- ✅ Geração de token JWT para acesso imediato

## Parâmetros de Entrada

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------||
| `name` | string | ✅ | Nome completo do usuário |
| `email` | string | ✅ | Email válido (único) |
| `password` | string | ✅ | Senha (mínimo 8 caracteres) |
| `plan` | string | ❌ | Plano desejado (padrão: "basic") |

## Exemplo de Requisição

```bash
curl -X POST http://localhost:9000/api/users/register-integrated \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Silva",
    "email": "joao@exemplo.com",
    "password": "minhasenha123",
    "plan": "basic"
  }'
```

## Resposta de Sucesso (200)

```json
{
  "success": true,
  "message": "Usuário criado com sucesso nas duas plataformas",
  "data": {
    "user": {
      "id": "cedf0eb3-a3bb-449e-a9a0-cbf81aaf3436",
      "name": "João Silva",
      "email": "joao@exemplo.com",
      "plan": "basic",
      "evoAiUserId": "6490d873-a1af-4ce9-9e12-308d983cafc0",
      "client_Id": "0b20ec21-cde3-4285-b8eb-1588f3ea1f71"
    },
    "companyId": "f7b81810-e3d3-4510-a760-34c749cbf815",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

## Respostas de Erro

### 400 - Dados Inválidos
```json
{
  "success": false,
  "error": "Dados de entrada inválidos: [detalhes]"
}
```

### 409 - Usuário Já Existe
```json
{
  "success": false,
  "error": "Usuário já cadastrado com este email"
}
```

### 500 - Erro na Evo AI
```json
{
  "success": false,
  "error": "Erro na Evo AI: [detalhes]"
}
```

### 500 - Erro Interno
```json
{
  "success": false,
  "error": "Erro interno do servidor"
}
```

## Configuração no n8n

### 1. Nó HTTP Request

Configure um nó **HTTP Request** com:

- **Method**: POST
- **URL**: `https://seu-dominio.com/api/users/register-integrated`
- **Headers**: 
  ```json
  {
    "Content-Type": "application/json"
  }
  ```
- **Body**: JSON com os dados do usuário

### 2. Exemplo de Workflow

```json
{
  "nodes": [
    {
      "name": "Criar Usuário Integrado",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "POST",
        "url": "https://seu-dominio.com/api/users/register-integrated",
        "headers": {
          "Content-Type": "application/json"
        },
        "body": {
          "name": "{{ $json.nome }}",
          "email": "{{ $json.email }}",
          "password": "{{ $json.senha }}",
          "plan": "basic"
        }
      }
    }
  ]
}
```

## Variáveis de Ambiente Necessárias

```env
EVO_AI_BASE_URL=https://evoai.whatlead.com.br
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