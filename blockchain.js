const { Block } = require("./block");
const { Proof } = require("./proof");
const { createDB, LH_KEY, returnPath, closeDBRes } = require("./db");
const {
  coinbaseTx,
  isCoinBaseTx,
  sign,
  verify,
  usesKey,
  isLockedWithKey,
} = require("./transaction");
const { sha256 } = require("bitcoinjs-lib/src/crypto");
class Blockchain {
  constructor(address, node) {
    this.Node = node;
    this.Miner = address;
  }

  async initBlockchain(address) {
    try {
      await this.openDB();

      let res = await this.DB.get(LH_KEY);

      this.LastHash = res;
    } catch (e) {
      if (e.code == "LEVEL_NOT_FOUND") {
        let cbtx = coinbaseTx(address, "");
        let block = this.createBlock([cbtx], "", 1);

        console.log("block.LH_KEY", LH_KEY);

        await this.DB.put(block.Hash, this.serialize(block));
        await this.DB.put(LH_KEY, block.Hash);

        this.LastHash = block.Hash;
      }
    }
  }

  async continueBlockchain() {
    await this.openDB();

    try {
      let res = await this.DB.get(LH_KEY);
      this.LastHash = res;
    } catch (e) {
      if (e.code == "LEVEL_NOT_FOUND") {
        this.LastHash = "";
      }
    }
  }

  createBlock(txs, prevHash, height) {
    let block = new Block(this.createTimeStamp(), "", txs, prevHash, 0, height);
    let pow = new Proof(block);
    let res = pow.run();

    block.Nonce = res.nonce;
    block.Hash = res.hash;

    return block;
  }

  createTimeStamp() {
    return BigInt(new Date().getTime()).toString();
  }

  async addBlock(block) {
    try {
      const txn = await this.DB.batch();

      try {
        const blockExists = await this.DB.get(block.Hash).catch(() => null);

        if (blockExists) {
          return;
        }

        const blockData = this.serialize(block);

        await txn.put(block.Hash, blockData);

        let lastHash = await this.DB.get("lh").catch(() => "");

        console.log("lastHash", lastHash);

        const lastBlockData = await this.DB.get(lastHash).catch(() => "");

        console.log("lastBlockData", lastBlockData);

        const lastBlock = lastBlockData ? this.deserialize(lastBlockData) : "";

        if (!lastBlock || block.Height > lastBlock.Height) {
          await txn.put("lh", block.Hash);
          this.LastHash = block.Hash;
        }

        await txn.write();
      } catch (e) {
        console.log("e", e);
      }
    } catch (error) {
      console.error("Error while adding block:", error);
    }
  }

  async getBestHeight() {
    try {
      const lastHash = await this.DB.get("lh");

      const lastBlockData = await this.DB.get(lastHash);

      const lastBlock = this.deserialize(lastBlockData);

      return lastBlock.Height;
    } catch (error) {
      if (error.code == "LEVEL_NOT_FOUND") {
        return 0;
      }

      console.error("Error while getting best height:", error);
      throw new Error("Error fetching best height");
    }
  }

  async getBlockHashes() {
    const blocks = [];

    let currentHash = await this.DB.get("lh").catch(() => null);

    while (currentHash) {
      blocks.push(currentHash);
      const blockData = await this.DB.get(currentHash).catch(() => null);

      if (blockData) {
        const block = this.deserialize(blockData);
        currentHash = block.PrevHash;
      } else {
        break;
      }
    }

    return blocks;
  }

  async getBlock(blockHash) {
    try {
      const blockData = await this.DB.get(blockHash);

      const block = this.deserialize(blockData);

      return block;
    } catch (error) {
      if (error.code == "LEVEL_NOT_FOUND") {
        return null;
      }

      throw new Error("Error fetching block");
    }
  }

  async mineBlock(txs) {
    let lastHash;
    let lastHeight = 0;

    for (let i = 0; i < txs.length; i++) {
      if ((await this.verifyTransaction(txs[i])) != true) {
        console.error("Error in verify transaction");

        throw "Error in verify transaction";
      }
    }

    try {
      lastHash = await this.DB.get("lh");
      const lastBlockData = await this.DB.get(lastHash);
      const lastBlock = this.deserialize(lastBlockData);
      lastHeight = lastBlock.Height;
    } catch (error) {
      console.error(error);
    }

    let newBlock = this.createBlock(txs, this.LastHash, lastHeight + 1);

    this.LastHash = newBlock.Hash;

    console.log("newBlock.Hash", newBlock.Hash);

    console.log("------------------------newBlock", newBlock);

    this.DB.put(LH_KEY, newBlock.Hash);

    this.DB.put(newBlock.Hash, this.serialize(newBlock));

    return newBlock;
  }

  serialize(block) {
    return JSON.stringify(block);
  }

  deserialize(data) {
    return JSON.parse(data);
  }

  async findUTXO(pubKeyHash) {
    let UTXOs = [];

    let unspentTxs = await this.findUnspentTransactions(pubKeyHash);

    for (let i = 0; i < unspentTxs.length; i++) {
      unspentTxs[i].TxOutputs.map((item) => {
        if (isLockedWithKey(item, pubKeyHash)) {
          UTXOs.push(item);
        }
      });
    }

    return UTXOs;
  }

