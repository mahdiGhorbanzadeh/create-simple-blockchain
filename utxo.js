const {DB,LH_KEY} = require('./db');
const { isLockedWithKey } = require('./transaction');


class UTXOSet {
  constructor(blockchain) {
    this.blockchain = blockchain;
    this.utxoPrefix = 'UTXO-';
  }

  async findSpendableOutputs(pubKeyHash, amount) {
    let unspentOuts = {};
    let accumulated = 0;

    // Use LevelDB iterator to traverse the database
    const iterator = DB.iterator({ gte: this.utxoPrefix , lte: this.utxoPrefix + '\xff' });

    for await (const [key, value] of iterator) {
      
      const txID = key.substring(this.utxoPrefix.length);

      const outs = this.deserializeOutputs(value);

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
    
    const iterator = DB.iterator({ gte: this.utxoPrefix , lte: this.utxoPrefix + '\xff' });

    for await (const [key, value] of iterator) {
      
      const txID = key.substring(this.utxoPrefix.length);

      console.log("txID",txID);

      const outs = this.deserializeOutputs(value);

      console.log("outs",outs);

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

    console.l
    return UTXOs
  }


  async countTransactions(){
    
    let counter = 0;

    const iterator = DB.iterator({ gte: this.utxoPrefix, lte: this.utxoPrefix + '\xff' });

    for await (const [key] of iterator) {

      if (!key.startsWith(utxoPrefix)) {
        throw "error key was not have prefix !!!!"
      }

      counter++;
    }

    return counter;
  }


  async reIndex() {
 
    const utxos = await this.blockchain.findUTXODB(); 
  
    await this.deleteByPrefix(this.utxoPrefix);
    
    const batchOps = [];

    for (const [key, value] of Object.entries(utxos)) {
      
      let final_key = this.utxoPrefix + key;
      
      batchOps.push({ type: 'put', key:final_key, value: this.serializeOutputs(value) });
    }
  
    await DB.batch(batchOps);
  }


  async deleteByPrefix(prefix) {

    const deleteKeys = async (keysForDelete) => {
      await DB.batch(keysForDelete.map(key => ({ type: 'del', key })));
    };
  
    const collectSize = 100000;
    const keysForDelete = [];

  
    const iterator = DB.iterator({ gte: prefix, lte: prefix + '\xff' });
    
    for await (const [key, value] of iterator) {

      if (!key.startsWith(prefix)) {
        throw "error key was not have prefix !!!! (deleteByPrefix)"
      }
  
      keysForDelete.push(key);
  
      if (keysForDelete.length === collectSize) {
        await deleteKeys(keysForDelete);
        keysForDelete.length = 0;
      }
    }

    if (keysForDelete.length > 0) {
      await deleteKeys(keysForDelete);
    }
  }

  deserializeOutputs(outputs){
    return JSON.parse(outputs)
  }

  serializeOutputs(outputs){
    return JSON.stringify(outputs)
  }
  
}


module.exports = {
  UTXOSet
}

