const {sha256} = require('js-sha256')



class Proof {
    
    difficulty = 5;

    constructor(block){
        this.block = block;
    }

    returnDifficulty() {
        return "".padStart(this.difficulty,"0")
    }

    initData(nonce){
        return this.block.PrevHash + this.block.hashTransactions() + this.toHex(nonce) + this.toHex(this.difficulty)
    }

    run(){

       let nonce = 0;
       let hash = '';

       while(true){
            let data = this.initData(nonce)
            hash = sha256(data)

            if(hash.startsWith(this.returnDifficulty(),0)){
                break
            }else{
                nonce++;
            }            
       }

       return {nonce,hash}
    }
    
    validate(){
        let data = this.initData(this.block.Nonce)
        let hash = sha256(data)

        return hash === this.block.hash
    }

    toHex(nonce){
        return nonce.toString(16)
    }
}


module.exports = { Proof }
