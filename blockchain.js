
const {Block} = require('./block')
const {Proof} = require("./proof")


class Blockchain {
    constructor(){
        this.Blocks = [this.createBlock("Genesis",'')];
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
        let prevBlock = this.Blocks[this.Blocks.length-1];
        let newBlock = this.createBlock(data,prevBlock.Hash)
        this.Blocks.push(newBlock);
    }
}

module.exports = { Blockchain }

