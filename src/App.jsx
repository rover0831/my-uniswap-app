import React from "react";
import { ethers } from "ethers";
import Uniswap_fetching_Data from "./components/Ethereum";
import UniswapGetPool from "./components/Arbitrum";
import { useAppContext } from "./context/AppContext";
import "./App.css";

const App = () => {
  const { walletConnected, network, setNetwork, setWalletConnected } =
    useAppContext();

  const connectWallet = async () => {
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      await provider.send("eth_requestAccounts", []); // Request accounts if not connected
      setWalletConnected(true);
    } catch (error) {
      console.error("Error connecting wallet: ", error);
    }
  };

  return (
    <div className="container">
      {!walletConnected ? (
        <button onClick={connectWallet}>Connect Wallet</button>
      ) : (
        <div>
          {network != "homestead" ? (
            <Uniswap_fetching_Data />
          ) : (
            <UniswapGetPool />
          )}
        </div>
      )}
    </div>
  );
};

export default App;
