import { useEffect, useState } from "react";
import { COMPANIES, type Company } from "@/lib/factory";

const KEY = "ar-company";
const EVENT = "ar-company-change";

/** 目前切換的公司（記在這台電腦上）。 */
export function useCompany(): [Company, (c: Company) => void] {
  const [company, setCompany] = useState<Company>(COMPANIES[0]);
  useEffect(() => {
    const read = () => {
      const v = window.localStorage.getItem(KEY);
      setCompany((COMPANIES as readonly string[]).includes(v ?? "") ? (v as Company) : COMPANIES[0]);
    };
    read();
    window.addEventListener(EVENT, read);
    return () => window.removeEventListener(EVENT, read);
  }, []);
  const set = (c: Company) => {
    window.localStorage.setItem(KEY, c);
    window.dispatchEvent(new Event(EVENT));
  };
  return [company, set];
}
