/**
 * Oturum ve yerel ayarlar.
 *
 * İki tür durum vardır ve bilinçli olarak ayrı tutulur:
 *  - **Oturum**: token'lar ve yolcu bilgisi. Kaynağı sunucudur; token'lar
 *    AsyncStorage'da saklanır ki uygulama her açılışta giriş sormasın.
 *  - **Ayarlar**: tema ve dil. Yalnızca telefonda yaşar, sunucuya hiç gitmez.
 *
 * Hat, durak, otobüs ve yolculuk verisi burada tutulmaz — ekranlar bunları
 * doğrudan `api`'den okur, böylece tek doğruluk kaynağı backend olur.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ApiError,
  Tokens,
  api,
  setSessionExpiredHandler,
  setTokens,
} from "../api/client";
import { Passenger, Settings } from "../types";

/** v7: liste tabanlı kimlik kalktı, oturum sunucudan geliyor */
const SESSION_KEY = "akbil-session-v7";
const SETTINGS_KEY = "akbil-settings-v7";
/** Eski sürümlerin kart/yolculuk kayıtları artık geçersiz — açılışta temizlenir */
const LEGACY_KEYS = [
  "akbil-state-v6",
  "akbil-state-v5",
  "akbil-state-v4",
  "akbil-state-v3",
  "akbil-state-v2",
  "akbil-state-v1",
];

interface Result {
  ok: boolean;
  error?: string;
}

interface AppApi {
  /** Açılıştaki durum okuması bitti mi */
  ready: boolean;
  passenger: Passenger | null;
  settings: Settings;
  login(email: string, password: string): Promise<Result>;
  register(fullName: string, email: string, password: string): Promise<Result>;
  logout(): Promise<void>;
  updateSettings(patch: Partial<Settings>): void;
}

const defaultSettings: Settings = { theme: "light", language: "tr" };

const AppContext = createContext<AppApi | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [passenger, setPassenger] = useState<Passenger | null>(null);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const settingsLoaded = useRef(false);

  const clearSession = useCallback(async () => {
    setTokens(null);
    setPassenger(null);
    await AsyncStorage.removeItem(SESSION_KEY);
  }, []);

  // Token yenilemesi de başarısız olduysa istemci oturumu düşürür
  useEffect(() => {
    setSessionExpiredHandler(() => {
      clearSession();
    });
  }, [clearSession]);

  // Açılış: ayarları ve varsa oturumu yükle
  useEffect(() => {
    (async () => {
      try {
        const [rawSettings, rawSession] = await Promise.all([
          AsyncStorage.getItem(SETTINGS_KEY),
          AsyncStorage.getItem(SESSION_KEY),
        ]);

        if (rawSettings) {
          const saved = JSON.parse(rawSettings) as Partial<Settings>;
          setSettings({
            theme: saved.theme === "dark" ? "dark" : "light",
            language: saved.language === "en" ? "en" : "tr",
          });
        }

        if (rawSession) {
          const saved = JSON.parse(rawSession) as Tokens;
          setTokens(saved);
          // Token hâlâ geçerli mi — değilse oturum sessizce düşer
          try {
            setPassenger(await api.me());
          } catch {
            await clearSession();
          }
        }

        // Eski sürümlerin yerel kart/yolculuk kayıtları artık kullanılmıyor
        await AsyncStorage.multiRemove(LEGACY_KEYS).catch(() => {});
      } catch {
        // Bozuk kayıt varsa varsayılanla devam et
      } finally {
        settingsLoaded.current = true;
        setReady(true);
      }
    })();
  }, [clearSession]);

  // Ayar değişiklikleri kalıcı olsun (ilk yükleme bitmeden yazma)
  useEffect(() => {
    if (!settingsLoaded.current) return;
    AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)).catch(() => {});
  }, [settings]);

  const startSession = useCallback(async (tokens: Tokens) => {
    setTokens(tokens);
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(tokens));
    setPassenger(await api.me());
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<Result> => {
      try {
        await startSession(await api.login(email.trim(), password));
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof ApiError ? err.message : "Giriş yapılamadı.",
        };
      }
    },
    [startSession]
  );

  const register = useCallback(
    async (fullName: string, email: string, password: string): Promise<Result> => {
      try {
        await api.register(fullName.trim(), email.trim(), password);
        // Kayıt sonrası doğrudan içeri al — kullanıcı bilgilerini bir daha yazmasın
        await startSession(await api.login(email.trim(), password));
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof ApiError ? err.message : "Kayıt yapılamadı.",
        };
      }
    },
    [startSession]
  );

  const logout = useCallback(async () => {
    await clearSession();
  }, [clearSession]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => ({ ...current, ...patch }));
  }, []);

  const value: AppApi = {
    ready,
    passenger,
    settings,
    login,
    register,
    logout,
    updateSettings,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppApi {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp, AppProvider içinde kullanılmalı");
  return ctx;
}
