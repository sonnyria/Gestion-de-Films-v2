
import { Movie, ApiResponse, SupportType } from '../types';

const STORAGE_KEY = 'movieApp_scriptUrl';

export const getScriptUrl = (): string | null => {
  return localStorage.getItem(STORAGE_KEY);
};

export const setScriptUrl = (url: string) => {
  localStorage.setItem(STORAGE_KEY, url);
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

export const movieService = {
  async search(query: string): Promise<ApiResponse<Movie[]>> {
    const url = getScriptUrl();
    if (!url) return { status: 'error', message: 'API URL not configured' };

    if (url === 'demo') {
      const q = query.toLowerCase();
      const results = MOCK_DB.filter(m => m.title.toLowerCase().includes(q));
      return mockDelay({ status: 'success', data: results });
    }

    try {
      const fetchUrl = createUrl(url, { action: 'search', query });
      const res = await fetch(fetchUrl);
      return await res.json();
    } catch (e) {
      return { status: 'error', message: 'Network error' };
    }
  },

  async getAll(): Promise<ApiResponse<Movie[]>> {
    const url = getScriptUrl();
    if (!url) return { status: 'error', message: 'API URL not configured' };

    if (url === 'demo') {
      return mockDelay({ status: 'success', data: [...MOCK_DB] });
    }

    try {
      const fetchUrl = createUrl(url, { action: 'getAll' });
      const res = await fetch(fetchUrl);
      return await res.json();
    } catch (e) {
      return { status: 'error', message: 'Network error' };
    }
  },

  async add(title: string, support: SupportType): Promise<ApiResponse<null>> {
    const url = getScriptUrl();
    if (!url) return { status: 'error', message: 'API URL not configured' };

    if (url === 'demo') {
      MOCK_DB.push({ title, support });
      return mockDelay({ status: 'success', message: 'Added in demo mode' });
    }

    try {
      const fetchUrl = createUrl(url, { action: 'add', title, support });
      const res = await fetch(fetchUrl);
      return await res.json();
    } catch (e) {
      return { status: 'error', message: 'Network error' };
    }
  },

  async edit(oldTitle: string, newTitle: string, support: SupportType): Promise<ApiResponse<null>> {
    const url = getScriptUrl();
    if (!url) return { status: 'error', message: 'API URL not configured' };

    if (url === 'demo') {
      const idx = MOCK_DB.findIndex(m => m.title === oldTitle && m.support === support);
      if (idx !== -1) MOCK_DB[idx].title = newTitle;
      return mockDelay({ status: 'success', message: 'Updated in demo mode' });
    }

    try {
      const fetchUrl = createUrl(url, { action: 'edit', oldTitle, newTitle, support });
      const res = await fetch(fetchUrl);
      return await res.json();
    } catch (e) {
      return { status: 'error', message: 'Network error' };
    }
  },

  async delete(title: string, support: SupportType): Promise<ApiResponse<null>> {
    const url = getScriptUrl();
    if (!url) return { status: 'error', message: 'API URL not configured' };

    if (url === 'demo') {
      MOCK_DB = MOCK_DB.filter(m => !(m.title === title && m.support === support));
      return mockDelay({ status: 'success', message: 'Deleted in demo mode' });
    }

    try {
      const fetchUrl = createUrl(url, { action: 'delete', title, support });
      const res = await fetch(fetchUrl);
      return await res.json();
    } catch (e) {
      return { status: 'error', message: 'Network error' };
    }
  }
};
