const TRIBUNAL_MAP = {
  '8.01': 'tjac', '8.02': 'tjal', '8.03': 'tjap', '8.04': 'tjam',
  '8.05': 'tjba', '8.06': 'tjce', '8.07': 'tjdft','8.08': 'tjes',
  '8.09': 'tjgo', '8.10': 'tjma', '8.11': 'tjmt', '8.12': 'tjms',
  '8.13': 'tjmg', '8.14': 'tjpa', '8.15': 'tjpb', '8.16': 'tjpr',
  '8.17': 'tjpe', '8.18': 'tjpi', '8.19': 'tjrj', '8.20': 'tjrn',
  '8.21': 'tjrs', '8.22': 'tjro', '8.23': 'tjrr', '8.24': 'tjsc',
  '8.25': 'tjse', '8.26': 'tjsp', '8.27': 'tjto',
  '4.01': 'trf1', '4.02': 'trf2', '4.03': 'trf3',
  '4.04': 'trf4', '4.05': 'trf5', '4.06': 'trf6',
  '5.01': 'trt1', '5.02': 'trt2', '5.03': 'trt3', '5.04': 'trt4',
  '5.05': 'trt5', '5.06': 'trt6', '5.07': 'trt7', '5.08': 'trt8',
  '5.09': 'trt9', '5.10': 'trt10','5.11': 'trt11','5.12': 'trt12',
  '5.13': 'trt13','5.14': 'trt14','5.15': 'trt15','5.16': 'trt16',
  '5.17': 'trt17','5.18': 'trt18','5.19': 'trt19','5.20': 'trt20',
  '5.21': 'trt21','5.22': 'trt22','5.23': 'trt23','5.24': 'trt24',
  '1.00': 'stf', '2.00': 'stj', '3.00': 'tst', '6.00': 'stm',
  '7.00': 'tse'
};

function detectTribunal(numero) {
  // Formato CNJ: NNNNNNN-DD.AAAA.J.TT.OOOO
  const match = numero.replace(/\s/g, '').match(/^\d{7}-\d{2}\.\d{4}\.(\d)\.(\d{2})\.\d{4}$/);
  if (!match) return null;
  const key = `${match[1]}.${match[2]}`;
  return TRIBUNAL_MAP[key] || null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });

  const { numero, tribunal } = req.body || {};
  if (!numero) return res.status(400).json({ erro: 'Número do processo obrigatório' });

  const apiKey = process.env.CNJ_API_KEY;
  if (!apiKey) return res.status(500).json({ erro: 'Chave de API não configurada' });

  const sigla = tribunal || detectTribunal(numero);
  if (!sigla) return res.status(400).json({ erro: 'Tribunal não identificado. Informe o tribunal manualmente.' });

  const url = `https://api-publica.datajud.cnj.jus.br/api_publica_${sigla}/_search`;

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `APIKey ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: { match: { numeroProcesso: numero.replace(/\s/g, '') } },
        size: 1
      })
    });

    if (!resp.ok) {
      const text = await resp.text();
      return res.status(resp.status).json({ erro: `Erro DataJud: ${resp.status}`, detalhe: text });
    }

    const data = await resp.json();
    const hits = data?.hits?.hits || [];
    if (hits.length === 0) return res.status(404).json({ erro: 'Processo não encontrado no DataJud' });

    const proc = hits[0]._source;
    return res.status(200).json({
      numero: proc.numeroProcesso,
      tribunal: proc.tribunal?.nome || sigla.toUpperCase(),
      classe: proc.classe?.nome,
      assunto: proc.assuntos?.map(a => a.nome).join(', '),
      orgaoJulgador: proc.orgaoJulgador?.nome,
      dataAjuizamento: proc.dataAjuizamento,
      grau: proc.grau,
      partes: proc.partes || [],
      movimentos: (proc.movimentos || []).slice(0, 20).map(m => ({
        data: m.dataHora,
        descricao: m.nome,
        complemento: m.complementosTabelados?.map(c => c.descricao).join('; ')
      }))
    });
  } catch (err) {
    return res.status(500).json({ erro: 'Falha na requisição', detalhe: err.message });
  }
}
