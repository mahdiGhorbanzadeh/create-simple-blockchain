const { sha256 } = require("js-sha256");

class Proof {
  difficulty = 5;

  constructor(block) {
    this.block = block;
  }

  returnDifficulty() {
    return "".padStart(this.difficulty, "0");
  }

  initData() {
    return this.block.hashTransactions() + this.toHex(this.difficulty);
  }

  run() {
    let nonce = 0;
    let hash = "";

    while (true) {
      this.block.Header.Nonce = nonce;

      let data = this.initData();

      hash = sha256(data);

      if (hash.startsWith(this.returnDifficulty(), 0)) {
        break;
      } else {
        nonce++;
      }
    }

    return { nonce, hash };
  }

  validate() {
    let data = this.initData();
    let hash = sha256(data);

    return hash === this.block.Hash;
  }

  validateProof() {
    if (this.block.Hash.startsWith(this.returnDifficulty(), 0)) {
      return true;
    } else {
      return false;
    }
  }

  toHex(nonce) {
    return nonce.toString(16);
  }
}

module.exports = { Proof };
