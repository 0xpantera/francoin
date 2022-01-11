const anchor = require("@project-serum/anchor");
const assert = require("assert");

// Need the system program
const { SystemProgram } = anchor.web3;

const main = async() => {
  console.log("🚀 Starting test...")

  // Create and set the provider.
  const provider = anchor.Provider.local(); // local instead of env
  anchor.setProvider(provider);

  const program = anchor.workspace.Francoin;

  let mint = null;
  let from = null;
  let to = null;

  
  mint = await createMint(provider);
  from = await createTokenAccount(provider, mint, provider.wallet.publicKey);
  to = await createTokenAccount(provider, mint, provider.wallet.publicKey);

  console.log("📝 Minting...");

  await program.rpc.proxyMintTo(new anchor.BN(1000), {
    accounts: {
      authority: provider.wallet.publicKey,
      mint,
      to: from,
      tokenProgram: TokenInstructions.TOKEN_PROGRAM_ID,
    },
  })

  const fromAccountMint = await getTokenAccount(provider, from);

  assert.ok(fromAccountMint.amount.eq(new anchor.BN(1000)));

  console.log("📝 Minted");
  

  await program.rpc.proxyTransfer(new anchor.BN(400), {
    accounts: {
      authority: provider.wallet.publicKey,
      to,
      from,
      tokenProgram: TokenInstructions.TOKEN_PROGRAM_ID,
    },
  });

  const fromAccountTransfer = await getTokenAccount(provider, from);
  const toAccountTransfer = await getTokenAccount(provider, to);

  assert.ok(fromAccountTransfer.amount.eq(new anchor.BN(600)));
  assert.ok(toAccountTransfer.amount.eq(new anchor.BN(400)));


  await program.rpc.proxyBurn(new anchor.BN(350), {
    accounts: {
      authority: provider.wallet.publicKey,
      mint,
      to,
      tokenProgram: TokenInstructions.TOKEN_PROGRAM_ID,
    },
  });

  const toAccountBurn = await getTokenAccount(provider, to);
  assert.ok(toAccountBurn.amount.eq(new anchor.BN(50)));


  const newMintAuthority = anchor.web3.Keypair.generate();
  await program.rpc.proxySetAuthority(
    { mintTokens: {} },
    newMintAuthority.publicKey,
    {
      accounts: {
        accountOrMint: mint,
        currentAuthority: provider.wallet.publicKey,
        tokenProgram: TokenInstructions.TOKEN_PROGRAM_ID,
      },
    }
  );

  const mintInfo = await getMintInfo(provider, mint);
  assert.ok(mintInfo.mintAuthority.equals(newMintAuthority));
  
};

const runMain = async () => {
  try {
    await main();
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

runMain();

const serumCmn = require("@project-serum/common");
const TokenInstructions = require("@project-serum/serum").TokenInstructions;

const TOKEN_PROGRAM_ID = new anchor.web3.PublicKey(
  TokenInstructions.TOKEN_PROGRAM_ID.toString()
);

async function getTokenAccount(provider, addr) {
  return await serumCmn.getTokenAccount(provider, addr);
}

async function getMintInfo(provider, mintAddr) {
  return await serumCmn.getMintInfo(provider, mintAddr);
}

async function createMint(provider, authority) {
  if (authority === undefined) {
    authority = provider.wallet.publicKey;
  }
  const mint = anchor.web3.Keypair.generate();
  const instructions = await createMintInstructions(
    provider,
    authority,
    mint.publicKey
  );

  const tx = new anchor.web3.Transaction();
  tx.add(...instructions);

  await provider.send(tx, [mint]);

  return mint.publicKey;
}

async function createMintInstructions(provider, authority, mint) {
  let instructions = [
    anchor.web3.SystemProgram.createAccount({
      fromPubkey: provider.wallet.publicKey,
      newAccountPubkey: mint,
      space: 82,
      lamports: await provider.connection.getMinimumBalanceForRentExemption(82),
      programId: TOKEN_PROGRAM_ID,
    }),
    TokenInstructions.initializeMint({
      mint,
      decimals: 0,
      mintAuthority: authority,
    }),
  ];
  return instructions;
}

async function createTokenAccount(provider, mint, owner) {
  const vault = anchor.web3.Keypair.generate();
  const tx = new anchor.web3.Transaction();
  tx.add(
    ...(await createTokenAccountInstrs(provider, vault.publicKey, mint, owner))
  );
  await provider.send(tx, [vault]);
  return vault.publicKey;
}

async function createTokenAccountInstrs(
  provider,
  newAccountPubkey,
  mint,
  owner,
  lamports
) {
  if (lamports === undefined) {
    lamports = await provider.connection.getMinimumBalanceForRentExemption(165);
  }
  return [
    anchor.web3.SystemProgram.createAccount({
      fromPubkey: provider.wallet.publicKey,
      newAccountPubkey,
      space: 165,
      lamports,
      programId: TOKEN_PROGRAM_ID,
    }),
    TokenInstructions.initializeAccount({
      account: newAccountPubkey,
      mint,
      owner,
    }),
  ];
}