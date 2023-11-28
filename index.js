const {Blockchain} = require('./blockchain')
const {DB} = require("./db")
const {Wallet} = require("./wallet")


async function main(){
   //    let blockchain = new Blockchain()
   
   //    await new Promise(resolve => setTimeout(resolve, 1000));

   //   //  blockchain.addBlock("First block after Genesis")
   //   //  blockchain.addBlock("Second block after Genesis")
   //   //  blockchain.addBlock("Third block after Genesis")
   
   //    blockchain.iterate()

   console.log("Wallet",new Wallet())

}

main()