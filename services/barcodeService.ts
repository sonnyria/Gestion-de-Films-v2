import { ApiResponse } from '../types';

// Utilisation d'une API publique gratuite (avec limites) pour convertir EAN en Titre.
// Nous utilisons un proxy CORS pour éviter les erreurs "Failed to fetch" depuis le navigateur.

export const barcodeService = {
  /**
   * Tente de trouver le nom du produit via son code barre
   */
  async getProductTitle(barcode: string): Promise<string | null> {
    try {
      // Utilisation d'un proxy CORS pour contourner les restrictions du navigateur
      const proxyUrl = "https://corsproxy.io/?";
      const targetUrl = `https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`;
      
      const response = await fetch(proxyUrl + encodeURIComponent(targetUrl));
      
      if (!response.ok) return null;

      const data = await response.json();

      if (data.code === "OK" && data.items && data.items.length > 0) {
        let title = data.items[0].title;

        // SUPPRESSION DES GUILLEMETS et chevrons
        title = title.replace(/["«»]/g, '');

        // Nettoyage basique du titre (enlever [Blu-ray], (DVD), etc pour la recherche)
        title = title.replace(/\[.*?\]|\(.*?\)/g, '').trim();
        // Enlever les mentions communes de format à la fin
        title = title.replace(/Blu-ray|DVD|4K|Ultra HD|Edition|Collector/gi, '').trim();
        // Remplacer les tirets et séparateurs par des espaces pour aider la normalisation
        title = title.replace(/[-:_]/g, ' ').trim();
        // Nettoyage final des caractères de ponctuation trainants
        title = title.replace(/\s+$/, '').trim();
        return title;
      }
    } catch (e) {
      // On ignore silencieusement l'erreur pour ne pas bloquer l'utilisateur
      // L'appli cherchera simplement le code barre brut dans le sheet
      return null;
    }

    // Si l'API échoue ou ne trouve rien
    return null;
  }
};