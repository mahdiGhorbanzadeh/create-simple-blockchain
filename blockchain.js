
const {Block} = require('./block')
const {Proof} = require("./proof")
const {DB,LH_KEY} = require('./db')
const {coinbaseTx,canBeUnlocked,isCoinBaseTx} = require("./transaction")
class Blockchain {
    constructor(address){
        this.initBlockchain(address)
    }

    async initBlockchain(address){
        try{
            let res = await DB.get(LH_KEY)
            this.LastHash = res;
        }catch(e){
            if(e.code == "LEVEL_NOT_FOUND"){
                let cbtx = coinbaseTx(address,'')
                let block = this.createBlock([cbtx],'');
                console.log("block.Hash",block.Hash)
                DB.put(block.Hash,this.serialize(block))
                DB.put(LH_KEY,block.Hash)  
            }
        }  
    }

    createBlock(txs,prevHash){
        let block = new Block('',txs,prevHash,0)
        let pow = new Proof(block) 
        let res = pow.run()

        block.Nonce = res.nonce
        block.Hash = res.hash;
        
        return block;
    }

    addBlock(data){
        let newBlock = this.createBlock(data,this.LastHash)
        console.log("newBlock.Hash",newBlock.Hash)
        this.LastHash = newBlock.Hash
        DB.put(LH_KEY,newBlock.Hash)
        DB.put(newBlock.Hash,this.serialize(newBlock))
    }

    serialize(block){
      return JSON.stringify(block)
    }

    deserialize(data){
      return JSON.parse(data)
    }

    async findUTXO(address) {
        let UTXOs = []

        let unspentTxs = await this.findUnspentTransactions(address)

        for (let i = 0; i < unspentTxs.length; i++) {
            unspentTxs[i].TxOutputs.map(item=>{
               if(canBeUnlocked(item,address)){
                  UTXOs.push(item)
               }    
            })
        }

        return UTXOs
    }

    async findSpendableOutputs(address,amount){

        let unspentOuts = {};

        let unspentTxs = await this.findUnspentTransactions(address);

        let accumulated = 0;

        unspentTxs.map(tx=>{
            for (let i = 0; i < tx.TxOutputs.length; i++) {
                if(canBeUnlocked(tx.TxOutputs[i],address) 
                    && accumulated < Number(amount)){
                    accumulated += Number(tx.TxOutputs[i].Value);

                    if(unspentOuts[tx.ID]){
                        unspentOuts[tx.ID].push(i) 
                    }else{
                        unspentOuts[tx.ID] = [i]    
                    }

                    if(accumulated>Number(amount)){
                        break;
                    }
                }

            }
        })

        return {
            accumulated,
            unspentOuts
        }

    }

    async findUnspentTransactions(address){
        let currentHash = this.LastHash;

        let unspentTxs = []
        let spentTXOs = {}

        while(true){
            let block = this.deserialize(await DB.get(currentHash));
            
            block.Transactions.map(tx=>{
                for (let i = 0; i < tx.TxOutputs.length; i++) {
                    if(spentTXOs[tx.ID]){
                        
                        let spendOuts = spentTXOs[tx.ID]?spentTXOs[tx.ID]:[];

                        for (let j = 0; j < spendOuts.length; j++) {
                            if(spendOuts[j]==i){
                                continue;
                            }
                        }
                    }

                    if(canBeUnlocked(tx.TxOutputs[i],address)){
                        unspentTxs.push(tx)
                    }

                }

                if(!isCoinBaseTx(tx)){
                    for (let j = 0; j < tx.TxInputs.length; j++) {
                        let intxId = tx.TxInputs[j].ID
                        
                        if(spentTXOs[intxId]){
                            spentTXOs[intxId].push(intxId) 
                        }else{
                            spentTXOs[intxId] = [intxId]    
                        }
                    }
                }
            })


            
            currentHash = block.PrevHash
            
            if(block.PrevHash == ''){
                break;
            }
        }

        return unspentTxs;
    }

    async signTransaction(tx,privKey){
        let prevTXs = {}

        for (let i = 0; i < tx.TxInputs.length; i++) {
            
            let prevTX = c
        }
    }

    async iterate(){
        let currentHash = this.LastHash;
        console.log("currentHash",currentHash)
        while(true){
            let block = this.deserialize(await DB.get(currentHash));

            console.log(".............................................");

            console.log("Block",JSON.stringify(block,null,2));
   
            currentHash = block.PrevHash
            
            if(block.PrevHash == ''){
                break;
            }
        }

    }

 
}

module.exports = { Blockchain }

