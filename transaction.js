
const {sha256} = require('js-sha256')


class TxOutput {
    constructor(value,pubKey){
        this.Value = value;
        this.PubKey = pubKey;
    }
}

class TxInput {
    constructor(id,out,sig){
        this.ID = id;
        this.Out = out;
        this.Sig = sig;
    }
}


class Transaction {

    constructor(id,txInputs,txOutputs){
        this.ID = id;
        this.TxInputs = txInputs;
        this.TxOutputs = txOutputs;
    }

    setID(){
        let enCodeTx = JSON.stringify(this);
        let hash = SHA256(enCodeTx)
        this.ID = hash;
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

function canUnlock(input,data){
    return input.Sig == data
}

function canBeUnlocked(output,data){
    return output.PubKey == data
}

async function newTransaction(from,to,amount,blockchain){
    let inputs = [];
    let outputs = [];

    let {acc,validOutputs} = await blockchain.findSpendableOutputs(from,amount)

    if(acc < amount){
        console.log("Error: not enough funds")
    }else {
        return tx
    }
}


module.exports = {
    Transaction,
    coinbaseTx,
    isCoinBaseTx,
    canUnlock,
    canBeUnlocked
}
