const {Blockchain} = require('./blockchain')
const {DB} = require("./db")
const {newTransaction} = require("./transaction")
const {Wallet} = require("./wallet")
const { Wallets } = require('./wallets')

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

   let wallets = new Wallets();
   
   // let address = wallets.addWallet()

   // console.log("address",address)

   // let address2 = wallets.addWallet()

   // console.log("address2",address2)

   wallets.loadFile()

   console.log("wallets",JSON.stringify(wallets.wallets,null,2))

}

main()