  async findUTXODB() {
    let currentHash = this.LastHash;

    let UTXOs = {};

    let spentTXOs = {};

    console.log("currentHash", currentHash);

    if (currentHash) {
      while (true) {
        let block = this.deserialize(await this.DB.get(currentHash));

        block.Transactions.map((tx) => {
          for (let i = 0; i < tx.TxOutputs.length; i++) {
            let fail = false;

            if (spentTXOs[tx.ID]) {
              let spendOuts = spentTXOs[tx.ID];

              for (let j = 0; j < spendOuts.length; j++) {
                if (spendOuts[j] == i) {
                  fail = true;
                  break;
                }
              }
            }

            if (fail) {
              continue;
            }

            if (!UTXOs[tx.ID]) {
              UTXOs[tx.ID] = [];
            }

            UTXOs[tx.ID].push(tx.TxOutputs[i]);
          }

          if (!isCoinBaseTx(tx)) {
            for (let j = 0; j < tx.TxInputs.length; j++) {
              let intxId = tx.TxInputs[j].ID;

              if (!spentTXOs[intxId]) {
                spentTXOs[intxId] = [];
              }

              spentTXOs[intxId].push(tx.TxInputs[j].Out);
            }
          }
        });

        currentHash = block.PrevHash;

        if (block.PrevHash == "") {
          break;
        }
      }
    }

    return UTXOs;
  }

  async findSpendableOutputs(pubKeyHash, amount) {
    let unspentOuts = {};

    let unspentTxs = await this.findUnspentTransactions(pubKeyHash);

    let accumulated = 0;

    unspentTxs.map((tx) => {
      for (let i = 0; i < tx.TxOutputs.length; i++) {
        if (
          isLockedWithKey(tx.TxOutputs[i], pubKeyHash) &&
          accumulated < Number(amount)
        ) {
          accumulated += Number(tx.TxOutputs[i].Value);

          if (unspentOuts[tx.ID]) {
            unspentOuts[tx.ID].push(i);
          } else {
            unspentOuts[tx.ID] = [i];
          }

          if (accumulated > Number(amount)) {
            break;
          }
        }
      }
    });

    return {
      accumulated,
      unspentOuts,
    };
  }

  async findUnspentTransactions(pubKeyHash) {
    let currentHash = this.LastHash;

    let unspentTxs = [];

    let spentTXOs = {};

    while (true) {
      let block = this.deserialize(await this.DB.get(currentHash));

      block.Transactions.map((tx) => {
        for (let i = 0; i < tx.TxOutputs.length; i++) {
          if (spentTXOs[tx.ID]) {
            let spendOuts = spentTXOs[tx.ID] ? spentTXOs[tx.ID] : [];

            for (let j = 0; j < spendOuts.length; j++) {
              if (spendOuts[j] == i) {
                continue;
              }
            }
          }

          if (isLockedWithKey(tx.TxOutputs[i], pubKeyHash)) {
            unspentTxs.push(tx);
          }
        }

        if (!isCoinBaseTx(tx)) {
          for (let j = 0; j < tx.TxInputs.length; j++) {
            let intxId = tx.TxInputs[j].ID;

            if (usesKey(tx.TxInputs[j], pubKeyHash)) {
              spentTXOs[intxId].push(intxId);
            } else {
              spentTXOs[intxId] = [intxId];
            }
          }
        }
      });

      currentHash = block.PrevHash;

      if (block.PrevHash == "") {
        break;
      }
    }

    return unspentTxs;
  }

  async signTransaction(tx, privKey) {
    let prevTXs = {};

    for (let i = 0; i < tx.TxInputs.length; i++) {
      let prevTX = await this.findTransaction(tx.TxInputs[i].ID);

      prevTXs[prevTX.ID] = prevTX;
    }

    sign(tx, privKey, prevTXs);
  }

  async verifyTransaction(tx) {
    console.log("tx", tx);

    if (isCoinBaseTx(tx)) {
      return true;
    }

    let prevTXs = {};

    for (let i = 0; i < tx.TxInputs.length; i++) {
      let prevTX = await this.findTransaction(tx.TxInputs[i].ID);

      prevTXs[prevTX.ID] = prevTX;
    }

    return verify(tx, prevTXs);
  }

  async findTransaction(id) {
    let currentHash = this.LastHash;

    let tx;

    while (true) {
      let block = this.deserialize(await this.DB.get(currentHash));

      console.log(".............................................");

      block.Transactions.map((item) => {
        if (item.ID == id) {
          tx = item;
        }
      });

      if (tx) {
        break;
      }

      currentHash = block.PrevHash;

      if (block.PrevHash == "") {
        break;
      }
    }

    return tx;
  }

  async iterate() {
    let currentHash = this.LastHash;

    while (true) {
      let block = this.deserialize(await this.DB.get(currentHash));

      console.log(".............................................");

      currentHash = block.PrevHash;

      console.log(`block ${block.Height}`, block);

      if (block.PrevHash == "") {
        break;
      }
    }
  }

  async getBlockHashes(chain) {
    let blocks = [];

    let currentHash = this.LastHash;

    while (true) {
      let block = this.deserialize(await this.DB.get(currentHash));

      blocks.push(block.Hash);

      currentHash = block.PrevHash;

      if (block.PrevHash == "") {
        break;
      }
    }

    return blocks;
  }

  async openDB() {
    this.DB = await createDB(this.Node);
  }

  async closeDB() {
    await new Promise((resolve, reject) => {
      this.DB.close((err) => {
        if (err) {
          console.error("Error closing the database:", err);
          reject(err);
        } else {
          console.log("Database closed successfully");
          closeDBRes();
          resolve();
        }
      });
    });
  }
}

module.exports = { Blockchain };
