/**
 * Çeviri sözlüğü ve dil bağlamı.
 *
 * Sözlük anahtarları `tr` üzerinden tiplenir: `en` bir anahtarı unutursa
 * derleme hatası verir, çeviri sessizce eksik kalmaz.
 */

import React, { createContext, useContext } from "react";
import { Language } from "../types";

const tr = {
  // Sekmeler
  tabTrip: "Yolculuk",
  tabCard: "Kart",
  tabHistory: "Geçmiş",
  tabSettings: "Ayarlar",

  // Giriş / kayıt
  appName: "Arnavutköy Akbil",
  loginTitle: "Giriş Yap",
  registerTitle: "Hesap Oluştur",
  loginSubtitle: "Kartınıza ulaşmak için giriş yapın",
  registerSubtitle: "Yeni bir akbil hesabı oluşturun",
  fullName: "Ad Soyad",
  email: "E-posta",
  password: "Şifre",
  passwordHint: "En az 8 karakter",
  loginAction: "Giriş Yap",
  registerAction: "Hesap Oluştur",
  toRegister: "Hesabınız yok mu? Kayıt olun",
  toLogin: "Zaten hesabınız var mı? Giriş yapın",
  pleaseWait: "Lütfen bekleyin…",
  cardTypeLabel: "Kart Tipi",
  cardTypeNormalHint: "Standart yolcu",
  cardTypeStudentHint: "Belge ile doğrulanır",
  cardTypeSeniorHint: "65 yaş ve üzeri",
  cardTypeNote:
    "Öğrenci kartı için belgenizi belediyeye ibraz etmeniz gerekir; doğrulanmazsa kartınız tam tarifeye çevrilir.",

  // Yolculuk
  tripTitle: "Yolculuk",
  selectLine: "Hat seçin",
  busesOnRoute: "Yoldaki otobüsler",
  lineDiagram: "hat şeması",
  toggleDirection: "Yön değiştir",
  directionForward: "Gidiş",
  directionBackward: "Dönüş",
  onboard: "Araçtasınız",
  boardAction: "Bin",
  alightAction: "Otobüsten İn",
  waitingForStop: "Durak bekleniyor…",
  layoverLabel: "Sefer bekliyor",
  atStopSuffix: "durağında",
  passengersAboard: "yolcu",
  emptyBus: "Boş",
  boardingStop: "Bindiğiniz durak",
  tripHint:
    "Yalnızca durakta bekleyen otobüse binebilirsiniz; biniş durağınız o duraktır. Durağı sunucu belirler.",
  alightHint:
    "İnmeden başka bir araca binemezsiniz. İnmezseniz otobüs son durağa varınca otomatik indirilirsiniz.",
  noBuses: "Bu hatta şu an sefer yok.",

  // Kart
  cardTitle: "Kart",
  cardSubtitle: "Kartım ve favori hatlarım",
  cardTrips: "Yolculuk",
  allLines: "Tüm hatlar",
  favoriteLines: "Favori hatlar",
  noFavorites: "Henüz favori hat yok — yukarıdaki listeden yıldıza dokunun.",
  stopCount: "durak",
  peakHours: "En yoğun",
  cardActive: "Aktif",
  cardInactive: "Pasif",
  favoriteHint: "Yıldıza dokunduğunuz hatlar favorilerinize eklenir.",

  // Geçmiş
  historyTitle: "Geçmiş",
  historySubtitle: "Yolculuklarım",
  historyEmpty: "Henüz yolculuk yok",
  historyEmptyHint:
    "Yolculuk ekranından bir otobüse binip indiğinizde kayıtlarınız burada listelenir.",
  statusOpen: "Otobüste",
  statusCompleted: "Tamamlandı",
  statusAbandoned: "Yarıda kaldı",
  pullToRefresh: "Yenilemek için aşağı çekin",
  minutesShort: "dk",

  // Ayarlar
  settingsTitle: "Ayarlar",
  settingsSubtitle: "Görünüm ve dil",
  appearance: "Görünüm",
  themeLight: "Açık",
  themeDark: "Koyu",
  language: "Dil",
  account: "Hesap",
  logout: "Çıkış Yap",
  settingsNote:
    "Bu ekrandaki seçimler yalnızca telefonunuzda saklanır, sunucuya gönderilmez.",

  // Kart tipleri ve ortak
  cardTypeNormal: "Tam",
  cardTypeStudent: "Öğrenci",
  cardTypeSenior: "65+",
  loading: "Yükleniyor…",
  retry: "Tekrar Dene",
  municipality: "Arnavutköy Belediyesi",
};

