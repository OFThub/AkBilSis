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
import { SIM_SPEED } from "../config/env";
import { findBus } from "../data/buses";
import { findLine } from "../data/lines";
import {
  ActiveTrip,
  CardType,
  CardUser,
  CompletedTrip,
  Settings,
  TripRecord,
  isCompleted,
} from "../types";

// v5: favoriler kişiye bağlandı, ücret alanı kaldırıldı, biniş anında kayıt açılıyor
const STORAGE_KEY = "akbil-state-v5";
const LEGACY_KEYS = [
  "akbil-state-v4",
  "akbil-state-v3",
  "akbil-state-v2",
  "akbil-state-v1",
];

/** Kutudan çıkar çıkmaz test edilebilsin diye örnek kullanıcılar */
function seedUsers(): CardUser[] {
  return [
    {
      id: "u-ahmet",
      name: "Ahmet Yılmaz",
      cardNo: "1042 7316",
      cardType: "tam",
    },
    {
      id: "u-zeynep",
      name: "Zeynep Kaya",
      cardNo: "2298 4471",
      cardType: "ogrenci",
    },
    {
      id: "u-mehmet",
      name: "Mehmet Demir",
      cardNo: "3355 9028",
      cardType: "tam",
    },
  ];
}

interface AppState {
  /** Kayıtlı kartlar — kart verisinin tek kaynağı */
  users: CardUser[];
  /** Devam eden yolculuklar — kullanıcı başına en çok bir tane */
  activeTrips: ActiveTrip[];
  history: TripRecord[];
  /** Kart başına yıldızlanan hatlar: userId → lineId[] — favoriler kişiye özeldir */
  favoritesByUser: Record<string, string[]>;
  settings: Settings;
}

type Result = { ok: boolean; error?: string };

export interface AlightResult extends Result {
  record?: CompletedTrip;
  sent?: boolean;
}

interface AppApi extends AppState {
  ready: boolean;
  pendingCount: number;
  addUser(name: string, cardNo: string, cardType: CardType): Result;
  removeUser(id: string): void;
  /** Kullanıcının devam eden yolculuğu — yoksa undefined */
  activeTripFor(userId: string): ActiveTrip | undefined;
  /**
   * Yolda olan bir araca bindirir; biniş durağı aracın anlık konumundan gelir.
   * Geçmişe hemen "otobüste" durumunda bir kayıt açılır.
   */
  board(userId: string, lineId: string, busId: string): Result;
  /**
   * Yolculuğu bitirir: binişte açılan kayıt tamamlanır ve sunucuya gönderilir.
   * İniş durağı seçilmez — aracın o anda en yakın olduğu duraktır.
   */
  alight(userId: string): Promise<AlightResult>;
  /** cardNo verilirse yalnızca o karta ait bekleyen kayıtlar gönderilir */
  retryPending(cardNo?: string): Promise<number>;
  /** Kartın favori hatlarını verir — kart okutulmadan favori görülmez/eklenmez */
  favoritesFor(userId: string): string[];
  /** Hattı o kartın favorilerine ekler ya da çıkarır */
  toggleFavorite(userId: string, lineId: string): void;
  updateSettings(patch: Partial<Settings>): void;
  resetAll(): void;
}

