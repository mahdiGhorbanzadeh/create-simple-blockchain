const { Block } = require("./block");
const { Proof } = require("./proof");

function createTimeStamp() {
  return BigInt(new Date().getTime()).toString();
}

function createBlock(txs, prevHash, height) {
  let block = new Block(createTimeStamp(), "", txs, prevHash, 0, height);
  let pow = new Proof(block);
  let res = pow.run();

  block.Header.Nonce = res.nonce;
  block.Hash = res.hash;

  return block;
}

process.on("message", (data) => {
  const block = createBlock(data.txs, data.prevHash, data.height + 1);

  console.log("block mine worker", block);

  process.send({ block, lastHeight: data.height });

  process.exit();
});
