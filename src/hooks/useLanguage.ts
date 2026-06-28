import { useContext } from "react";
import { LanguageContext } from "../contexts/language";

export function useLanguage() {
  return useContext(LanguageContext);
}
