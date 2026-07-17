import { create } from 'zustand';
import type { CalendarAuthStatus, ResolvedSettings, SettingsStoreSlice } from '../types';

const initialState = {
  url: '',
  email: '',
  token: '',
  confluenceSpace: '',
  confluenceParentId: '',
  calendarId: '',
  calendarClientId: '',
  calendarClientSecret: '',
  calendarAccessToken: '',
  calendarRefreshToken: '',
  calendarAuthStatus: 'disconnected' as CalendarAuthStatus,
  calendarErrorMessage: '',
  apiMode: false,
  newMemberName: '',
  registeredMembers: [] as string[],
};

export const useSettingsStore = create<SettingsStoreSlice>((set, get) => ({
  ...initialState,

  setUrl: (url) => set({ url }),
  setEmail: (email) => set({ email }),
  setToken: (token) => set({ token }),
  setConfluenceSpace: (confluenceSpace) => set({ confluenceSpace }),
  setConfluenceParentId: (confluenceParentId) => set({ confluenceParentId }),
  setCalendarId: (calendarId) => set({ calendarId }),
  setCalendarClientId: (calendarClientId) => set({ calendarClientId }),
  setCalendarClientSecret: (calendarClientSecret) => set({ calendarClientSecret }),
  setCalendarAccessToken: (calendarAccessToken) => set({ calendarAccessToken }),
  setCalendarRefreshToken: (calendarRefreshToken) => set({ calendarRefreshToken }),
  setCalendarAuthStatus: (calendarAuthStatus) => set({ calendarAuthStatus }),
  setCalendarErrorMessage: (calendarErrorMessage) => set({ calendarErrorMessage }),
  setApiMode: (apiMode) => set({ apiMode }),
  setNewMemberName: (newMemberName) => set({ newMemberName }),
  setRegisteredMembers: (registeredMembers) => set({ registeredMembers }),

  applyResolvedSettings: (resolved: ResolvedSettings) => set({
    url: resolved.url,
    email: resolved.email,
    token: resolved.token,
    confluenceSpace: resolved.confluenceSpace,
    confluenceParentId: resolved.confluenceParentId,
    calendarId: resolved.calendarId,
    calendarClientId: resolved.calendarClientId,
    calendarClientSecret: resolved.calendarClientSecret,
    calendarAccessToken: resolved.calendarAccessToken,
    calendarRefreshToken: resolved.calendarRefreshToken,
    apiMode: resolved.apiMode,
    registeredMembers: resolved.registeredMembers,
    calendarAuthStatus: resolved.hasCalendarCredentials ? 'connected' : get().calendarAuthStatus,
  }),

  getCredentials: () => {
    const state = get();
    return {
      url: state.url,
      email: state.email,
      token: state.token,
    };
  },

  getCalendarCredentials: () => {
    const state = get();
    return {
      calendarId: state.calendarId,
      clientId: state.calendarClientId,
      clientSecret: state.calendarClientSecret,
      accessToken: state.calendarAccessToken,
      refreshToken: state.calendarRefreshToken,
    };
  },

  hasJiraCredentials: () => {
    const { url, email, token } = get();
    return !!(url && email && token);
  },
}));
