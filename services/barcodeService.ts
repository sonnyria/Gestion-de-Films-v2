const PROXY_KEY_STORAGE = 'movieApp_barcodeProxyKey';

export const getBarcodeProxyKey = (): string => localStorage.getItem(PROXY_KEY_STORAGE) || '';
export const setBarcodeProxyKey = (key: string) => localStorage.setItem(PROXY_KEY_STORAGE, key.trim());

export type BarcodeLookupResult = {
  status: 'success' | 'not-found' | 'unavailable' | 'unconfigured' | 'invalid';
  title?: string;
  message?: string;
};

// Remove technical packaging labels, preserving subtitles and real title words.
const cleanTitle = (title: string): string => title
  .replace(/[\[(]\s*(?:(?:blu[ -]?ray|dvd|vhs|laserdisc|4k|uhd|ultra hd|3d|disc|combo|digital|copy|region [a-c0-9]|\d{4})[\s+&/,]*)+[\])]/gi, '')
  .replace(/\s*[-–|]?\s+(?:blu[ -]?ray|dvd|vhs|laserdisc|4k ultra hd|uhd)\s*$/i, '')
  .replace(/\s+/g, ' ').replace(/\s*[-–|]\s*$/, '').trim();

const canonicalCode = (code: string) => code.replace(/^0+/, '');

// Only a redacted, plain-text error leaves this module. Never expose a proxy URL/key.
const sanitizeDetail = (value: string, key: string): string => {
  let detail = value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]*>/g, ' ');
  for (const secret of [key, encodeURIComponent(key)].filter(Boolean)) {
    detail = detail.split(secret).join('[masqué]');
  }
  return detail.replace(/((?:api[-_]?key|key|token|authorization)\s*[:=]\s*)[^\s&"<>]+/gi, '$1[masqué]')
    .replace(/\s+/g, ' ').trim().slice(0, 320);
};

const readResponse = async (response: Response, key: string) => {
  const raw = await response.text();
  let data: any;
  try { data = JSON.parse(raw); } catch { data = null; }
  const message = data?.error?.message ?? data?.message ?? (typeof data?.error === 'string' ? data.error : undefined);
  const detail = sanitizeDetail(typeof message === 'string' ? message : data ? '' : raw, key);
  return { data, detail };
};

const failureMessage = (status: number, detail: string): string => {
  const explanation = status === 403 ? 'Accès bloqué (HTTP 403) par CorsProxy ou le catalogue. Ce refus ne prouve pas que la clé est incorrecte.'
    : status === 401 ? 'Authentification refusée (HTTP 401). Le service peut refuser une clé inactive ou non autorisée.'
    : status === 429 ? 'La limite de recherches Internet est atteinte (HTTP 429). Réessayez plus tard.'
    : `Le service de recherche Internet a répondu HTTP ${status}.`;
  const domainHelp = /domain|origin|whitelist|allowlist/i.test(detail)
    ? ' Si votre compte applique une liste de domaines autorisés, ajoutez https://sonnyria.github.io dans CorsProxy.' : '';
  return explanation + (detail ? ` Détail du service : ${detail}` : '') + domainHelp;
};

const proxyRequest = (target: string, key: string, signal: AbortSignal) => fetch(
  `https://corsproxy.io/?key=${encodeURIComponent(key)}&url=${encodeURIComponent(target)}`, { signal },
);


export const barcodeService = {
  async lookup(barcode: string, configuredKey?: string): Promise<BarcodeLookupResult> {
    if (!/^(?:\d{8}|\d{12,14})$/.test(barcode)) {
      return { status: 'invalid', message: 'Code-barres invalide : utilisez un code EAN ou UPC.' };
    }
    let key: string;
    try { key = (configuredKey ?? getBarcodeProxyKey()).trim(); } catch {
      return { status: 'unavailable', message: 'Impossible de lire la configuration de recherche.' };
    }
    if (!key) {
      return { status: 'unconfigured', message: 'Pour identifier le film sur Internet, renseignez votre clé CorsProxy dans Configuration → Recherche par code-barres.' };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const targetUrl = `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`;
      const response = await proxyRequest(targetUrl, key, controller.signal);
      const { data, detail } = await readResponse(response, key);
      if ([401, 403, 429].includes(response.status)) {
        return { status: 'unavailable', message: failureMessage(response.status, detail) };
      }
      if (!data) return { status: 'unavailable', message: failureMessage(response.status, detail || 'Réponse non JSON du service.') };
      if (data.code === 'NOT_FOUND') return { status: 'not-found', message: 'Ce code-barres est absent du catalogue Internet consulté.' };
      if (!response.ok || data.code !== 'OK' || !Array.isArray(data.items)) {
        return { status: 'unavailable', message: failureMessage(response.status, detail || (typeof data.code === 'string' ? sanitizeDetail(data.code, key) : 'Réponse inattendue.')) };
      }
      for (const item of data.items) {
        const codes = [item.ean, item.upc, item.gtin].filter((code): code is string => typeof code === 'string');
        if (!codes.some(code => canonicalCode(code) === canonicalCode(barcode))) continue;
        if (typeof item.title !== 'string') continue;
        const isFilm = /DVDs?\s*&\s*Videos?|Movies?|Films?/i.test(item.category || '') ||
          /\b(?:blu[ -]?ray|dvd|vhs|laserdisc)\b/i.test(item.title);
        if (!isFilm) continue;
        const title = cleanTitle(item.title);
        if (title) return { status: 'success', title };
      }
      return { status: 'not-found', message: 'Aucun titre de film correspondant à ce code-barres dans le catalogue Internet consulté.' };
    } catch {
      return { status: 'unavailable', message: 'La recherche Internet a échoué ou a dépassé 12 secondes. Vérifiez votre connexion puis réessayez.' };
    } finally {
      clearTimeout(timeout);
    }
  },

  async testConnection(configuredKey: string): Promise<string> {
    const key = configuredKey.trim();
    if (!key) return 'Renseignez la clé CorsProxy avant de lancer le test.';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const proxyTest = (async () => {
      try {
        const response = await proxyRequest('https://jsonplaceholder.typicode.com/todos/1', key, controller.signal);
        const { data, detail } = await readResponse(response, key);
        if (response.ok && data?.id === 1) return 'CorsProxy : OK (accès à une API JSON publique).';
        return 'Test CorsProxy : ' + failureMessage(response.status, detail || 'Réponse inattendue.');
      } catch {
        return 'Test CorsProxy : aucune réponse exploitable sous 12 secondes (connexion, blocage navigateur ou délai dépassé).';
      } finally { clearTimeout(timeout); }
    })();
    const [proxy, catalogue] = await Promise.all([proxyTest, barcodeService.lookup('883929106646', key)]);
    const catalogReport = catalogue.status === 'success'
      ? `Catalogue UPCitemdb : OK — titre du code de test : ${catalogue.title}.`
      : `Catalogue UPCitemdb : ${catalogue.message || 'Aucun titre disponible pour le code de test.'}`;
    return proxy + '\n' + catalogReport;
  },

  async getProductTitle(barcode: string): Promise<string | null> {
    const result = await barcodeService.lookup(barcode);
    return result.status === 'success' ? result.title! : null;
  },
};
