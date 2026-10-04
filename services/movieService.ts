
import { Movie, ApiResponse, SupportType } from '../types';

const STORAGE_KEY = 'movieApp_scriptUrl';

export const getScriptUrl = (): string | null => {
  return localStorage.getItem(STORAGE_KEY);
};

export const setScriptUrl = (url: string) => {
  localStorage.setItem(STORAGE_KEY, url);
  collectionCache = null;
};

// Mock data for demo mode
let MOCK_DB: Movie[] = [
  { title: "Titanic", support: "LASERDISC" },
  { title: "Avatar", support: "Blu-Ray" },
  { title: "Dune: Part Two", support: "Blu-Ray" },
  { title: "Inception", support: "DVD" },
  { title: "The Matrix", support: "Blu-Ray" },
  { title: "Interstellar", support: "à acheter" },
  { title: "Blade Runner 2049", support: "Blu-Ray" },
  { title: "Pulp Fiction", support: "DVD" },
];

async function mockDelay<T>(data: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), 800));
}

const createUrl = (baseUrl: string, params: Record<string, string>) => {
  const url = new URL(baseUrl);
  Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
  url.searchParams.append('_', Date.now().toString()); // Anti-cache
  return url.toString();
};

// Cache only in memory: reloading the app always reloads the source collection.
const CACHE_TTL_MS = 5 * 60 * 1000;
type CollectionCache = {
  url: string;
  expiresAt: number;
  data?: Movie[];
  pending?: Promise<ApiResponse<Movie[]>>;
};
let collectionCache: CollectionCache | null = null;

const normalizeTitle = (value: string) => value.toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

export const movieService = {
  async search(query: string): Promise<ApiResponse<Movie[]>> {
    const response = await movieService.getAll();
    if (response.status !== 'success' || !response.data) return response;
    const normalizedQuery = normalizeTitle(query);
    return {
      status: 'success',
      data: response.data.filter(movie => normalizeTitle(movie.title).includes(normalizedQuery)),
    };
  },

  async getAll(forceRefresh = false): Promise<ApiResponse<Movie[]>> {
    const url = getScriptUrl();
    if (!url) return { status: 'error', message: 'API URL not configured' };

    if (!forceRefresh && collectionCache?.url === url) {
      if (collectionCache.pending) return collectionCache.pending;
      if (collectionCache.data && Date.now() < collectionCache.expiresAt) {
        return { status: 'success', data: collectionCache.data };
      }
    }

    const cache: CollectionCache = { url, expiresAt: 0 };
    collectionCache = cache;
    cache.pending = (async (): Promise<ApiResponse<Movie[]>> => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        let response: ApiResponse<Movie[]>;
        if (url === 'demo') {
          response = { status: 'success', data: MOCK_DB.map(movie => ({ ...movie })) };
        } else {
          const res = await fetch(createUrl(url, { action: 'getAll' }), { signal: controller.signal });
          if (!res.ok) throw new Error('Network error');
          response = await res.json();
        }
        if (response.status === 'success' && Array.isArray(response.data)) {
          cache.data = response.data;
          cache.expiresAt = Date.now() + CACHE_TTL_MS;
          return response;
        }
        return { status: 'error', message: response.message || 'Invalid collection response' };
      } catch {
        return { status: 'error', message: 'Impossible de charger la collection. Vérifiez la connexion et réessayez.' };
      } finally {
        clearTimeout(timeout);
        cache.pending = undefined;
      }
    })();
    const response = await cache.pending;
    cache.pending = undefined;
    return response;
  },

  async add(title: string, support: SupportType): Promise<ApiResponse<null>> {
    const url = getScriptUrl();
    if (!url) return { status: 'error', message: 'API URL not configured' };

    if (url === 'demo') {
      collectionCache = null;
      MOCK_DB.push({ title, support });
      return mockDelay({ status: 'success', message: 'Added in demo mode' });
    }

    try {
      const fetchUrl = createUrl(url, { action: 'add', title, support });
      const res = await fetch(fetchUrl);
      const response = await res.json();
      if (response.status === 'success') collectionCache = null;
      return response;
    } catch (e) {
      return { status: 'error', message: 'Network error' };
    }
  },

  async edit(oldTitle: string, newTitle: string, support: SupportType): Promise<ApiResponse<null>> {
    const url = getScriptUrl();
    if (!url) return { status: 'error', message: 'API URL not configured' };

    if (url === 'demo') {
      collectionCache = null;
      const idx = MOCK_DB.findIndex(m => m.title === oldTitle && m.support === support);
      if (idx !== -1) MOCK_DB[idx].title = newTitle;
      return mockDelay({ status: 'success', message: 'Updated in demo mode' });
    }

    try {
      const fetchUrl = createUrl(url, { action: 'edit', oldTitle, newTitle, support });
      const res = await fetch(fetchUrl);
      const response = await res.json();
      if (response.status === 'success') collectionCache = null;
      return response;
    } catch (e) {
      return { status: 'error', message: 'Network error' };
    }
  },

  async delete(title: string, support: SupportType): Promise<ApiResponse<null>> {
    const url = getScriptUrl();
    if (!url) return { status: 'error', message: 'API URL not configured' };

    if (url === 'demo') {
      collectionCache = null;
      MOCK_DB = MOCK_DB.filter(m => !(m.title === title && m.support === support));
      return mockDelay({ status: 'success', message: 'Deleted in demo mode' });
    }

    try {
      const fetchUrl = createUrl(url, { action: 'delete', title, support });
      const res = await fetch(fetchUrl);
      const response = await res.json();
      if (response.status === 'success') collectionCache = null;
      return response;
    } catch (e) {
      return { status: 'error', message: 'Network error' };
    }
  }
};
