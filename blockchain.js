
const {Block} = require('./block')
const {Proof} = require("./proof")
const {DB,LH_KEY} = require('./db')

class Blockchain {
    constructor(){
        this.initBlockchain()
    }

    async initBlockchain(){
        try{
            let res = await DB.get(LH_KEY)
            console.log("res",res)
            this.LastHash = res;
        }catch(e){
            if(e.code == "LEVEL_NOT_FOUND"){
                let block = this.createBlock("Genesis",'');
                console.log("block.Hash",block.Hash)
                DB.put(block.Hash,this.serialize(block))
                DB.put(LH_KEY,block.Hash)  
            }
        }  
    }

    createBlock(data,prevHash){
        let block = new Block('',data,prevHash,0)
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

    async iterate(){
        let currentHash = this.LastHash;
        console.log("currentHash",currentHash)
        while(true){
            let block = this.deserialize(await DB.get(currentHash));
            
            console.log("block",block);
            
            currentHash = block.PrevHash
            
            if(block.PrevHash == ''){
                break;
            }
        }

    }
}

module.exports = { Blockchain }