export type TranslationKey = keyof typeof tr;

const en: Record<TranslationKey, string> = {
  tabTrip: "Trip",
  tabCard: "Card",
  tabHistory: "History",
  tabSettings: "Settings",

  appName: "Arnavutköy Transit Card",
  loginTitle: "Sign In",
  registerTitle: "Create Account",
  loginSubtitle: "Sign in to access your card",
  registerSubtitle: "Create a new transit card account",
  fullName: "Full Name",
  email: "Email",
  password: "Password",
  passwordHint: "At least 8 characters",
  loginAction: "Sign In",
  registerAction: "Create Account",
  toRegister: "No account? Sign up",
  toLogin: "Already have an account? Sign in",
  pleaseWait: "Please wait…",
  cardTypeLabel: "Card Type",
  cardTypeNormalHint: "Standard fare",
  cardTypeStudentHint: "Verified by document",
  cardTypeSeniorHint: "Age 65 and over",
  cardTypeNote:
    "Student cards require proof of enrolment at the municipality; without it the card reverts to the standard fare.",

  tripTitle: "Trip",
  selectLine: "Select a line",
  busesOnRoute: "Buses on route",
  lineDiagram: "route map",
  toggleDirection: "Switch direction",
  directionForward: "Outbound",
  directionBackward: "Inbound",
  onboard: "You are on board",
  boardAction: "Board",
  alightAction: "Get Off",
  waitingForStop: "Waiting for a stop…",
  layoverLabel: "On layover",
  atStopSuffix: "stop",
  passengersAboard: "passengers",
  emptyBus: "Empty",
  boardingStop: "Your boarding stop",
  tripHint:
    "You can only board a bus waiting at a stop; that stop becomes your boarding stop. The server decides it.",
  alightHint:
    "You cannot board another bus before getting off. If you do not get off, you are alighted automatically at the terminus.",
  noBuses: "No buses running on this line right now.",

  cardTitle: "Card",
  cardSubtitle: "My card and favourite lines",
  cardTrips: "Trips",
  allLines: "All lines",
  favoriteLines: "Favourite lines",
  noFavorites: "No favourite lines yet — tap a star in the list above.",
  stopCount: "stops",
  peakHours: "Busiest",
  cardActive: "Active",
  cardInactive: "Blocked",
  favoriteHint: "Lines you star are added to your favourites.",

  historyTitle: "History",
  historySubtitle: "My trips",
  historyEmpty: "No trips yet",
  historyEmptyHint:
    "Once you board and get off a bus from the Trip tab, your records appear here.",
  statusOpen: "On board",
  statusCompleted: "Completed",
  statusAbandoned: "Incomplete",
  pullToRefresh: "Pull down to refresh",
  minutesShort: "min",

  settingsTitle: "Settings",
  settingsSubtitle: "Appearance and language",
  appearance: "Appearance",
  themeLight: "Light",
  themeDark: "Dark",
  language: "Language",
  account: "Account",
  logout: "Sign Out",
  settingsNote:
    "Choices on this screen are stored only on your phone and never sent to the server.",

  cardTypeNormal: "Standard",
  cardTypeStudent: "Student",
  cardTypeSenior: "65+",
  loading: "Loading…",
  retry: "Try Again",
  municipality: "Arnavutköy Municipality",
};

const DICTIONARIES: Record<Language, Record<TranslationKey, string>> = { tr, en };

export type Translate = (key: TranslationKey) => string;

const LanguageContext = createContext<Translate>((key) => tr[key]);

export function LanguageProvider({
  language,
  children,
}: {
  language: Language;
  children: React.ReactNode;
}) {
  const dictionary = DICTIONARIES[language] ?? tr;
  const translate: Translate = (key) => dictionary[key] ?? tr[key];
  return (
    <LanguageContext.Provider value={translate}>{children}</LanguageContext.Provider>
  );
}

export function useT(): Translate {
  return useContext(LanguageContext);
}
