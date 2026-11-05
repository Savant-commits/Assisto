"use client";

import { createContext, useContext } from "react";

const PhoneVerificationRequiredContext = createContext(true);

export function PhoneVerificationRequiredProvider({
  required,
  children,
}: {
  required: boolean;
  children: React.ReactNode;
}) {
  return (
    <PhoneVerificationRequiredContext.Provider value={required}>
      {children}
    </PhoneVerificationRequiredContext.Provider>
  );
}

export function usePhoneVerificationRequired() {
  return useContext(PhoneVerificationRequiredContext);
}
