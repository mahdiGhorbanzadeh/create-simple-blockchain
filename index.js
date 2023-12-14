const {Blockchain} = require('./blockchain')
const {DB} = require("./db")
const {newTransaction} = require("./transaction")
const { UTXOSet } = require('./utxo')
const {Wallet} = require("./wallet")
const { Wallets } = require('./wallets')

async function main(){

   let address = "1KjEwXdZPHk2od3ztmAJQenXWkLQtHm7YX";


   let blockchain = new Blockchain(address);
  
   await new Promise(resolve => setTimeout(resolve, 1000));

   // ------------------ create blockchain 

   blockchain.initBlockchain(address);

   await new Promise(resolve => setTimeout(resolve, 1000));

   

   let from = "1KjEwXdZPHk2od3ztmAJQenXWkLQtHm7YX";

   let to = "17nL68bqPqMTNPC8D8YXHmkwEUYbVresUh";

   let amount = 30;


   

   // await new Promise(resolve => setTimeout(resolve, 1000));



   // let tx = await newTransaction("jonatan","ali","50",blockchain)

   // await blockchain.addBlock([tx])
   
   // console.log("...............................................")

   await new Promise(resolve => setTimeout(resolve, 1000));


   blockchain.iterate();

   await new Promise(resolve => setTimeout(resolve, 1000));

   let utxo = new UTXOSet(blockchain);

   await utxo.reIndex();

   await new Promise(resolve => setTimeout(resolve, 1000));

   let tx = await newTransaction(from, to, amount, utxo);

   console.log("tx",tx);




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


   //----------------------------------------

   // let wallets = new Wallets()

   // await wallets.loadFile()

   // let my_wallet = wallets.getWallet(address)

   // let wallet = new Wallet()

   // wallet.updateWallet(my_wallet.PublicKey,my_wallet.PrivateKey);


   // let hash = wallet.base58Decode("171WnfYxrM9VZv3e1m8Sd8RqWHvmfgGxTe")

   // console.log("hash",hash)

   
   // let address = wallets.addWallet()

   // console.log("address",address)

   // let address2 = wallets.addWallet()

   // console.log("address2",address2)

   // wallets.saveFile()

   //-----------------------------------------

   // wallets.loadFile()

   // console.log("wallets",JSON.stringify(wallets.wallets,null,2))

}


async function createWallet(){
   let wallets = new Wallets()

   let address = wallets.addWallet()

   console.log("address",address)

   let address2 = wallets.addWallet()

   console.log("address2",address2)

   wallets.saveFile()
}

async function createBlockChain(){

   let wallets = new Wallets()

   await wallets.loadFile()

   let address = wallets.wallets[0]


   // let blockchain = new Blockchain(address);


}


createWallet();

// main()