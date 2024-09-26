import React, { useEffect, useState, useMemo } from "react";
import { ethers } from "ethers";
import contractabi from "../../abi/contractabi.json";
import poolcontractabi from "../../abi/poolcontractabi.json";
import { abi as ERC20_ABI } from "@openzeppelin/contracts/build/contracts/ERC20.json";
import "./index.css";
import { abi as NONFUNGIBLE_POSITION_MANAGER_ABI } from "@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json";
import { useAppContext } from "../../context/AppContext";

const UNISWAP_V3_FACTORY_ABI = contractabi;
const UNISWAP_V3_POOL_ABI = poolcontractabi;

const WBTC_ADDRESS_ARB = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";
const USDT_ADDRESS_ARB = "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9";
const UNISWAP_V3_FACTORY_ADDRESS = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
// const NONFUNGIBLE_POSITION_MANAGER_ADDRESS =
//   "0xC36442b4a4522E871399CD717aBDD847Ab11FE88"; // This is the address of the Uniswap V3 Nonfungible Position Manager on Ethereum Mainnet.

const UniswapGetPool = () => {
  const [poolAddress, setPoolAddress] = useState(null);
  const [poolData, setPoolData] = useState({
    WBTC: "0",
    USDT: "0",
    price: "0",
    tvl: "0",
    dailyVolume: "0",
    dailyFees: "0",
  });
  const [loading, setLoading] = useState(false);
  const [amount0, setAmount0] = useState("1"); // Default WBTC amount
  const [amount1, setAmount1] = useState("1000"); // Default USDT amount
  const [tickLower, setTickLower] = useState(-20000); // Default lower tick
  const [tickUpper, setTickUpper] = useState(20000); // Default upper tick
  const [liquidity, setLiquidity] = useState("0"); // Calculated liquidity

  const { walletConnected } = useAppContext();

  const fee = 3000;

  // Function to convert sqrtPriceX96 to price
  const getPriceFromSqrtPriceX96 = (sqrtPriceX96) => {
    return (sqrtPriceX96 / Math.pow(2, 96)) ** 2;
  };

  const fetchDailyVolumeFromEvents = async (provider, poolAddress, price) => {
    if (!poolAddress) {
      console.error("Invalid pool address");
      return "0";
    }

    const poolContract = new ethers.Contract(
      poolAddress,
      UNISWAP_V3_POOL_ABI,
      provider
    );
    const currentBlock = await provider.getBlockNumber();
    const oneDayAgo = currentBlock - 5760;

    try {
      const events = await poolContract.queryFilter(
        poolContract.filters.Swap(),
        oneDayAgo,
        currentBlock
      );

      console.log(events);
      let totalVolumeWBTC = 0;
      let totalVolumeUSDT = 0;

      events.forEach((event) => {
        const { amount0, amount1 } = event.args;
        totalVolumeWBTC += Math.abs(amount0.toString()) / Math.pow(10, 8);
        totalVolumeUSDT += Math.abs(amount1.toString()) / Math.pow(10, 6);
      });

      console.log(totalVolumeUSDT, totalVolumeWBTC);

      return (totalVolumeWBTC * price + totalVolumeUSDT).toString();
    } catch (error) {
      console.error("Error fetching daily volume from events:", error);
      return "0";
    }
  };

  const fetchPoolData = async (provider) => {
    setLoading(true); // Start loading
    try {
      const uniswapV3FactoryContract = new ethers.Contract(
        UNISWAP_V3_FACTORY_ADDRESS,
        UNISWAP_V3_FACTORY_ABI,
        provider
      );

      const pool = await uniswapV3FactoryContract.getPool(
        WBTC_ADDRESS_ARB,
        USDT_ADDRESS_ARB,
        fee
      );
      if (!pool || pool === ethers.constants.AddressZero) {
        throw new Error("Pool not found!");
      }
      setPoolAddress(pool);

      const poolContract = new ethers.Contract(
        pool,
        UNISWAP_V3_POOL_ABI,
        provider
      );
      const slot0 = await poolContract.slot0();
      const sqrtPriceX96 = slot0.sqrtPriceX96;

      const price = getPriceFromSqrtPriceX96(sqrtPriceX96) * 100;

      const [wbtcBalance, usdtBalance] = await fetchTokenBalances(
        provider,
        pool
      );

      const wbtcTVL = wbtcBalance * price;
      const usdtTVL = usdtBalance * 1; // USDT is pegged to $1
      const totalTVL = wbtcTVL + usdtTVL;

      const dailyVolume = await fetchDailyVolumeFromEvents(
        provider,
        pool,
        price
      );

      setPoolData({
        WBTC: wbtcBalance.toString(),
        USDT: usdtBalance.toString(),
        price: price.toString(),
        tvl: totalTVL.toString(),
        dailyVolume,
        dailyFees: dailyVolume * 0.03,
      });
    } catch (error) {
      console.error("Error fetching pool data:", error);
    } finally {
      setLoading(false); // End loading
    }
  };

  const fetchTokenBalances = async (provider, poolAddress) => {
    const WBTCContract = new ethers.Contract(
      WBTC_ADDRESS_ARB,
      ERC20_ABI,
      provider
    );
    const USDTContract = new ethers.Contract(
      USDT_ADDRESS_ARB,
      ERC20_ABI,
      provider
    );
    const [WBTCBalance, USDTBalance] = await Promise.all([
      WBTCContract.balanceOf(poolAddress),
      USDTContract.balanceOf(poolAddress),
    ]);

    return [
      ethers.utils.formatUnits(WBTCBalance, 8),
      ethers.utils.formatUnits(USDTBalance, 6),
    ];
  };

  //   const fetchAllPositions = async (provider, priceLower, priceUpper) => {
  //     const positionManagerContract = new ethers.Contract(
  //       NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
  //       NONFUNGIBLE_POSITION_MANAGER_ABI,
  //       provider
  //     );

  //     try {
  //       // Fetch all token IDs owned by the user
  //       const userAddress = await provider.getSigner().getAddress();
  //       console.log(positionManagerContract);
  //       console.log(userAddress);
  //       const balance = await positionManagerContract.balanceOf(userAddress);
  //       console.log(balance);

  //       let totalLiquidity = 0;

  //       for (let i = 0; i < balance; i++) {
  //         const tokenId = await positionManagerContract.tokenOfOwnerByIndex(
  //           userAddress,
  //           i
  //         );
  //         const position = await positionManagerContract.positions(tokenId);

  //         const { liquidity, tickLower, tickUpper } = position;
  //         const priceAtTickLower = Math.pow(1.0001, tickLower);
  //         const priceAtTickUpper = Math.pow(1.0001, tickUpper);

  //         if (
  //           (priceAtTickLower >= priceLower && priceAtTickLower <= priceUpper) ||
  //           (priceAtTickUpper >= priceLower && priceAtTickUpper <= priceUpper)
  //         ) {
  //           totalLiquidity += Number(liquidity);
  //         }
  //       }

  //       return totalLiquidity;
  //     } catch (error) {
  //       console.error(
  //         "Error fetching positions from NonfungiblePositionManager:",
  //         error
  //       );
  //       return 0;
  //     }
  //   };

  // Function to convert ticks to prices
  const getPriceFromTick = (tick) => {
    return Math.pow(1.0001, tick);
  };

  // Function to calculate liquidity
  const calculateLiquidity = (amount0, amount1, tickLower, tickUpper) => {
    const P_lower = getPriceFromTick(tickLower);
    const P_upper = getPriceFromTick(tickUpper);

    const liquidity =
      (P_upper * P_lower * (amount0 * P_upper + amount1)) /
      ((P_upper - P_lower) * P_upper);

    return liquidity;
  };

  const calculateDynamicRange = (currentPrice) => {
    const volatility = 0.05; // 5%
    return {
      priceLower: currentPrice * (1 - volatility),
      priceUpper: currentPrice * (1 + volatility),
    };
  };

  useEffect(() => {
    const initFetch = async () => {
      if (walletConnected) {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send("eth_requestAccounts", []); // Ensure the wallet is connected

        await fetchPoolData(provider);
      }
    };

    initFetch();
  }, []);

  const handleCalculateLiquidity = () => {
    const liquidityValue = calculateLiquidity(
      ethers.utils.parseUnits(amount0, 8), // WBTC has 8 decimals
      ethers.utils.parseUnits(amount1, 6), // USDT has 6 decimals
      tickLower,
      tickUpper
    );
    setLiquidity(liquidityValue.toString());
  };

  return (
    <div className="arbitrum-container">
      {poolAddress ? (
        <div>
          <h1>Uniswap WBTC/USDT Pool Data</h1>
          {loading ? (
            <p>Loading pool data...</p>
          ) : (
            <div>
              <p>Pool Address: {poolAddress}</p>
              {poolData && (
                <div className="arbitrum-container">
                  <p>WBTC Balance: {poolData.WBTC} WBTC</p>
                  <p>USDT Balance: {poolData.USDT} USDT</p>
                  <p>WBTC Price: {poolData.price} USDT</p>
                  <p>TVL: ${poolData.tvl} USD</p>
                  <p>Daily Volume: ${poolData.dailyVolume} USD</p>
                  <p>Daily Fees: ${poolData.dailyFees} USD</p>
                  <div className="set-liquidity">
                    <h2>Input Token Amounts and Ticks</h2>
                    <label>
                      WBTC Amount:
                      <input
                        type="number"
                        value={amount0}
                        onChange={(e) => setAmount0(e.target.value)}
                      />
                    </label>
                    <br />
                    <label>
                      USDT Amount:
                      <input
                        type="number"
                        value={amount1}
                        onChange={(e) => setAmount1(e.target.value)}
                      />
                    </label>
                    <br />
                    <label>
                      Lower Tick:
                      <input
                        type="number"
                        value={tickLower}
                        onChange={(e) => setTickLower(Number(e.target.value))}
                      />
                    </label>
                    <br />
                    <label>
                      Upper Tick:
                      <input
                        type="number"
                        value={tickUpper}
                        onChange={(e) => setTickUpper(Number(e.target.value))}
                      />
                    </label>
                    <br />
                    <button onClick={handleCalculateLiquidity}>
                      Calculate Liquidity
                    </button>
                  </div>
                  <p>liquidity: {liquidity} WBTC/USDT</p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <p>No pool address found. Please connect your wallet.</p>
      )}
    </div>
  );
};

export default UniswapGetPool;
