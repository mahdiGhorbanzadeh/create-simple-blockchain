const {Blockchain} = require('./blockchain')




function main(){
   let blockchain = new Blockchain()
   
   blockchain.addBlock("First block after Genesis")
   blockchain.addBlock("Second block after Genesis")
   blockchain.addBlock("Third block after Genesis")

   blockchain.Blocks.map(item=>{
     console.log("item",item)
   })
}

main()