"use client";

import { createContext, type ReactNode } from "react";

type Option = { id: string; label: string };

type ContextValue = {
  patients: Option[];
  doctors: Option[];
};

export const AppointmentsDataContext = createContext<ContextValue | null>(null);

type ProviderProps = {
  patients: Option[];
  doctors: Option[];
  children: ReactNode;
};

export function AppointmentsDataProvider({ patients, doctors, children }: ProviderProps) {
  return (
    <AppointmentsDataContext.Provider value={{ patients, doctors }}>
      {children}
    </AppointmentsDataContext.Provider>
  );
}
