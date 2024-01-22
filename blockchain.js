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

  async continueBlockchain(needToWrite) {
    await this.openDB(needToWrite);

    try {
      let res = await this.DB.get(LH_KEY);
      this.LastHash = res;
    } catch (e) {
      console.log("eeeeeeeeeeeeeeeeeee", e);

      if (e.code == "LEVEL_NOT_FOUND") {
        this.LastHash = "";
      }
    }
  }

  async addBlock(blocks) {
    try {
      for (let i = 0; i < blocks.length; i++) {
        const txn = await this.DB.batch();

        const block = blocks[i];

        const blockExists = await this.DB.get(block.Header.Hash).catch(
          () => ""
        );

        if (blockExists) {
          return;
        }

        const blockData = block;

        let lastHash = await this.DB.get("lh").catch(() => "");

        const lastBlockData = await this.DB.get(lastHash).catch(() => "");

        const lastBlock = lastBlockData ? this.deserialize(lastBlockData) : "";

        console.log("lastBlock", lastBlock);
        console.log("blockData", blockData);

        if (
          (!lastBlock && blockData.Header.Height == 1) ||
          (lastBlock &&
            blockData.Header.Height == lastBlock.Header.Height + 1 &&
            blockData.Header.PrevHash == lastBlock.Hash)
        ) {
          await txn.put("lh", blockData.Hash);
          await txn.put(`block_${blockData.Header.Height}`, blockData.Hash);
          await txn.put(blockData.Hash, this.serialize(blockData));

          this.LastHash = blockData.Hash;
        } else {
          return "fork";
        }

        await txn.write();
      }
    } catch (e) {
      console.log("e", e);
    }
  }

  async getBestHeight() {
    try {
      const lastHash = await this.DB.get("lh");

      const lastBlockData = await this.DB.get(lastHash);

      const lastBlock = this.deserialize(lastBlockData);

      return lastBlock.Header.Height;
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
        currentHash = block.Header.PrevHash;
      } else {
        break;
      }
    }

    return blocks;
  }

  async getBlockHeaders(fromHeaderHash, stopHeaderHash, number = 100) {
    let count = 0;
    let height = 1;
    let nowHash = fromHeaderHash;

    let headers = [];

    if (fromHeaderHash) {
      try {
        let block = this.deserialize(await this.DB.get(fromHeaderHash));
        height = block.Header.Height + 1;
      } catch (e) {}
    }

    try {
      let lastHash = await this.DB.get("lh");

      const lastBlockData = this.deserialize(await this.DB.get(lastHash));

      number =
        lastBlockData.Header.Height - height < 100
          ? lastBlockData.Header.Height - height
          : 100;
    } catch (e) {
      console.log("e", e);
    }

    console.log("fromHeaderHash", fromHeaderHash);
    console.log("number", number);

    while (true) {
      if ((stopHeaderHash && nowHash == stopHeaderHash) || count == number) {
        break;
      }

      try {
        let hash = await this.DB.get(`block_${height}`);

        let block = this.deserialize(await this.DB.get(hash));

        count += 1;
        height += 1;

        nowHash = block.Header.Hash;

        headers.push({ Hash: block.Hash, Header: block.Header });
      } catch {}
    }

    return headers;
  }

  async getBlockWithHeight(height) {
    return await this.DB.get(`block_${height}`).catch(() => "");
  }

  async findCommonPointWithSyncNode(headers) {
    let height = 1;

    for (let i = 0; i < headers.length; i++) {
      let hash = await this.DB.get(`block_${height}`).catch(() => "");

      if (hash != headers[i].Hash) {
        return height;
      }

      height += 1;
    }

    return height;
  }

  async getHeadersHashFromHeaders(headers) {
    let headerHashs = [];

    for (let i = 0; i < headers.length; i++) {
      headerHashs.push(headers[i].Hash);
    }

    return headerHashs;
  }

  async backwardChain(height) {
    console.log(
      "---------------------------backward chain run----------------------------------"
    );

    try {
      while (true) {
        let lastHash = await this.DB.get("lh");

        if (lastHash == "") {
          break;
        }

        const lastBlockData = await this.DB.get(lastHash);
        const lastBlock = this.deserialize(lastBlockData);
        let lastHeight = lastBlock.Header.Height;

        if (lastHeight < height) {
          break;
        }

        await this.DB.put("lh", lastBlock.Header.PrevHash);
        await this.DB.put(lastHash, "");
        await this.DB.put(`block_${lastHeight}`, "");
      }
    } catch (error) {
      console.error("error occure in backwardChain function", error);
    }
  }

  async checkSyncNodeHeaders(headers) {
    let hash = "";

    console.log("headers", headers);

    for (let i = 0; i < headers.length; i++) {
      let block = new Block(
        headers[i].Header.Timestamp,
        headers[i].Hash,
        [],
        headers[i].Header.PrevHash,
        headers[i].Header.Nonce,
        headers[i].Header.Height,
        headers[i].Header.MerkleRoot
      );

      let proof = new Proof(block);

      if (
        (hash && headers[i].Header.PrevHash != hash) ||
        !proof.validateProof() ||
        !proof.validate()
      ) {
        throw new Error("Error checking sync node headers");
      }

      hash = block.Hash;
    }
  }

  async getBlock(headerHashes) {
    let blocks = [];

    for (let i = 0; i < headerHashes.length; i++) {
      try {
        const blockData = await this.DB.get(headerHashes[i]);

        const block = this.deserialize(blockData);

        blocks.push(block);
      } catch (error) {
        if (error.code == "LEVEL_NOT_FOUND") {
          return null;
        }

        console.log("Error fetching block", headerHashes);

        throw new Error("Error fetching block");
      }
    }

    return blocks;
  }

  async checkAfterMint(result) {
    let newBlock = result.block;
    let lastHeight = result.lastHeight;

    let newlastHeight = 0;
    let newlastHash;
    try {
      newlastHash = await this.DB.get("lh");
      const newlastBlockData = await this.DB.get(newlastHash);
      const newlastBlock = this.deserialize(newlastBlockData);
      newlastHeight = newlastBlock.Header.Height;
    } catch (error) {
      console.error("error", error);
    }

    if (newlastHeight == lastHeight) {
      this.LastHash = newBlock.Hash;

      await this.DB.put(LH_KEY, newBlock.Hash);

      await this.DB.put(newBlock.Hash, this.serialize(newBlock));

      await this.DB.put(`block_${newBlock.Header.Height}`, newBlock.Hash);

      return newBlock;
    } else {
      if (Math.abs(newlastHeight - lastHeight) > 1) {
        return "fork";
      }
    }
  }

  async mineBlock(txs, miningProcess) {
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
      lastHeight = lastBlock.Header.Height;
    } catch (error) {
      console.error("error", error);
    }

    miningProcess.send({
      txs,
      prevHash: this.LastHash,
      height: lastHeight,
    });
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

  async findUTXODB(returnSpend = false, height) {
    let currentHash = await this.DB.get("lh").catch(() => "");

    let UTXOs = {};

    let spentTXOs = {};

    if (currentHash) {
      while (true) {
        console.log("currentHash", currentHash);

        let block = this.deserialize(await this.DB.get(currentHash));

        console.log("blockblockblockblock", block);

        block.Transactions.map((tx) => {
          for (let i = 0; i < tx.TxOutputs.length; i++) {
            let fail = false;

            if (spentTXOs[tx.ID]) {
              for (let j = 0; j < spentTXOs[tx.ID].length; j++) {
                if (spentTXOs[tx.ID][j] == i) {
                  const index = spentTXOs[tx.ID].indexOf(spentTXOs[tx.ID][j]);

                  if (index > -1) {
                    spentTXOs[tx.ID].splice(index, 1);
                  }

                  if (spentTXOs[tx.ID] && spentTXOs[tx.ID].length == 0) {
                    delete spentTXOs[tx.ID];
                  }

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

              if (!spentTXOs[intxId].includes(tx.TxInputs[j].Out)) {
                spentTXOs[intxId].push(tx.TxInputs[j].Out);
              }
            }
          }
        });

        currentHash = block.Header.PrevHash;

        if (
          block.Header.PrevHash == "" ||
          (height && block.Header.Height == height)
        ) {
          break;
        }
      }
    }

    return returnSpend ? { UTXOs, spentTXOs } : UTXOs;
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

      currentHash = block.Header.PrevHash;

      if (block.Header.PrevHash == "") {
        break;
      }
    }

    return unspentTxs;
  }

  async signTransaction(tx, privKey) {
    let prevTXs = {};
    let spentTXOs = {};

    for (let i = 0; i < tx.TxInputs.length; i++) {
      let prevTX = await this.findTransaction(tx.TxInputs[i].ID);

      prevTXs[prevTX.ID] = prevTX;
    }

    sign(tx, privKey, prevTXs);
  }

  async checkDoubleSpendingTxs(txs) {
    let removeTx = [];

    let spentTXOs = {};

    for (let i = 0; i < txs.length; i++) {
      let tx = txs[i];

      let remove = false;

      for (let j = 0; j < tx.TxInputs.length; j++) {
        let intxId = tx.TxInputs[j].ID;

        if (
          spentTXOs[intxId] &&
          spentTXOs[intxId].includes(tx.TxInputs[j].Out)
        ) {
          removeTx.push(tx.ID);
          remove = true;
          break;
        }
      }

      if (remove) {
        continue;
      }

      for (let j = 0; j < tx.TxInputs.length; j++) {
        let intxId = tx.TxInputs[j].ID;

        if (!spentTXOs[intxId]) {
          spentTXOs[intxId] = [];
        }

        spentTXOs[intxId].push(tx.TxInputs[j].Out);
      }
    }

    return removeTx;
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

      currentHash = block.Header.PrevHash;

      if (block.Header.PrevHash == "") {
        break;
      }
    }

    return tx;
  }

  async iterate() {
    let currentHash = this.LastHash;

    console.log("currentHash", currentHash);

    if (currentHash) {
      while (true) {
        let block = this.deserialize(await this.DB.get(currentHash));

        console.log(".............................................");

        currentHash = block.Header.PrevHash;

        console.log(
          `block ${block.Header.Height}`,
          JSON.stringify(block, null, 2)
        );

        if (block.Header.PrevHash == "") {
          break;
        }
      }
    } else {
      console.log("There is no block in chain");
    }
  }

  async getBlockHashes(chain) {
    let blocks = [];

    let currentHash = this.LastHash;

    while (true) {
      let block = this.deserialize(await this.DB.get(currentHash));

      blocks.push(block.Hash);

      currentHash = block.Header.PrevHash;

      if (block.Header.PrevHash == "") {
        break;
      }
    }

    return blocks;
  }

  async openDB(needToWrite) {
    this.DB = await createDB(this.Node, needToWrite);
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
