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

export const barcodeService = {
  async lookup(barcode: string): Promise<BarcodeLookupResult> {
    if (!/^(?:\d{8}|\d{12,14})$/.test(barcode)) {
      return { status: 'invalid', message: 'Code-barres invalide : utilisez un code EAN ou UPC.' };
    }
    let key: string;
    try { key = getBarcodeProxyKey(); } catch {
      return { status: 'unavailable', message: 'Impossible de lire la configuration de recherche.' };
    }
    if (!key) {
      return { status: 'unconfigured', message: 'Pour identifier le film sur Internet, renseignez votre clé CorsProxy dans Configuration → Recherche par code-barres.' };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const targetUrl = `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`;
      const proxyUrl = `https://corsproxy.io/?key=${encodeURIComponent(key)}&url=${encodeURIComponent(targetUrl)}`;
      const response = await fetch(proxyUrl, { signal: controller.signal });
      if (response.status === 429) {
        return { status: 'unavailable', message: 'La limite de recherches Internet est atteinte. Réessayez plus tard.' };
      }
      if (response.status === 401 || response.status === 403) {
        return { status: 'unavailable', message: 'Le service refuse la recherche. Vérifiez votre clé CorsProxy dans Configuration.' };
      }
      const data = await response.json();
      if (data.code === 'NOT_FOUND') return { status: 'not-found', message: 'Ce code-barres est absent du catalogue Internet consulté.' };
      if (!response.ok || data.code !== 'OK' || !Array.isArray(data.items)) {
        return { status: 'unavailable', message: 'Le service de recherche Internet est indisponible. Réessayez plus tard.' };
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

  async getProductTitle(barcode: string): Promise<string | null> {
    const result = await barcodeService.lookup(barcode);
    return result.status === 'success' ? result.title! : null;
  },
};
