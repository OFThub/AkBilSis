import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { postTrip } from "../api/client";
import { FARES, findLine, travelMinutes } from "../data/lines";
import {
  ActiveTrip,
  CardType,
  CardUser,
  Settings,
  TripRecord,
} from "../types";
import { formatTL, round2 } from "../utils/format";

// v3: kart verisi kayıtlı kullanıcı listesine taşındı — etiket yalnızca ID sağlar
const STORAGE_KEY = "akbil-state-v3";
const LEGACY_KEYS = ["akbil-state-v2", "akbil-state-v1"];

/** Kutudan çıkar çıkmaz test edilebilsin diye örnek kullanıcılar */
function seedUsers(): CardUser[] {
  return [
    {
      id: "u-ahmet",
      name: "Ahmet Yılmaz",
      cardNo: "1042 7316",
      cardType: "tam",
      balance: 150,
    },
    {
      id: "u-zeynep",
      name: "Zeynep Kaya",
      cardNo: "2298 4471",
      cardType: "ogrenci",
      balance: 80,
    },
    {
      id: "u-mehmet",
      name: "Mehmet Demir",
      cardNo: "3355 9028",
      cardType: "tam",
      balance: 40,
    },
  ];
}

interface AppState {
  /** Kayıtlı kartlar — kart verisinin tek kaynağı */
  users: CardUser[];
  activeTrip: ActiveTrip | null;
  history: TripRecord[];
  /** Kullanıcının yıldızladığı hat id'leri — Kart ekranındaki favori bölmesi */
  favoriteLineIds: string[];
  settings: Settings;
}

type Result = { ok: boolean; error?: string };

export interface AlightResult extends Result {
  record?: TripRecord;
  sent?: boolean;
}

interface AppApi extends AppState {
  ready: boolean;
  pendingCount: number;
  addUser(
    name: string,
    cardNo: string,
    cardType: CardType,
    tagId?: string
  ): Result;
  removeUser(id: string): void;
  topUp(userId: string, amount: number): Result;
  /** Okunan etiket ID'sini bir kullanıcıya bağlar (NFC açıkken) */
  bindTag(userId: string, tagId: string): Result;
  findUserByTagId(tagId: string): CardUser | undefined;
  board(lineId: string, stopIndex: number): Result;
  /** Yolculuğu bitirir; ücret okunan/seçilen kullanıcının bakiyesinden düşülür */
  alight(stopIndex: number, userId: string): Promise<AlightResult>;
  retryPending(): Promise<number>;
  /** Hattı favorilere ekler ya da çıkarır */
  toggleFavorite(lineId: string): void;
  updateSettings(patch: Partial<Settings>): void;
  resetAll(): void;
}

function defaultState(): AppState {
  return {
    users: seedUsers(),
    activeTrip: null,
    history: [],
    favoriteLineIds: [],
    settings: {
      backendUrl: "http://localhost:4000",
      demoMode: false,
      demoHour: 8,
      // Expo Go'da native NFC yok — varsayılan kapalı ki liste modu hemen çalışsın
      nfcEnabled: false,
    },
  };
}

