import { JsonRpcProvider } from 'ethers';
import { Contract } from 'ethers';
import { addTxSignatures } from '../../src/signer';
import { bech32ToBytes, hexToBuffer } from '../../src/utils';
import { getContextFromURI } from '../../src/vms/context';
import { newExportTxFromBaseFee, newImportTx } from '../../src/vms';
import { evmapi, pvmapi } from '../chain_apis';
import { getChainIdFromContext } from '../utils/getChainIdFromContext';
import { abi as IUniswapV2RouterABI } from '@uniswap/v2-periphery/build/IUniswapV2Router02.json';

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const C_CHAIN_ADDRESS = process.env.C_CHAIN_ADDRESS;
const P_CHAIN_ADDRESS = process.env.P_CHAIN_ADDRESS;
const CORETH_ADDRESS = process.env.CORETH_ADDRESS;
const USDC_ADDRESS = process.env.USDC_ADDRESS;
const ROUTER_ADDRESS = process.env.ROUTER_ADDRESS; // DEX router address (e.g., Pangolin or Trader Joe)

// Export Transaction
export const sendExportTransaction = async () => {
  console.log({ url: process.env.AVAX_PUBLIC_URL });
  if (!C_CHAIN_ADDRESS || !P_CHAIN_ADDRESS || !PRIVATE_KEY) {
    throw new Error('Missing environment variable(s).');
  }

  const provider = new JsonRpcProvider(
    process.env.AVAX_PUBLIC_URL + '/ext/bc/C/rpc',
  );
  const context = await getContextFromURI(process.env.AVAX_PUBLIC_URL);
  console.log({ context });
  const txCount = await provider.getTransactionCount(C_CHAIN_ADDRESS);
  const baseFee = await evmapi.getBaseFee();
  const pAddressBytes = bech32ToBytes(P_CHAIN_ADDRESS);

  const tx = newExportTxFromBaseFee(
    context,
    baseFee / BigInt(1e9),
    BigInt(0.1 * 1e9),
    context.pBlockchainID,
    hexToBuffer(C_CHAIN_ADDRESS),
    [pAddressBytes],
    BigInt(txCount),
  );

  await addTxSignatures({
    unsignedTx: tx,
    privateKeys: [hexToBuffer(PRIVATE_KEY)],
  });

  return evmapi.issueSignedTx(tx.getSignedTx());
};

// Import Transaction
export const sendImportTransaction = async () => {
  if (!P_CHAIN_ADDRESS || !CORETH_ADDRESS || !PRIVATE_KEY) {
    throw new Error('Missing environment variable(s).');
  }

  const context = await getContextFromURI(process.env.AVAX_PUBLIC_URL);
  console.log({ context });

  const { utxos } = await pvmapi.getUTXOs({
    sourceChain: 'C',
    addresses: [P_CHAIN_ADDRESS],
  });

  const importTx = newImportTx(
    context,
    getChainIdFromContext('C', context),
    utxos,
    [bech32ToBytes(P_CHAIN_ADDRESS)],
    [bech32ToBytes(CORETH_ADDRESS)],
  );

  await addTxSignatures({
    unsignedTx: importTx,
    privateKeys: [hexToBuffer(PRIVATE_KEY)],
  });

  return pvmapi.issueSignedTx(importTx.getSignedTx());
};

// Swap USDC to AVAX
export const swapUSDCToAVAX = async (amountIn, slippage = 0.01) => {
  if (!C_CHAIN_ADDRESS || !USDC_ADDRESS || !PRIVATE_KEY) {
    throw new Error('Missing environment variable(s).');
  }

  const provider = new JsonRpcProvider(
    process.env.AVAX_PUBLIC_URL + '/ext/bc/C/rpc',
  );
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const router = new Contract(ROUTER_ADDRESS, IUniswapV2RouterABI, wallet);

  const amountOutMin = (await router.getAmountsOut(amountIn, [USDC_ADDRESS, '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7']))[1] // AVAX address on C-Chain
    .mul(BigInt(1 - slippage * 100))
    .div(BigInt(100));

  const tx = await router.swapExactTokensForAVAX(
    amountIn,
    amountOutMin,
    [USDC_ADDRESS, '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7'], // USDC -> AVAX
    C_CHAIN_ADDRESS,
    Math.floor(Date.now() / 1000) + 60 * 10 // 10 minutes deadline
  );

  await tx.wait();

  console.log(`Swapped ${amountIn} USDC for AVAX`);
  return tx;
};
