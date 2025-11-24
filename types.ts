export type SupportType = 'LASERDISC' | 'DVD' | 'Blu-Ray' | 'à acheter';

export interface Movie {
  title: string;
  support: SupportType;
  // Optional ID if your sheet provides row index, otherwise we identify by title/support
  id?: string; 
}

export interface ApiResponse<T> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
}

export const SUPPORT_OPTIONS: SupportType[] = ['Blu-Ray', 'DVD', 'LASERDISC', 'à acheter'];