const AppContext = createContext<AppApi | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(defaultState);
  const [ready, setReady] = useState(false);
  const loadedRef = useRef(false);

  // Kalıcı durum: açılışta yükle (eski sürüm kayıtları da okunur)
  useEffect(() => {
    (async () => {
      try {
        let raw = await AsyncStorage.getItem(STORAGE_KEY);
        for (const key of LEGACY_KEYS) {
          if (raw) break;
          raw = await AsyncStorage.getItem(key);
        }
        if (raw) {
          const saved = JSON.parse(raw) as Partial<AppState>;
          const base = defaultState();
          setState({
            // Eski kayıtlarda kullanıcı listesi yok — örneklerle başlat
            users:
              Array.isArray(saved.users) && saved.users.length > 0
                ? saved.users
                : base.users,
            activeTrip: saved.activeTrip ?? null,
            history: Array.isArray(saved.history) ? saved.history : [],
            favoriteLineIds: Array.isArray(saved.favoriteLineIds)
              ? saved.favoriteLineIds
              : [],
            settings: { ...base.settings, ...(saved.settings ?? {}) },
          });
        }
      } catch {
        // Bozuk kayıt varsa varsayılanla devam et
      } finally {
        loadedRef.current = true;
        setReady(true);
      }
    })();
  }, []);

  // Her değişiklikte kaydet (yükleme bitmeden yazma)
  useEffect(() => {
    if (!loadedRef.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state]);

  const addUser = useCallback(
    (
      name: string,
      cardNo: string,
      cardType: CardType,
      tagId?: string
    ): Result => {
      const trimmedName = name.trim();
      const trimmedCard = cardNo.trim();
      if (!trimmedName) return { ok: false, error: "Kullanıcı adı boş olamaz." };
      if (!trimmedCard) return { ok: false, error: "Kart numarası boş olamaz." };
      if (state.users.some((u) => u.cardNo === trimmedCard)) {
        return { ok: false, error: "Bu kart numarası zaten kayıtlı." };
      }
      if (tagId && state.users.some((u) => u.tagId === tagId)) {
        return { ok: false, error: "Bu etiket zaten başka bir kullanıcıya bağlı." };
      }
      const user: CardUser = {
        id: `u-${Date.now()}-${Math.floor(Math.random() * 1e4)}`,
        name: trimmedName,
        cardNo: trimmedCard,
        cardType,
        balance: 0,
        ...(tagId ? { tagId } : {}),
      };
      setState((s) => ({ ...s, users: [...s.users, user] }));
      return { ok: true };
    },
    [state.users]
  );

  const removeUser = useCallback((id: string) => {
    setState((s) => ({ ...s, users: s.users.filter((u) => u.id !== id) }));
  }, []);

  const topUp = useCallback(
    (userId: string, amount: number): Result => {
      if (amount <= 0) {
        return { ok: false, error: "Tutar sıfırdan büyük olmalı." };
      }
      if (!state.users.some((u) => u.id === userId)) {
        return { ok: false, error: "Kayıtlı kullanıcı bulunamadı." };
      }
      setState((s) => ({
        ...s,
        users: s.users.map((u) =>
          u.id === userId ? { ...u, balance: round2(u.balance + amount) } : u
        ),
      }));
      return { ok: true };
    },
    [state.users]
  );

  const bindTag = useCallback(
    (userId: string, tagId: string): Result => {
      const owner = state.users.find(
        (u) => u.tagId === tagId && u.id !== userId
      );
      if (owner) {
        return {
          ok: false,
          error: `Bu etiket zaten ${owner.name} kullanıcısına bağlı.`,
        };
      }
      if (!state.users.some((u) => u.id === userId)) {
        return { ok: false, error: "Kayıtlı kullanıcı bulunamadı." };
      }
      setState((s) => ({
        ...s,
        users: s.users.map((u) => (u.id === userId ? { ...u, tagId } : u)),
      }));
      return { ok: true };
    },
    [state.users]
  );

  const findUserByTagId = useCallback(
    (tagId: string): CardUser | undefined =>
      state.users.find((u) => u.tagId === tagId),
    [state.users]
  );

  const board = useCallback(
    (lineId: string, stopIndex: number): Result => {
      if (state.activeTrip) {
        return {
          ok: false,
          error: "İnmeden tekrar binemezsiniz — önce aktif yolculuğu bitirin.",
        };
      }
      const line = findLine(lineId);
      if (!line) return { ok: false, error: "Hat bulunamadı." };
      if (stopIndex < 0 || stopIndex >= line.stops.length - 1) {
        return { ok: false, error: "Son duraktan biniş yapılamaz." };
      }

      // Ücret inişte, kartı belirlenen kullanıcının tipine göre düşülür
      const now = new Date();
      if (state.settings.demoMode) {
        now.setHours(state.settings.demoHour);
      }

      setState((s) => ({
        ...s,
        activeTrip: {
          lineId,
          boardingStopIndex: stopIndex,
          boardTime: now.toISOString(),
        },
      }));
      return { ok: true };
    },
    [state.activeTrip, state.settings]
  );

  const alight = useCallback(
    async (stopIndex: number, userId: string): Promise<AlightResult> => {
      const trip = state.activeTrip;
      if (!trip) return { ok: false, error: "Aktif yolculuk yok." };
      const line = findLine(trip.lineId);
      if (!line) return { ok: false, error: "Hat bulunamadı." };
      if (stopIndex <= trip.boardingStopIndex || stopIndex >= line.stops.length) {
        return { ok: false, error: "İniş durağı biniş durağından sonra olmalı." };
      }
      const user = state.users.find((u) => u.id === userId);
      if (!user) return { ok: false, error: "Kayıtlı kullanıcı bulunamadı." };

      const fare = FARES[user.cardType];
      if (user.balance < fare) {
        return {
          ok: false,
          error: `Bakiye yetersiz — ${user.name} kartında ${formatTL(
            user.balance
          )} var, ücret ${formatTL(fare)}. Kart ekranından bakiye yükleyin.`,
        };
      }

      // İniş saati = biniş + duraklar arası sürelerin toplamı
      const durationMin = travelMinutes(line, trip.boardingStopIndex, stopIndex);
      const boardDate = new Date(trip.boardTime);
      const alightDate = new Date(boardDate.getTime() + durationMin * 60000);
      const balanceAfter = round2(user.balance - fare);

      const record: TripRecord = {
        localId: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
        cardNo: user.cardNo,
        cardType: user.cardType,
        line: line.name,
        boardingStop: line.stops[trip.boardingStopIndex],
        alightingStop: line.stops[stopIndex],
        boardTime: trip.boardTime,
        alightTime: alightDate.toISOString(),
        durationMin,
        fare,
        balanceAfter,
        status: "pending",
      };

      // Önce yerelde bitir (iniş + bakiye düş), sonra göndermeyi dene
      setState((s) => ({
        ...s,
        activeTrip: null,
        history: [record, ...s.history],
        users: s.users.map((u) =>
          u.id === userId ? { ...u, balance: balanceAfter } : u
        ),
      }));

      const sent = await postTrip(state.settings.backendUrl, record);
      if (sent) {
        setState((s) => ({
          ...s,
          history: s.history.map((r) =>
            r.localId === record.localId ? { ...r, status: "sent" } : r
          ),
        }));
      }
      return { ok: true, record, sent };
    },
    [state.activeTrip, state.users, state.settings]
  );

  const retryPending = useCallback(async (): Promise<number> => {
    const pending = state.history.filter((r) => r.status === "pending");
    let sentCount = 0;
    for (const record of pending) {
      const sent = await postTrip(state.settings.backendUrl, record);
      if (sent) {
        sentCount++;
        setState((s) => ({
          ...s,
          history: s.history.map((r) =>
            r.localId === record.localId ? { ...r, status: "sent" } : r
          ),
        }));
      }
    }
    return sentCount;
  }, [state.history, state.settings]);

  const toggleFavorite = useCallback((lineId: string) => {
    setState((s) => ({
      ...s,
      favoriteLineIds: s.favoriteLineIds.includes(lineId)
        ? s.favoriteLineIds.filter((id) => id !== lineId)
        : [...s.favoriteLineIds, lineId],
    }));
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  }, []);

  const resetAll = useCallback(() => {
    setState((s) => {
      const fresh = defaultState();
      // Backend adresi, NFC modu ve favoriler kullanıcı emeği — sıfırlamada koru
      fresh.settings.backendUrl = s.settings.backendUrl;
      fresh.settings.nfcEnabled = s.settings.nfcEnabled;
      fresh.favoriteLineIds = s.favoriteLineIds;
      return fresh;
    });
  }, []);

  const api: AppApi = {
    ...state,
    ready,
    pendingCount: state.history.filter((r) => r.status === "pending").length,
    addUser,
    removeUser,
    topUp,
    bindTag,
    findUserByTagId,
    board,
    alight,
    retryPending,
    toggleFavorite,
    updateSettings,
    resetAll,
  };

  return <AppContext.Provider value={api}>{children}</AppContext.Provider>;
}

export function useApp(): AppApi {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp, AppProvider içinde kullanılmalı");
  return ctx;
}
