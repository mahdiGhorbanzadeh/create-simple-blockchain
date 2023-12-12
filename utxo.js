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

      for (let outIdx = 0; outIdx < outs.length; outIdx++) {
        const out = outs[outIdx];

        if (isLockedWithKey(out,pubKeyHash) && accumulated < amount) {

          accumulated += Number(out.Value);

          if (!unspentOuts[txID]) {
            unspentOuts[txID] = [];
          }

          unspentOuts[txID].push(outIdx);

          if(accumulated>Number(amount)){
            break;
          }

        }
      }
    }

    return { accumulated, unspentOuts };
  }


  async findUTXO(pubKeyHash) {
    let UTXOs = []
    
    // Use LevelDB iterator to traverse the database
    const iterator = db.iterator({ gte: this.utxoPrefix });

    for await (const { key, value } of iterator) {
      
      const txID = key.substring(this.utxoPrefix.length);

      const outs = deserializeOutputs(value);

      for (let outIdx = 0; outIdx < outs.length; outIdx++) {
        const out = outs[outIdx];

        if (isLockedWithKey(out,pubKeyHash)) {
          if (!UTXOs[txID]) {
            UTXOs[txID] = [];
          }

          UTXOs[txID].push(outIdx);
        }
      }
    }

    return UTXOs
  }


  async countTransactions(){
    
    let counter = 0;

    const iterator = db.iterator({ gte: this.utxoPrefix });

    for await (const { key } of iterator) {

      if (!key.startsWith(utxoPrefix)) {
        throw "error key was not have prefix !!!!"
      }

      counter++;
    }

    return counter;
  }


  async reIndex() {
 
    const UTXO = this.blockchain.findUTXO(); 
  
    // Delete existing keys with the given prefix
    await deleteByPrefix(utxoPrefix);
  
    
    const batchOps = [];


    for (let i = 0; i < UTXO.length; i++) {
      const element = array[i];
      
    }
  
    for (const [txId, outs] of UTXO) {
      const key = utxoPrefix + key;
      batchOps.push({ type: 'put', key, value: serializeOutputs(outs) });
    }
  
    await db.batch(batchOps);
  }


  async deleteByPrefix(prefix) {

    const deleteKeys = async (keysForDelete) => {
      await db.batch(keysForDelete.map(key => ({ type: 'del', key })));
    };
  
    const collectSize = 100000;
    const keysForDelete = [];
  
    const iterator = db.iterator({ gte: prefix });
  
    for await (const { key } of iterator) {
      if (!key.startsWith(prefix)) {
        throw "error key was not have prefix !!!! (deleteByPrefix)"
      }
  
      keysForDelete.push(key);
  
      if (keysForDelete.length === collectSize) {
        await deleteKeys(keysForDelete);
        keysForDelete.length = 0; // Reset the array
      }
    }
  
    // Delete remaining keys
    if (keysForDelete.length > 0) {
      await deleteKeys(keysForDelete);
    }
  }






  deserializeOutputs(outputs){
    return JSON.parse(outputs)
  }
  
}

