import type { Patient } from "@/lib/patients/types";

export const PATIENT_CREATED_EVENT = "patient:created";
export const PATIENT_UPDATED_EVENT = "patient:updated";

type PatientEventDetail = { patient: Patient };

function dispatchPatientEvent(name: string, patient: Patient) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<PatientEventDetail>(name, { detail: { patient } }));
}

export function emitPatientCreated(patient: Patient) {
  dispatchPatientEvent(PATIENT_CREATED_EVENT, patient);
}

export function emitPatientUpdated(patient: Patient) {
  dispatchPatientEvent(PATIENT_UPDATED_EVENT, patient);
}

export type { PatientEventDetail };
