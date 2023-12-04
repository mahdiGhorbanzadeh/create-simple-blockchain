
const {sha256} = require('js-sha256');
const { Wallet,generatePublicKeyHash, base58Decode } = require('./wallet');


class TxOutput {
    constructor(value,pubKeyHash){
        this.Value = value;
        this.PubKeyHash = pubKeyHash;
    }
}

class TxInput {
    constructor(id,out,signature,pubKey){
        this.ID = id;
        this.Out = out;
        this.Signature = signature;
        this.PubKey = pubKey
    }
}


class Transaction {

    constructor(id,txInputs,txOutputs){
        this.ID = id;
        this.TxInputs = txInputs;
        this.TxOutputs = txOutputs;
    }

    getHash(){
      let txCopy = this;
      txCopy.ID = '';
      let hash = sha256(txCopy.serialize())

      return hash;
    }

    setID(){
        let enCodeTx = JSON.stringify(this);
        let hash = sha256(enCodeTx)
        this.ID = hash;
    }

    serialize(){
        return JSON.stringify(this)
    }

}


function coinbaseTx(to,data){
    if(!data){
        data = `Coins to ${to}`
    }
    
    let txin = new TxInput(0,-1,to);
    let txout = new TxOutput(100,to);
    

    let tx = new Transaction('',[txin],[txout])

    tx.setID();
    return tx;
}

function isCoinBaseTx(tx){
    return tx.TxInputs.length == 1 && tx.TxInputs[0].ID == 0  && tx.TxInputs[0].Out == -1;
}

function sign(tx,privKey,prevTXs){
    if(isCoinBaseTx(tx)){
        return
    }

    for(let i=0;i<tx.TxInputs.length;i++){
        if(prevTXs[JSON.stringify(tx.TxInputs[i].ID)].ID == null){
            console.log("previous transaction does not exist.")
        }
    }

    let txCopy = tx.TrimmedCopy()

    for (let i = 0; i < txCopy.TxInputs.length; i++) {
        let prevTX = prevTXs[JSON.stringify(txCopy.TxInputs[id].ID)]
        txCopy.TxInputs[i].Signature = '';
        txCopy.TxInputs[i].PubKey = prevTX.TxOutputs[txCopy.TxInputs[].]
    }
}

function usesKey(input,pubKeyHash){
    let lockingHash = generatePublicKeyHash(input.PubKey);
    return Buffer.compare(lockingHash,pubKeyHash); 
}

function lock(output,address){
    let pubKeyHash = base58Decode(address);
    pubKeyHash = pubKeyHash[1,pubKeyHash.length-4];
    output.PubKeyHash = pubKeyHash;

    return output;
}

function isLockedWithKey(output,pubKeyHash){
   return Buffer.compare(output.PubKeyHash,pubKeyHash)==0
}

function canUnlock(input,data){
    return input.Sig == data
}

function canBeUnlocked(output,data){
    return output.PubKey == data
}

async function newTransaction(from,to,amount,blockchain){
    let inputs = [];
    let outputs = [];

    let {accumulated,unspentOuts} = await blockchain.findSpendableOutputs(from,amount)
    
    console.log("accumulated",accumulated)
    console.log("unspentOuts",unspentOuts)
    
    if(accumulated < amount){
        console.log("Error: not enough funds")
    }else {

        let keys = Object.keys(unspentOuts);

        console.log("keys",keys)
        for (let i = 0; i < keys.length; i++) {
            outs = unspentOuts[keys[i]];
            for (let j = 0; j < outs.length; j++) {
                inputs.push(new TxInput(keys[i],outs[j],from))
            }    
        }

        outputs.push(new TxOutput(amount, to))

        if(accumulated>amount){
            let returnAmount = accumulated - amount;
            outputs.push(new TxOutput(returnAmount.toString(), from))
        }

        let tx = new Transaction('',inputs,outputs)

        tx.setID();
        
        return tx
    }
}


module.exports = {
    Transaction,
    coinbaseTx,
    isCoinBaseTx,
    canUnlock,
    canBeUnlocked,
    newTransaction
}
