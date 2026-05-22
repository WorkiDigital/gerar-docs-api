# Gerar Docs API

API para gerar contratos **DOCX** ou **PDF** a partir de um modelo `.docx` com variáveis no formato:

```txt
{{contratante_nome_responsavel}}
{{contratante_empresa}}
{{contratante_cnpj}}
```

Ela foi criada para ser usada com n8n, GitHub e EasyPanel.

## Endpoints

### Health check

```http
GET /health
```

Resposta esperada:

```json
{
  "ok": true,
  "service": "contract-render-api",
  "output": ["docx", "pdf"]
}
```

### Gerar contrato

```http
POST /render-contract
```

Headers:

```http
Content-Type: application/json
X-API-Key: sua_chave
```

Body:

```json
{
  "templateUrl": "https://docs.google.com/document/d/e/SEU_ID/export?format=docx",
  "output": "pdf",
  "fileName": "Contrato - Cliente.pdf",
  "variables": {
    "contratante_nome_responsavel": "Herickson Maia",
    "contratante_cpf": "01389063356",
    "contratante_email": "workidigitaloficial@gmail.com",
    "contratante_telefone": "55859924945",
    "contratante_endereco_pessoal": "Rua Doutor Procópio 1360",
    "contratante_empresa": "HKGHK",
    "contratante_cnpj": "131516464646",
    "contratante_endereco_empresa": "Rua Doutor Procópio 1360"
  }
}
```

Resposta:

- `application/pdf`, se `output` for `pdf`
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, se `output` for `docx`

## Rodar local

```bash
npm install
cp .env.example .env
npm start
```

Para gerar PDF localmente, precisa ter LibreOffice instalado.

## Rodar com Docker

```bash
docker build -t gerar-docs-api .
docker run -p 3000:3000 --env-file .env gerar-docs-api
```

## EasyPanel

1. Crie um app usando este repositório.
2. Selecione deploy via Dockerfile.
3. Configure as variáveis de ambiente:

```env
PORT=3000
API_KEY=uma_chave_segura
MAX_BODY_SIZE=10mb
DOWNLOAD_TIMEOUT_MS=60000
CONVERT_TIMEOUT_MS=120000
MAX_TEMPLATE_BYTES=26214400
```

4. Depois de publicar, teste:

```txt
https://SEU-DOMINIO/health
```

5. No n8n, use:

```txt
CONTRACT_RENDER_API_URL=https://SEU-DOMINIO/render-contract
```

## Configuração no n8n

No nó **Gerar Contrato DOCX/PDF**:

- Method: `POST`
- URL:

```txt
={{ $json.CONTRACT_RENDER_API_URL }}
```

- Headers:

```txt
Content-Type: application/json
X-API-Key: SUA_CHAVE_DA_API
```

- Response Format: `File`
- Put Output in Field: `data`

- JSON Body:

```json
{
  "templateUrl": "={{ $json.CONTRACT_TEMPLATE_DOCX_URL }}",
  "output": "pdf",
  "fileName": "={{ $json.contrato_nome + '.pdf' }}",
  "variables": {
    "contratante_nome_responsavel": "={{ $json.cliente_nome }}",
    "contratante_cpf": "={{ $json.cpf }}",
    "contratante_email": "={{ $json.cliente_email }}",
    "contratante_telefone": "={{ $json.cliente_telefone }}",
    "contratante_endereco_pessoal": "={{ $json.endereco_pessoal }}",
    "contratante_empresa": "={{ $json.empresa_nome }}",
    "contratante_cnpj": "={{ $json.cnpj }}",
    "contratante_endereco_empresa": "={{ $json.endereco_empresa }}",

    "contratada_razao_social": "H. V. M. dos S. Silva",
    "contratada_nome_fantasia": "Worki Digital",
    "contratada_cnpj": "21.397.901/0001-39",
    "contratada_endereco": "Avenida Santos Dumont, nº 2789, complemento 506, Bairro Aldeota, CEP 60150-165, Fortaleza/CE",
    "contratada_representante": "Herickson Vinicius Maia dos Santos Silva",
    "contratada_cpf_representante": "013.890.633-56",

    "valor_parcela": "R$ 1.500,00",
    "valor_total": "R$ 4.500,00",
    "qtd_parcelas": "3",
    "qtd_parcelas_extenso": "três",
    "forma_pagamento": "Pix",
    "cidade_assinatura": "Fortaleza/CE",
    "foro": "Comarca de Fortaleza/CE"
  }
}
```

## Observação importante

O Google Docs precisa estar publicado na web e o link do template precisa terminar assim:

```txt
/export?format=docx
```
