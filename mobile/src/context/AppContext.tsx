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
  CardInfo,
  CardType,
  Settings,
  TripRecord,
} from "../types";
import { randomCardNo } from "../utils/format";

const STORAGE_KEY = "akbil-state-v1";

interface AppState {
  card: CardInfo;
  activeTrip: ActiveTrip | null;
  history: TripRecord[];
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
  setCardNo(cardNo: string): void;
  setCardType(cardType: CardType): Result;
  topUp(amount: number): void;
  board(lineId: string, stopIndex: number): Result;
  alight(stopIndex: number): Promise<AlightResult>;
  retryPending(): Promise<number>;
  updateSettings(patch: Partial<Settings>): void;
  resetAll(): void;
}

function defaultState(): AppState {
  return {
    card: { cardNo: randomCardNo(), cardType: "tam", balance: 100 },
    activeTrip: null,
    history: [],
    settings: {
      backendUrl: "http://localhost:4000",
      demoMode: false,
      demoHour: 8,
    },
  };
}

const AppContext = createContext<AppApi | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(defaultState);
  const [ready, setReady] = useState(false);
  const loadedRef = useRef(false);

  // Kalıcı durum: açılışta yükle
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as AppState;
          setState({ ...defaultState(), ...saved });
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

  const setCardNo = useCallback((cardNo: string) => {
    setState((s) => ({ ...s, card: { ...s.card, cardNo } }));
  }, []);

  const setCardType = useCallback(
    (cardType: CardType): Result => {
      if (state.activeTrip) {
        return {
          ok: false,
          error: "Yolculuk sırasında kart tipi değiştirilemez.",
        };
      }
      setState((s) => ({ ...s, card: { ...s.card, cardType } }));
      return { ok: true };
    },
    [state.activeTrip]
  );

  const topUp = useCallback((amount: number) => {
    setState((s) => ({
      ...s,
      card: { ...s.card, balance: Math.round((s.card.balance + amount) * 100) / 100 },
    }));
  }, []);

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
      const fare = FARES[state.card.cardType];
      if (state.card.balance < fare) {
        return {
          ok: false,
          error: "Bakiye yetersiz. Kartım ekranından bakiye yükleyin.",
        };
      }

      // Biniş saati = şimdiki zaman (demo modunda saat elle seçilir)
      const now = new Date();
      if (state.settings.demoMode) {
        now.setHours(state.settings.demoHour);
      }

      setState((s) => ({
        ...s,
        card: {
          ...s.card,
          balance: Math.round((s.card.balance - fare) * 100) / 100,
        },
        activeTrip: {
          lineId,
          boardingStopIndex: stopIndex,
          boardTime: now.toISOString(),
          fare,
        },
      }));
      return { ok: true };
    },
    [state.activeTrip, state.card, state.settings]
  );

  const alight = useCallback(
    async (stopIndex: number): Promise<AlightResult> => {
      const trip = state.activeTrip;
      if (!trip) return { ok: false, error: "Aktif yolculuk yok." };
      const line = findLine(trip.lineId);
      if (!line) return { ok: false, error: "Hat bulunamadı." };
      if (stopIndex <= trip.boardingStopIndex || stopIndex >= line.stops.length) {
        return {
          ok: false,
          error: "İniş durağı biniş durağından sonra olmalı.",
        };
      }

      // İniş saati = biniş + duraklar arası sürelerin toplamı
      const durationMin = travelMinutes(line, trip.boardingStopIndex, stopIndex);
      const boardDate = new Date(trip.boardTime);
      const alightDate = new Date(boardDate.getTime() + durationMin * 60000);

      const record: TripRecord = {
        localId: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
        cardNo: state.card.cardNo,
        cardType: state.card.cardType,
        line: line.name,
        boardingStop: line.stops[trip.boardingStopIndex],
        alightingStop: line.stops[stopIndex],
        boardTime: trip.boardTime,
        alightTime: alightDate.toISOString(),
        durationMin,
        fare: trip.fare,
        status: "pending",
      };

      // Önce yerelde bitir (iniş), sonra göndermeyi dene
      setState((s) => ({
        ...s,
        activeTrip: null,
        history: [record, ...s.history],
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
    [state.activeTrip, state.card, state.settings]
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

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  }, []);

  const resetAll = useCallback(() => {
    setState((s) => {
      const fresh = defaultState();
      // Backend adresi kullanıcı emeği — sıfırlamada koru
      fresh.settings.backendUrl = s.settings.backendUrl;
      return fresh;
    });
  }, []);

  const api: AppApi = {
    ...state,
    ready,
    pendingCount: state.history.filter((r) => r.status === "pending").length,
    setCardNo,
    setCardType,
    topUp,
    board,
    alight,
    retryPending,
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
