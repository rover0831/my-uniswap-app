import React, { useState, useContext, createContext } from "react";

const AppContext = createContext(undefined);

const AppProvider = ({ children }) => {
  const [walletConnected, setWalletConnected] = useState(false);
  const [network, setNetwork] = useState("homestead");

  return (
    <AppContext.Provider
      value={{
        walletConnected,
        network,
        setNetwork,
        setWalletConnected,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

const useAppContext = () => {
  const context = useContext(AppContext);
  if (context == undefined) {
    throw new Error("useTimeContext must be used within a TimeProvider");
  }
  return context;
};

export { AppProvider, useAppContext };
