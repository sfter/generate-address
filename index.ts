import { Secp256k1HdWallet } from "@cosmjs/amino";
const ethers = require('ethers');
const bip39 = require('bip39');
const fs = require('fs');
const path = require('path');
import * as ed25519 from 'ed25519-hd-key';
const {
    Keypair
  } = require('@solana/web3.js');
import { publicKeyToAddress } from '@unisat/wallet-sdk/lib/address';
import { HdKeyring } from '@unisat/wallet-sdk/lib/keyring';
import { AddressType } from '@unisat/wallet-sdk/lib/types';
import { NetworkType } from '@unisat/wallet-sdk/lib/network';
const TonWeb = require("tonweb");
const nacl = require("tweetnacl");

function generateMnemonic(){
    const mnemonic = bip39.generateMnemonic();
    return mnemonic;
}

async function generateCosmosAddress(mnemonic: string, prefix: string = "celestia") {
    const wallet = await Secp256k1HdWallet.fromMnemonic(mnemonic, {prefix: prefix});
    const [{ address, pubkey }] = await wallet.getAccounts();

    return address;
}

// sub address m/44'/60'/0'/0/1 m/44'/60'/0'/0/2 m/44'/60'/0'/0/3 m/44'/60'/0'/0/4
async function generateEVMAddress(mnemonic: string, derivation_path : string = "m/44'/60'/0'/0/0"){
    const hdWallet = ethers.HDNodeWallet.fromPhrase(mnemonic, "", derivation_path);
    return hdWallet.address;
}

// sub address m/44'/501'/1'/0 m/44'/501'/2'/0 m/44'/501'/3'/0
async function generateSolanaAddress(mnemonic: string, derivation_path : string = "m/44'/501'/0'/0'") {
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    // Derive a seed from the given path
    const derivedSeed = ed25519.derivePath(derivation_path, seed).key;
    const derivedKeypair = await Keypair.fromSeed(derivedSeed);
    return derivedKeypair.publicKey.toBase58();

}

// different hdPath and different activeIndexes
async function generateBitcoinAddress(mnemonic: string, hdPath: string = "m/86'/0'/0'/0/0") {
    const keyring = new HdKeyring({
        mnemonic: mnemonic,
        activeIndexes: [0],
        hdPath: hdPath // Taproot
      });
    const account = (await keyring.getAccounts())[0];
    const address = publicKeyToAddress(account, AddressType.P2TR, NetworkType.MAINNET);
    return address;
}

// TODO: Support TON
// async function generateTonAddress(mnemonic: string) {
//     const tonwebInstance = new TonWeb();

//     const seed = bip39.mnemonicToSeedSync(mnemonic);
//     const keyPair = nacl.sign.keyPair.fromSeed(seed.slice(0,32));
//     // Create a wallet using the public key as Uint8Array
//     const publicKey = keyPair.publicKey;
//     const wallet = tonwebInstance.wallet.create({publicKey});

//     // Get the wallet address
//     const walletAddress = (await wallet.getAddress()).toString(true, true, true);
//     return walletAddress;
// }


const argv = require('yargs')
  .command('new', 'Generate new wallets')
  .command('regen', 'Regenerate addresses from existing mnemonics')
  .option('count', {
    alias: 'c',
    type: 'number',
    default: 100,
    describe: 'Number of wallets to generate',
  })
  .argv;

const keysDir = path.join(__dirname, 'keys');
if (!fs.existsSync(keysDir)) {
fs.mkdirSync(keysDir);
}

async function generateAddressesAndSave(mnemonic:string){
    const evmAddress = await generateEVMAddress(mnemonic);
    const bitcoinTaprootAddress = await generateBitcoinAddress(mnemonic);
    const celestiaAddress = await generateCosmosAddress(mnemonic);
    const solanaAddress = await generateSolanaAddress(mnemonic);

    const data = {
      "mnemonic": mnemonic,
      "evm": evmAddress,
      "taproot": bitcoinTaprootAddress,
      "celestia": celestiaAddress,
      "solana": solanaAddress,
    };

    const fileName = `${evmAddress}.json`;
    const filePath = path.join(keysDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return filePath
}

async function main() {
    if (argv._[0] === 'new') {
      for (let i = 0; i < argv.count; i++) {
        const mnemonic = generateMnemonic();
        const filePath = await generateAddressesAndSave(mnemonic);
        console.log(`Wallet saved to ${filePath}`);
      }
    } else if (argv._[0] === 'regen') {
      const files = fs.readdirSync(keysDir);
      for (const file of files) {
        const filePath = path.join(keysDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const mnemonic = data["mnemonic"];
        const _ = await generateAddressesAndSave(mnemonic);
        console.log(`Wallet update to ${filePath}`);
      }
    } else {
      console.error('Please use either "new" or "regen" command.');
    }
  }

main()