import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { Token } from "@uniswap/sdk-core";
import { Pool, nearestUsableTick, Position } from "@uniswap/v3-sdk";
import { abi as ERC20_ABI } from "@openzeppelin/contracts/build/contracts/ERC20.json"; // OpenZeppelin's ERC20 ABI
import { abi as IUniswapV3PoolABI } from "@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json";
import { useAppContext } from "../../context/AppContext";
import "./index.css";

const WBTC_ADDRESS_eth = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599"; // WBTC contract address
const USDT_ADDRESS_eth = "0xdAC17F958D2ee523a2206206994597C13D831ec7"; // USDT contract address
const POOL_ADDRESS_eth = "0x9Db9e0e53058C89e5B94e29621a205198648425B"; // Uniswap WBTC/USDT pool address

const Uniswap_fetching_Data = () => {
  const [poolData, setPoolData] = useState({
    WBTC: "0",
    USDT: "0",
    price: "0",
    tvl: "0",
    totalVolumeUSD: "0",
    dailyVolume: "0",
    dailyFees: "0",
    liquidityWBTC: "0",
    liquidityUSDT: "0",
  });
  const [loading, setLoading] = useState(false);

  const { walletConnected } = useAppContext();

  useEffect(() => {
    let intervalId;

    const initFetch = async () => {
      if (walletConnected) {
        const provider = new ethers.providers.Web3Provider(window.ethereum);

        // Fetch the pool address first
        await fetchPoolData(provider); // Pass provider directly
      }
    };

    initFetch();

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  const fetchPoolData = async (provider) => {
    // Change from { provider } to provider
    try {
      setLoading(true);

      const poolContract = new ethers.Contract(
        POOL_ADDRESS_eth,
        IUniswapV3PoolABI,
        provider
      );

      // Fetch Token details
      const WBTC = new Token(1, WBTC_ADDRESS_eth, 8, "WBTC", "Wrapped Bitcoin");
      const USDT = new Token(1, USDT_ADDRESS_eth, 6, "USDT", "Tether USD");

      // Fetch pool data from the contract
      const liquidity = await poolContract.liquidity();
      const slot0 = await poolContract.slot0();

      // Use the Uniswap V3 SDK to create a pool instance
      const pool = new Pool(
        WBTC, // Token 0
        USDT, // Token 1
        3000, // Fee tier (0.3%)
        slot0.sqrtPriceX96.toString(), // current price
        liquidity.toString(), // current liquidity
        slot0.tick // current tick
      );

      const price = pool.token0Price.toSignificant(6);

      // 2. Get WBTC and USDT balances from the pool
      const WBTCContract = new ethers.Contract(
        WBTC_ADDRESS_eth,
        ERC20_ABI,
        provider
      );
      const USDTContract = new ethers.Contract(
        USDT_ADDRESS_eth,
        ERC20_ABI,
        provider
      );

      const WBTCBalance = await WBTCContract.balanceOf(POOL_ADDRESS_eth);
      const USDTBalance = await USDTContract.balanceOf(POOL_ADDRESS_eth);

      const formattedWBTCBalance = ethers.utils.formatUnits(WBTCBalance, 8); // WBTC has 8 decimals
      const formattedUSDTBalance = ethers.utils.formatUnits(USDTBalance, 6); // USDT has 6 decimals

      // 3. Calculate TVL: (WBTC balance in USD + USDT balance)
      const tvlWBTC = formattedWBTCBalance * price;
      const tvl = (
        parseFloat(tvlWBTC) + parseFloat(formattedUSDTBalance)
      ).toFixed(2);

      // 4. Fetch daily volume (tracking Swap events)
      const currentBlock = await provider.getBlockNumber();
      const filterSwap = poolContract.filters.Swap();

      console.log(currentBlock);
      console.log(poolContract);

      // Get all Swap events from the last 5760 blocks (approx 24 hours)
      const events = await poolContract.queryFilter(
        filterSwap,
        currentBlock - 5760,
        currentBlock
      );

      console.log(events);

      let totalVolumeWBTC = 0;
      let totalVolumeUSDT = 0;

      events.forEach((event) => {
        const { amount0, amount1 } = event.args;
        const volumeWBTC = Math.abs(amount0.toString()) / Math.pow(10, 8); // WBTC has 8 decimals
        const volumeUSDT = Math.abs(amount1.toString()) / Math.pow(10, 6); // USDT has 6 decimals
        totalVolumeWBTC += volumeWBTC;
        totalVolumeUSDT += volumeUSDT;
      });

      const totalVolumeUSD = totalVolumeWBTC * price + totalVolumeUSDT;
      const dailyVolume = totalVolumeUSDT.toFixed(2);

      // 5. Calculate daily fees
      const feeTier = 0.003; // 0.3% for Uniswap V3 standard pools
      const dailyFees = (totalVolumeUSDT * feeTier).toFixed(2);

      // 6. Calculate liquidity in terms of WBTC and USDT
      const tickLower = nearestUsableTick(slot0.tick - 60 * 60, 60);
      const tickUpper = nearestUsableTick(slot0.tick + 60 * 60, 60);

      const position = new Position({
        pool,
        liquidity: liquidity.toString(),
        tickLower,
        tickUpper,
      });

      const liquidityWBTC = position.amount0.toSignificant(6); // Amount of WBTC in the pool's liquidity
      const liquidityUSDT = position.amount1.toSignificant(6); // Amount of USDT in the pool's liquidity

      // Set pool data state
      setPoolData({
        WBTC: formattedWBTCBalance,
        USDT: formattedUSDTBalance,
        price: price,
        tvl: tvl,
        totalVolumeUSD: totalVolumeUSD,
        dailyVolume: dailyVolume,
        dailyFees: dailyFees,
        liquidityWBTC: liquidityWBTC,
        liquidityUSDT: liquidityUSDT,
      });
    } catch (error) {
      console.error("Error fetching pool data:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ether-container">
      <h1>Uniswap WBTC/USDT Pool Data</h1>
      {loading ? (
        <p>Loading pool data...</p>
      ) : (
        <div>
          <p>WBTC Balance: {poolData.WBTC} WBTC</p>
          <p>USDT Balance: {poolData.USDT} USDT</p>
          <p>WBTC Price: ${poolData.price} USDT</p>
          <p>TVL: ${poolData.tvl} USD</p>
          <p>Total Volume: ${poolData.totalVolumeUSD} USD</p>
          <p>Daily Volume: ${poolData.dailyVolume} USD</p>
          <p>Daily Fees: ${poolData.dailyFees} USD</p>
          <p>Liquidity WBTC: {poolData.liquidityWBTC} WBTC</p>{" "}
          {/* Display WBTC Liquidity */}
          <p>Liquidity USDT: {poolData.liquidityUSDT} USDT</p>{" "}
          {/* Display USDT Liquidity */}
        </div>
      )}
    </div>
  );
};

export default Uniswap_fetching_Data;
