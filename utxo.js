const {DB,LH_KEY} = require('./db')


class UTXOSet {
  constructor(blockchain) {
    this.blockchain = blockchain;
    this.utxoPrefix = 'UTXO-';
  }

  async findSpendableOutputs(pubKeyHash, amount) {
    let unspentOuts = {};
    let accumulated = 0;

    // Use LevelDB iterator to traverse the database
    const iterator = db.iterator({ gte: this.utxoPrefix });

    for await (const { key, value } of iterator) {
      const txID = key.substring(this.utxoPrefix.length);
      const outs = deserializeOutputs(value);

      for (let outIdx = 0; outIdx < outs.outputs.length; outIdx++) {
        const out = outs.outputs[outIdx];

        if (isLockedWithKey(out,pubKeyHash) && accumulated < amount) {
          accumulated += out.Value;
          if (!unspentOuts[txID]) {
            unspentOuts[txID] = [];
          }
          unspentOuts[txID].push(outIdx);
        }
      }
    }

    return { accumulated, unspentOuts };
  }

//   serialize(block){
//     return JSON.stringify(block)
//   }

  deserializeOutputs(outputs){
    return JSON.parse(outputs)
  }
  
}

