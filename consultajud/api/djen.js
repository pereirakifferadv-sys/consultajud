export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });

  const { numero, dataInicio, dataFim, pagina = 1 } = req.body || {};
  if (!numero && !dataInicio) return res.status(400).json({ erro: 'Informe o número do processo ou um período de busca' });

  const apiKey = process.env.CNJ_API_KEY;
  if (!apiKey) return res.status(500).json({ erro: 'Chave de API não configurada' });

  const params = new URLSearchParams({
    numeroCNJ: numero || '',
    dataDisponibilizacaoInicio: dataInicio || '',
    dataDisponibilizacaoFim: dataFim || '',
    pagina: String(pagina),
    itensPorPagina: '20'
  });

  // Remove params vazios
  for (const [k, v] of [...params.entries()]) {
    if (!v) params.delete(k);
  }

  const url = `https://djen.jus.br/comunicacao/consultarComunicacoes?${params.toString()}`;

  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `APIKey ${apiKey}`,
        'Accept': 'application/json'
      }
    });

    if (!resp.ok) {
      const text = await resp.text();
      return res.status(resp.status).json({ erro: `Erro DJEN: ${resp.status}`, detalhe: text });
    }

    const data = await resp.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ erro: 'Falha na requisição ao DJEN', detalhe: err.message });
  }
}
