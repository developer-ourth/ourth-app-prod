import { create } from 'zustand';
import api from './api';

interface ThemeState {
  appBackgroundColor: string;
  headerBackgroundColor: string;
  bannerTagline: string;
  bannerSubtagline: string;
  bannerImageUrl: string;
  fetchSettings: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  appBackgroundColor: '#FAF8F3', // Default
  headerBackgroundColor: 'rgba(13,58,39,0.85)', // Default
  bannerTagline: 'Healing OURTH Tableware', // Default
  bannerSubtagline: '100% Organic, Natural & Compostable', // Default
  bannerImageUrl: '', // Default
  fetchSettings: async () => {
    try {
      const res = await api.get('/app-settings');
      if (res.data) {
        set({
          appBackgroundColor: res.data.app_background_color ?? '#FAF8F3',
          headerBackgroundColor: res.data.header_background_color ?? '#0d3a27',
          bannerTagline: res.data.banner_tagline ?? '',
          bannerSubtagline: res.data.banner_subtagline ?? '',
          bannerImageUrl: res.data.banner_image_url ?? '',
        });
      }
    } catch (error) {
      console.error('Failed to fetch app settings', error);
    }
  },
}));
