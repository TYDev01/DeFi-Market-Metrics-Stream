import 'dotenv/config';
import { createPublicClient, createWalletClient, defineChain, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { SDK } from "@somnia-chain/streams";

async function checkSchema() {
  const rpcUrl = process.env.SOMNIA_RPC_URL!;
  const privateKey = process.env.PRIVATE_KEY!;
  const schemaId = process.env.SOMNIA_SCHEMA_ID!;

  const chainId = 50312;
  const chain = defineChain({
    id: chainId,
    name: "Somnia Dream",
    network: "somnia-dream",
    nativeCurrency: { decimals: 18, name: "Somnia", symbol: "SOM" },
    rpcUrls: {
      default: { http: [rpcUrl] },
      public: { http: [rpcUrl] }
    }
  });

  const transport = http(rpcUrl, { timeout: 120000 });
  const account = privateKeyToAccount(privateKey.startsWith("0x") ? (privateKey as `0x${string}`) : (`0x${privateKey}` as `0x${string}`));

  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });
  const sdk = new SDK({ public: publicClient, wallet: walletClient });

  console.log("Checking schema registration status...\n");
  console.log("Schema ID:", schemaId);

  try {
    const isRegistered = await sdk.streams.isDataSchemaRegistered(schemaId as `0x${string}`);
    console.log("Is Registered:", isRegistered);

    if (isRegistered) {
      const schemaLabel = await sdk.streams.schemaIdToId(schemaId as `0x${string}`);
      console.log("Schema Label:", schemaLabel);

      console.log("\nSchema is registered and ready to use!");
      console.log("You should be able to write data to Somnia Streams.");
    } else {
      console.log("\nSchema is NOT registered!");
      console.log("Run: npx ts-node scripts/registerSchemaSDK.ts");
    }
  } catch (error: any) {
    console.error("Error checking schema:", error.message);
  }
}

checkSchema();
