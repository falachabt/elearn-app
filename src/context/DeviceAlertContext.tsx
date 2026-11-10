import React, { createContext, useContext, useState, ReactNode } from 'react';

// Type of alert used by GardeAppareilActif
export type TypeAlerteAppareil = 'limite' | 'deconnecte' | null;

interface DeviceAlertContextValue {
  alert: TypeAlerteAppareil;
  setAlert: (a: TypeAlerteAppareil) => void;
}

const DeviceAlertContext = createContext<DeviceAlertContextValue>({
  alert: null,
  setAlert: () => {},
});

export const DeviceAlertProvider = ({ children }: { children: ReactNode }) => {
  const [alert, setAlert] = useState<TypeAlerteAppareil>(null);
  return (
    <DeviceAlertContext.Provider value={{ alert, setAlert }}>
      {children}
    </DeviceAlertContext.Provider>
  );
};

export const useDeviceAlert = () => useContext(DeviceAlertContext);
