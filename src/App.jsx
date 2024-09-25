import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Token } from '@uniswap/sdk-core';
import { Pool } from '@uniswap/v3-sdk';
import { abi as ERC20_ABI } from '@openzeppelin/contracts/build/contracts/ERC20.json'; // OpenZeppelin's ERC20 ABI
import { abi as IUniswapV3PoolABI } from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json';
import "./App.css"

const WBTC_ADDRESS = '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'; // WBTC contract address
const USDT_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7'; // USDT contract address
const POOL_ADDRESS = '0x9Db9e0e53058C89e5B94e29621a205198648425B'; // Uniswap WBTC/USDT pool address

const App = () => {
  const [poolData, setPoolData] = useState({
    WBTC: '0',
    USDT: '0',
    price: '0',
    tvl: '0',
    totalVolumeUSD: '0',
    dailyVolume: '0',
    dailyFees: '0',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPoolData();
  }, []);

  const fetchPoolData = async () => {
    try {
      setLoading(true);

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const poolContract = new ethers.Contract(POOL_ADDRESS, IUniswapV3PoolABI, provider);

      // Fetch Token details
      const WBTC = new Token(1, WBTC_ADDRESS, 8, 'WBTC', 'Wrapped Bitcoin');
      const USDT = new Token(1, USDT_ADDRESS, 6, 'USDT', 'Tether USD');

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
      const WBTCContract = new ethers.Contract(WBTC_ADDRESS, ERC20_ABI, provider);
      const USDTContract = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, provider);

      const WBTCBalance = await WBTCContract.balanceOf(POOL_ADDRESS);
      const USDTBalance = await USDTContract.balanceOf(POOL_ADDRESS);

      const formattedWBTCBalance = ethers.utils.formatUnits(WBTCBalance, 8); // WBTC has 8 decimals
      const formattedUSDTBalance = ethers.utils.formatUnits(USDTBalance, 6); // USDT has 6 decimals

      // 3. Calculate TVL: (WBTC balance in USD + USDT balance)
      const tvlWBTC = formattedWBTCBalance * price;
      const tvl = (parseFloat(tvlWBTC) + parseFloat(formattedUSDTBalance)).toFixed(2);

      // 4. Fetch daily volume (tracking Swap events)
      const currentBlock = await provider.getBlockNumber();
      const filterSwap = poolContract.filters.Swap();

      // Get all Swap events from the last 5760 blocks (approx 24 hours)
      const events = await poolContract.queryFilter(filterSwap, currentBlock - 5760, currentBlock);

      let totalVolumeWBTC = 0;
      let totalVolumeUSDT = 0;

      events.forEach((event) => {
        const { amount0, amount1 } = event.args;
        const volumeWBTC = Math.abs(amount0.toString()) / Math.pow(10, 8); // WBTC has 8 decimals
        const volumeUSDT = Math.abs(amount1.toString()) / Math.pow(10, 6); // USDT has 6 decimals
        totalVolumeWBTC += volumeWBTC;
        totalVolumeUSDT += volumeUSDT;
      });

      const totalVolumeUSD = (totalVolumeWBTC * price) + totalVolumeUSDT;
      const dailyVolume = totalVolumeUSDT.toFixed(2);

      // 5. Calculate daily fees
      const feeTier = 0.003; // 0.3% for Uniswap V3 standard pools
      const dailyFees = (totalVolumeUSDT * feeTier).toFixed(2);

      // Set pool data state
      setPoolData({
        WBTC: formattedWBTCBalance,
        USDT: formattedUSDTBalance,
        price: price,
        tvl: tvl,
        totalVolumeUSD: totalVolumeUSD,
        dailyVolume: dailyVolume,
        dailyFees: dailyFees,
      });
    } catch (error) {
      console.error("Error fetching pool data:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>Uniswap WBTC/USDT Pool Data</h1>
      {loading ? (
        <p>Loading pool data...</p>
      ) : (
        <div>
          <p>WBTC Balance: {poolData.WBTC} WBTC</p>
          <p>USDT Balance: {poolData.USDT} USDT</p>
          <p>WBTC Price: ${poolData.price} USD</p>
          <p>TVL: ${poolData.tvl} USD</p>
          <p>Total Volume: ${poolData.totalVolumeUSD} USD</p>
          <p>Daily Volume: ${poolData.dailyVolume} USD</p>
          <p>Daily Fees: ${poolData.dailyFees} USD</p>
        </div>
      )}
    </div>
  );
};

export default App;
