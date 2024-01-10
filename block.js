const { sha256 } = require("js-sha256");
const { newMerkleTree } = require("./merkle");
const crypto = require("crypto");

class Block {
  constructor(
    Timestamp,
    Hash,
    Transactions,
    PrevHash,
    Nonce,
    Height,
    MerkleRoot = null
  ) {
    this.Hash = Hash;

    this.Header = {
      Timestamp: Timestamp,
      PrevHash: PrevHash,
      Nonce: Nonce,
      Height: Height,
      MerkleRoot: MerkleRoot,
    };

    this.Transactions = Transactions;
  }

  hashTransactions() {
    let hashes = [];

    if (!this.Header.MerkleRoot) {
      this.Transactions.map((item) => {
        hashes.push(item.ID);
      });

      let tree = newMerkleTree(hashes);

      this.Header.MerkleRoot = tree.rootNode.data;
    }

    const blockHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(this.Header))
      .digest("hex");

    return blockHash;
  }
}

module.exports = { Block };
