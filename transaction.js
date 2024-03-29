const { sha256 } = require("js-sha256");
const { Wallet, generatePublicKeyHash, base58Decode } = require("./wallet");
const { Wallets } = require("./wallets");
const EC = require("elliptic").ec;
const crypto = require("crypto");

class TxOutput {
  constructor(value, pubKeyHash, address) {
    this.Value = value;
    this.PubKeyHash = pubKeyHash;
    this.Address = address;
  }
}

class TxInput {
  constructor(id, out, signature, pubKey, address) {
    this.ID = id;
    this.Out = out;
    this.Signature = signature;
    this.PubKey = pubKey;
    this.Address = address;
  }
}

class Transaction {
  constructor(id, txInputs, txOutputs) {
    this.ID = id;
    this.TxInputs = txInputs;
    this.TxOutputs = txOutputs;
  }

  getHash() {
    let txCopy = this;
    txCopy.ID = "";
    let hash = sha256(txCopy.serialize());

    return hash;
  }

  serialize() {
    return JSON.stringify(this);
  }
}

function deserializeTransaction(data) {
  try {
    return JSON.parse(data);
  } catch (error) {
    return data;
  }
}

function coinbaseTx(to, data) {
  if (!data) {
    const randomBytes = crypto.randomBytes(24);
    data = randomBytes.toString("hex");
  }

  let txin = new TxInput(0, -1, "", Buffer.from(data).toString("hex"), "");
  let txout = newTxOutput(20, to);

  let tx = new Transaction("", [txin], [txout]);

  tx.ID = tx.getHash();

  return tx;
}

function trimmedCopy(tx) {
  let txInputs = [];
  let txOutputs = [];

  for (let i = 0; i < tx.TxInputs.length; i++) {
    txInputs.push(new TxInput(tx.TxInputs[i].ID, tx.TxInputs[i].Out, "", ""));
  }

  for (let i = 0; i < tx.TxOutputs.length; i++) {
    txOutputs.push(
      new TxOutput(tx.TxOutputs[i].Value, tx.TxOutputs[i].PubKeyHash)
    );
  }

  let txCopy = new Transaction(tx.ID, txInputs, txOutputs);

  return txCopy;
}

function isCoinBaseTx(tx) {
  return (
    tx.TxInputs.length == 1 &&
    tx.TxInputs[0].ID == 0 &&
    tx.TxInputs[0].Out == -1
  );
}

function sign(tx, privKey, prevTXs) {
  if (isCoinBaseTx(tx)) {
    return;
  }

  for (let i = 0; i < tx.TxInputs.length; i++) {
    if (prevTXs[tx.TxInputs[i].ID].ID == "") {
      console.error("previous transaction does not exist.");

      throw "previous transaction does not exist.";
    }
  }

  let txCopy = trimmedCopy(tx);

  for (let i = 0; i < txCopy.TxInputs.length; i++) {
    let prevTX = prevTXs[txCopy.TxInputs[i].ID];
    txCopy.TxInputs[i].Signature = "";
    txCopy.TxInputs[i].PubKey =
      prevTX.TxOutputs[txCopy.TxInputs[i].Out].PubKeyHash;
    txCopy.ID = txCopy.getHash();
    txCopy.TxInputs[i].PubKey = "";

    let key = new EC("p256").keyFromPrivate(privKey);

    res = key.sign(txCopy.ID);

    tx.TxInputs[i].Signature = res.toDER("hex");
  }
}

function verify(tx, prevTXs) {
  if (isCoinBaseTx(tx)) {
    return;
  }

  for (let i = 0; i < tx.TxInputs.length; i++) {
    if (prevTXs[tx.TxInputs[i].ID].ID == "") {
      console.error("previous transaction does not exist.");
      throw "previous transaction does not exist.";
    }
  }

  let txCopy = trimmedCopy(tx);

  let curve = new EC("p256");

  for (let i = 0; i < tx.TxInputs.length; i++) {
    let prevTX = prevTXs[tx.TxInputs[i].ID];

    txCopy.TxInputs[i].Signature = "";

    txCopy.TxInputs[i].PubKey = prevTX.TxOutputs[tx.TxInputs[i].Out].PubKeyHash;
    txCopy.ID = txCopy.getHash();
    txCopy.TxInputs[i].PubKey = "";

    let signatureHex = tx.TxInputs[i].Signature;

    let signature = Buffer.from(signatureHex, "hex");

    let key = curve.keyFromPublic(tx.TxInputs[i].PubKey, "hex");

    if (!key.verify(txCopy.ID, signature)) {
      return false;
    }
  }

  return true;
}

function usesKey(input, pubKeyHash) {
  let lockingHash = generatePublicKeyHash(input.PubKey);
  return Buffer.compare(lockingHash, pubKeyHash);
}

function lock(output, address) {
  let pubKeyHash = base58Decode(address);

  pubKeyHash = pubKeyHash.slice(1, pubKeyHash.length - 4);

  output.PubKeyHash = pubKeyHash.toString("hex");

  return output;
}

function newTxOutput(value, address) {
  let txo = new TxOutput(value, "", address);
  txo = lock(txo, address);
  return txo;
}

function isLockedWithKey(output, pubKeyHash) {
  return (
    Buffer.compare(Buffer.from(output.PubKeyHash), Buffer.from(pubKeyHash)) == 0
  );
}

function canUnlock(input, data) {
  return input.Sig == data;
}

function canBeUnlocked(output, data) {
  return output.PubKey == data;
}

async function getBalance(address, UTXOSet, nodeID) {
  // let wallets = new Wallets();

  // await wallets.loadFile(nodeID);

  // let res = wallets.getWallet(address);

  // let wallet = new Wallet();

  // wallet.updateWallet(res.PublicKey, res.PrivateKey);

  // let pubKeyHash = wallet.generatePublicKeyHash();

  let balance = await UTXOSet.getBalance(address);

  return balance;
}

async function newTransaction(from, to, amount, UTXOSet, nodeID) {
  let inputs = [];
  let outputs = [];

  let wallets = new Wallets();

  await wallets.loadFile(nodeID);

  let res = wallets.getWallet(from);

  let wallet = new Wallet();

  wallet.updateWallet(res.PublicKey, res.PrivateKey);

  let pubKeyHash = wallet.generatePublicKeyHash();

  let { accumulated, unspentOuts } = await UTXOSet.findSpendableOutputs(
    pubKeyHash.toString("hex"),
    amount
  );

  console.log("accumulated", accumulated);
  console.log("unspentOuts", unspentOuts);

  if (accumulated < amount) {
    console.log("Error: not enough funds");
    throw "Error: not enough funds";
  } else {
    let keys = Object.keys(unspentOuts);

    for (let i = 0; i < keys.length; i++) {
      outs = unspentOuts[keys[i]];
      for (let j = 0; j < outs.length; j++) {
        inputs.push(new TxInput(keys[i], outs[j], "", wallet.PublicKey, from));
      }
    }

    outputs.push(newTxOutput(amount.toString(), to));

    if (accumulated > amount) {
      let returnAmount = accumulated - amount;
      outputs.push(newTxOutput(returnAmount.toString(), from));
    }

    let tx = new Transaction("", inputs, outputs);

    tx.ID = tx.getHash();

    await UTXOSet.blockchain.signTransaction(tx, wallet.PrivateKey);

    return tx;
  }
}

module.exports = {
  Transaction,
  deserializeTransaction,
  coinbaseTx,
  isCoinBaseTx,
  canUnlock,
  canBeUnlocked,
  newTransaction,
  sign,
  verify,
  usesKey,
  isLockedWithKey,
  newTxOutput,
  getBalance,
};
