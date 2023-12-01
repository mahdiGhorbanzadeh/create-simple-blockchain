const {Blockchain} = require('./blockchain')
const {DB} = require("./db")
const {newTransaction} = require("./transaction")
const {Wallet} = require("./wallet")

async function main(){

   let blockchain = new Blockchain("jonatan")
  
   await new Promise(resolve => setTimeout(resolve, 1000));

   
   // let tx = await newTransaction("jonatan","ali","50",blockchain)

   // blockchain.addBlock([tx])
   
   // console.log("...............................................")

   // let tx2 = await newTransaction("jonatan","mahdi","25",blockchain)

   // blockchain.addBlock([tx2])

   // let tx3 = await newTransaction("ali","mahdi","25",blockchain)

   // blockchain.addBlock([tx3])


   // blockchain.addBlock("First block after Genesis")
  //  blockchain.addBlock("Second block after Genesis")
  //  blockchain.addBlock("Third block after Genesis")
  
   // let x = await blockchain.findUTXO("mahdi")

   // console.log("x",x)

   
   // blockchain.iterate()

   let wallet = new Wallet();
   
}

main()