function defaultState(): AppState {
  return {
    users: seedUsers(),
    activeTrips: [],
    history: [],
    favoritesByUser: {},
    settings: {
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
          const savedSettings = saved.settings ?? base.settings;
          setState({
            // Eski kayıtlarda kullanıcı listesi yok — örneklerle başlat
            users:
              Array.isArray(saved.users) && saved.users.length > 0
                ? saved.users
                : base.users,
            // v3 ve öncesinde aktif yolculuk kişiye bağlı değildi — taşınamaz
            activeTrips: Array.isArray(saved.activeTrips)
              ? saved.activeTrips
              : [],
            history: Array.isArray(saved.history) ? saved.history : [],
            // v4 ve öncesinde favoriler ortaktı — hangi karta ait olduğu
            // bilinmediği için taşınmaz
            favoritesByUser:
              saved.favoritesByUser && !Array.isArray(saved.favoritesByUser)
                ? saved.favoritesByUser
                : {},
            // Alanlar tek tek alınır ki eski kayıttaki backendUrl/nfcEnabled sızmasın
            settings: {
              demoMode: savedSettings.demoMode ?? base.settings.demoMode,
              demoHour: savedSettings.demoHour ?? base.settings.demoHour,
            },
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
    (name: string, cardNo: string, cardType: CardType): Result => {
      const trimmedName = name.trim();
      const trimmedCard = cardNo.trim();
      if (!trimmedName) return { ok: false, error: "Kullanıcı adı boş olamaz." };
      if (!trimmedCard) return { ok: false, error: "Kart numarası boş olamaz." };
      if (state.users.some((u) => u.cardNo === trimmedCard)) {
        return { ok: false, error: "Bu kart numarası zaten kayıtlı." };
      }
      const user: CardUser = {
        id: `u-${Date.now()}-${Math.floor(Math.random() * 1e4)}`,
        name: trimmedName,
        cardNo: trimmedCard,
        cardType,
      };
      setState((s) => ({ ...s, users: [...s.users, user] }));
      return { ok: true };
    },
    [state.users]
  );

  const removeUser = useCallback((id: string) => {
    setState((s) => ({ ...s, users: s.users.filter((u) => u.id !== id) }));
  }, []);

  const activeTripFor = useCallback(
    (userId: string): ActiveTrip | undefined =>
      state.activeTrips.find((t) => t.userId === userId),
    [state.activeTrips]
  );

  const board = useCallback(
    (userId: string, lineId: string, busId: string): Result => {
      const user = state.users.find((u) => u.id === userId);
      if (!user) return { ok: false, error: "Kayıtlı kullanıcı bulunamadı." };

      // Aynı kişi inmeden ikinci kez binemez
      const ongoing = state.activeTrips.find((t) => t.userId === userId);
      if (ongoing) {
        const ongoingLine = findLine(ongoing.lineId);
        return {
          ok: false,
          error: `Zaten ${ongoingLine?.name ?? "bir hatta"} yolculuğundasınız (${
            ongoing.busPlate
          }). Yeni araca binmeden önce inmelisiniz.`,
        };
      }

      const line = findLine(lineId);
      if (!line) return { ok: false, error: "Hat bulunamadı." };

      const now = new Date();
      const bus = findBus(lineId, busId, now);
      if (!bus) {
        return {
          ok: false,
          error: "Seçilen araç artık seferde değil — listeyi yenileyin.",
        };
      }
      if (bus.layover) {
        return {
          ok: false,
          error: "Bu araç son durakta sefer bekliyor — yoldaki bir araç seçin.",
        };
      }

      // Kayda yazılan saat demo modunda kaydırılabilir; süre ölçümü için
      // gerçek an ayrıca saklanır
      const boardDate = new Date(now);
      if (state.settings.demoMode) {
        boardDate.setHours(state.settings.demoHour);
      }

      // Kayıt binişte açılır: yolcunun araçta olduğu buradan bilinir, geçmişte
      // hemen görünür ve inişte aynı kayıt tamamlanır
      const recordId = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
      const record: TripRecord = {
        localId: recordId,
        cardNo: user.cardNo,
        cardType: user.cardType,
        line: line.name,
        boardingStop: line.stops[bus.nearestStopIndex],
        boardTime: boardDate.toISOString(),
        alightingStop: null,
        alightTime: null,
        durationMin: null,
        busPlate: bus.plate,
        status: "onboard",
      };

      const trip: ActiveTrip = {
        userId,
        recordId,
        lineId,
        busId,
        busPlate: bus.plate,
        boardingStopIndex: bus.nearestStopIndex,
        boardTime: boardDate.toISOString(),
        boardRealTime: now.toISOString(),
      };
      setState((s) => ({
        ...s,
        activeTrips: [...s.activeTrips, trip],
        history: [record, ...s.history],
      }));
      return { ok: true };
    },
    [state.users, state.activeTrips, state.settings]
  );

  const alight = useCallback(
    async (userId: string): Promise<AlightResult> => {
      const trip = state.activeTrips.find((t) => t.userId === userId);
      if (!trip) return { ok: false, error: "Aktif yolculuk yok." };
      const line = findLine(trip.lineId);
      if (!line) return { ok: false, error: "Hat bulunamadı." };
      const user = state.users.find((u) => u.id === userId);
      if (!user) return { ok: false, error: "Kayıtlı kullanıcı bulunamadı." };

      // İniş durağı seçilmez: aracın gerçek zamanlı en yakın durağıdır
      const now = new Date();
      const bus = findBus(trip.lineId, trip.busId, now);
      if (!bus) {
        return {
          ok: false,
          error: "Aracın konumu okunamadı — birazdan tekrar deneyin.",
        };
      }

      // Süre = araçta geçen gerçek zaman × simülasyon hızı (en az 1 dk)
      const elapsedRealMin =
        (now.getTime() - new Date(trip.boardRealTime).getTime()) / 60000;
      const durationMin = Math.max(1, Math.round(elapsedRealMin * SIM_SPEED));
      const boardDate = new Date(trip.boardTime);
      const alightDate = new Date(boardDate.getTime() + durationMin * 60000);

      // Binişte açılan kayıt tamamlanır — yeni satır eklenmez
      const existing = state.history.find((r) => r.localId === trip.recordId);
      const record: CompletedTrip = {
        localId: trip.recordId,
        cardNo: user.cardNo,
        cardType: user.cardType,
        line: line.name,
        boardingStop:
          existing?.boardingStop ?? line.stops[trip.boardingStopIndex],
        boardTime: trip.boardTime,
        alightingStop: line.stops[bus.nearestStopIndex],
        alightTime: alightDate.toISOString(),
        durationMin,
        busPlate: trip.busPlate,
        status: "pending",
      };

      // Önce yerelde bitir (iniş), sonra göndermeyi dene
      setState((s) => ({
        ...s,
        activeTrips: s.activeTrips.filter((t) => t.userId !== userId),
        // Binişteki kayıt beklenen yerde yoksa (bozuk/elden düşme durumu)
        // tamamlanan yolculuk sessizce kaybolmasın diye başa eklenir
        history: s.history.some((r) => r.localId === trip.recordId)
          ? s.history.map((r) => (r.localId === trip.recordId ? record : r))
          : [record, ...s.history],
      }));

      const sent = await postTrip(record);
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
    [state.activeTrips, state.users, state.history]
  );

  const retryPending = useCallback(async (cardNo?: string): Promise<number> => {
    // Araçtaki (onboard) kayıtlar henüz tamamlanmadığı için gönderilmez
    const pending = state.history.filter(
      (r): r is CompletedTrip =>
        r.status === "pending" && isCompleted(r) && (!cardNo || r.cardNo === cardNo)
    );
    let sentCount = 0;
    for (const record of pending) {
      const sent = await postTrip(record);
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
  }, [state.history]);

  const favoritesFor = useCallback(
    (userId: string): string[] => state.favoritesByUser[userId] ?? [],
    [state.favoritesByUser]
  );

  const toggleFavorite = useCallback((userId: string, lineId: string) => {
    setState((s) => {
      const current = s.favoritesByUser[userId] ?? [];
      return {
        ...s,
        favoritesByUser: {
          ...s.favoritesByUser,
          [userId]: current.includes(lineId)
            ? current.filter((id) => id !== lineId)
            : [...current, lineId],
        },
      };
    });
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  }, []);

  const resetAll = useCallback(() => {
    setState((s) => {
      const fresh = defaultState();
      // Favoriler kullanıcı emeği — sıfırlamada korunur
      // (backend adresi zaten .env'de, sıfırlamadan etkilenmez)
      fresh.favoritesByUser = s.favoritesByUser;
      return fresh;
    });
  }, []);

  const api: AppApi = {
    ...state,
    ready,
    pendingCount: state.history.filter((r) => r.status === "pending").length,
    addUser,
    removeUser,
    activeTripFor,
    board,
    alight,
    retryPending,
    favoritesFor,
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
