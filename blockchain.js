const { Block } = require("./block");
const { Proof } = require("./proof");
const { createDB, LH_KEY } = require("./db");
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
    this.DB = createDB(node);

    this.initBlockchain(address);

    this.Miner = address;
  }

  async initBlockchain(address) {
    try {
      let res = await this.DB.get(LH_KEY);
      this.LastHash = res;
    } catch (e) {
      if (e.code == "LEVEL_NOT_FOUND") {
        let cbtx = coinbaseTx(address, "");
        let block = this.createBlock([cbtx], "", 0);

        console.log("block.Hash", this.serialize(block));
        console.log("block.LH_KEY", LH_KEY);

        this.DB.put(block.Hash, this.serialize(block));
        this.DB.put(LH_KEY, block.Hash);
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
      const txn = this.DB.batch();

      try {
        const blockExists = await this.DB.get(block.hash).catch(() => null);

        if (blockExists) {
          return;
        }
      } catch (e) {
        const blockData = serializeBlock(block);
        await txn.put(block.hash, blockData);

        const lastHash = await txn.get("lh");
        const lastBlockData = await txn.get(lastHash);
        const lastBlock = this.deserialize(lastBlockData);

        if (!lastBlock || block.height > lastBlock.height) {
          await txn.put("lh", block.hash);
          this.LastHash = block.hash;
        }

        await txn.write();
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

    let tx = coinbaseTx(this.Miner, "");

    let newBlock = this.createBlock(
      [tx, ...txs],
      this.LastHash,
      lastHeight + 1
    );

    this.LastHash = newBlock.Hash;

    this.DB.put(LH_KEY, newBlock.Hash);

    this.DB.put(newBlock.Hash, this.serialize(newBlock));
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

      console.log("Block", JSON.stringify(block, null, 2));

      currentHash = block.PrevHash;

      if (block.PrevHash == "") {
        break;
      }
    }
  }
}

module.exports = { Blockchain };
