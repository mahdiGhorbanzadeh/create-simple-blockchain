

class Block {
    constructor(Hash,Data,PrevHash,Nonce){
        this.Hash = Hash;
        this.Data = Data;
        this.PrevHash =PrevHash;
        this.Nonce = Nonce; 
    }
}


module.exports = { Block }
