import { createContext } from "react";
import {
  type Language,
  type TranslationParams,
  translate,
} from "../i18n/translations";

export interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, params?: TranslationParams) => string;
}

export const LanguageContext = createContext<LanguageContextValue>({
  language: "en",
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (key, params) => translate("en", key, params),
});
