const net = require("net");
const { Readable } = require("stream");
const { Blockchain } = require("../blockchain");
const { UTXOSet } = require("../utxo");
const {
  deserializeTransaction,
  Transaction,
  coinbaseTx,
} = require("../transaction");

const COMMAND_LENGTH = 12;
const VERSION = 1;

let nodeAddress = "";
let mineAddress = "";
let KnownNodes = ["localhost:3000"];
let blocksInTransit = [];
let reorganizationHeaders = [];
let memoryPool = {};
let reorganizationmode = false;
let intervalId;
let isRunning = false;

class Addr {
  constructor(addrList = []) {
    this.AddrList = addrList;
  }
}
class Block {
  constructor(addrFrom = "", block = Buffer.alloc(0)) {
    this.AddrFrom = addrFrom;
    this.Block = block;
  }
}
class GetData {
  constructor(addrFrom = "", type = "", id = []) {
    this.AddrFrom = addrFrom;
    this.Type = type;
    this.ID = id;
  }
}
class Inv {
  constructor(addrFrom = "", type = "", items = []) {
    this.AddrFrom = addrFrom;
    this.Type = type;
    this.Items = items;
  }
}
class Tx {
  constructor(addrFrom = "", transaction = Buffer.alloc(0)) {
    this.AddrFrom = addrFrom;
    this.Transaction = transaction; // Initialize with an empty Buffer or provided transaction data
  }
}
class Version {
  constructor(version = 0, bestHeight = 0, addrFrom = "") {
    this.Version = version;
    this.BestHeight = bestHeight;
    this.AddrFrom = addrFrom;
  }
}

function cmdToBytes(cmd) {
  const bytes = Buffer.alloc(COMMAND_LENGTH);
  bytes.write(cmd);
  return bytes;
}

function bytesToCmd(bytes) {
  let cmd = "";

  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] !== 0x0) {
      cmd += String.fromCharCode(bytes[i]);
    }
  }

  return cmd;
}

function extractCmd(request) {
  const commandLength = 12; // Define your command length here

  return request.slice(0, commandLength);
}

function requestBlocks() {
  KnownNodes.forEach((node) => {
    sendGetBlocks(node);
  });
}

function sendBlock(addr, block) {
  const data = new Block(nodeAddress, block);
  const payload = JSON.stringify(data);
  const request = Buffer.concat([cmdToBytes("block"), Buffer.from(payload)]);

  sendData(addr, request);
}

// first try to connect destination node
// if success send data with dataStream
// if fail remove node from node list

function sendData(addr, data) {
  const client = new net.Socket();

  client.on("error", (err) => {
    console.log(`${addr} is not available`);
    let updatedNodes = KnownNodes.filter((node) => node !== addr);
    KnownNodes = updatedNodes;
    client.destroy();
  });

  client.connect({ port: addr.split("localhost:")[1] }, () => {
    const dataStream = new Readable();
    dataStream.push(data);
    dataStream.push(null);

    dataStream.pipe(client);
  });

  client.on("close", () => {
    console.log("Connection closed");
  });
}

function sendInv(address, kind, items) {
  console.log("------------------sendInv-------------------------");
  const inventory = {
    AddrFrom: nodeAddress,
    Type: kind,
    Items: items,
  };

  const payload = JSON.stringify(inventory);

  const request = Buffer.concat([cmdToBytes("inv"), Buffer.from(payload)]);

  sendData(address, request);
}

function sendGetData(address, kind, id) {
  console.log(
    `------------------ sendGetData ${kind} -------------------------`
  );
  const payload = GobEncode({ nodeAddress, kind, id });
  const request = Buffer.concat([cmdToBytes("getdata"), payload]);

  sendData(address, request);
}

function sendGetBlocks(address, headers) {
  console.log("------------------sendGetBlocks-------------------------");

  const payload = JSON.stringify({
    AddrFrom: nodeAddress,
    HeaderHash: headers,
  });

  const request = Buffer.concat([
    cmdToBytes("getblocks"),
    Buffer.from(payload),
  ]);

  sendData(address, request);
}

function sendGetHeaders(address, fromHeaderHash, stopHeaderHash) {
  console.log("------------------sendGetHeaders-------------------------");

  const payload = JSON.stringify({
    AddrFrom: nodeAddress,
    FromHeaderHash: fromHeaderHash,
    StopHeaderHash: stopHeaderHash,
  });

  const request = Buffer.concat([
    cmdToBytes("getheaders"),
    Buffer.from(payload),
  ]);

  sendData(address, request);
}

function sendGetAddress(address) {
  console.log("------------------sendGetAddress-------------------------");

  const payload = JSON.stringify({
    AddrFrom: nodeAddress,
  });

  const request = Buffer.concat([
    cmdToBytes("getaddress"),
    Buffer.from(payload),
  ]);

  sendData(address, request);
}

function sendTx(addr, tnx) {
  console.log("------------------sendTx-------------------------");

  const serializedTx = tnx.serialize ? tnx.serialize() : tnx;

  const data = {
    AddrFrom: nodeAddress,
    Transaction: serializedTx,
  };

  const payload = JSON.stringify(data);

  const request = Buffer.concat([cmdToBytes("tx"), Buffer.from(payload)]);

  sendData(addr, request);
}

async function sendVersion(addr, chain) {
  console.log(
    `------------------ sendVersion ${addr}-------------------------`
  );

  const bestHeight = await chain.getBestHeight();

  const payload = JSON.stringify({
    Version: VERSION,
    BestHeight: bestHeight,
    AddrFrom: nodeAddress,
  });

  const request = Buffer.concat([cmdToBytes("version"), Buffer.from(payload)]);

  sendData(addr, request);
}

async function handleBlock(request, chain) {
  console.log("------------------handleBlock-------------------------");

  const commandLength = 12;

  const payload = JSON.parse(request.slice(commandLength).toString());

  console.log("payload", payload);

  const blockData = payload.Block;

  const blocks = blockData;

  console.log("Received a new block list! ");

  let res = await chain.addBlock(blocks);

  if (res == "fork") {
    reorganizationmode = true;
    blocksInTransit = [];
    sendVersion(payload.addrFrom, chain);
  } else {
    blocksInTransit = blocksInTransit.slice(16);
  }

  console.log(`Added block ${block.Hash}`);

  if (blocksInTransit.length > 0) {
    sendGetData(payload.AddrFrom, "block", blocksInTransit.slice(0, 16));
  } else {
    const utxo = new UTXOSet(chain);
    await utxo.reIndex();
  }
}

async function handleInv(request, chain) {
  console.log("------------------handleInv-------------------------");

  const commandLength = 12;

  const payload = JSON.parse(request.slice(commandLength).toString());

  console.log(
    `Received inventory with ${payload.Items.length} ${payload.Type}`
  );

  if (payload.Type === "header") {
    reorganizationHeaders = reorganizationHeaders.concat(payload.Items);
    if (payload.Items.length == 100) {
      sendGetHeaders(
        payload.AddrFrom,
        payload.Items[payload.Items.length - 1].Hash,
        ""
      );
    } else {
      await chain.checkSyncNodeHeaders(reorganizationHeaders);

      let height = await chain.findCommonPointWithSyncNode(
        reorganizationHeaders
      );

      reorganizationHeaders = reorganizationHeaders.slice(height - 1);

      blocksInTransit = await chain.getHeadersHashFromHeaders(
        reorganizationHeaders
      );

      const utxo = new UTXOSet(chain);

      await utxo.reIndex();

      sendGetData(payload.AddrFrom, "block", blocksInTransit.slice(0, 16));

      reorganizationHeaders = [];
    }
  }

  if (payload.Type === "addr") {
    let nodeList = payload.Items;
    nodeList.map((item) => {
      if (!KnownNodes.includes(item) && item != nodeAddress) {
        KnownNodes.push(item);
      }
    });
  }

  if (payload.Type === "block") {
    blocksInTransit = payload.Items;

    const blockHash = payload.Items[0];

    sendGetData(payload.AddrFrom, "block", blockHash);

    let list = [];

    for (let i = 0; i < blocksInTransit.length; i++) {
      if (blocksInTransit[i] !== blockHash) {
        list.push(blocksInTransit[i]);
      }
    }

    const newInTransit = list;

    blocksInTransit = newInTransit;
  }

  if (payload.Type === "tx") {
    const txID = payload.Items[0];

    if (!memoryPool[txID]) {
      sendGetData(payload.AddrFrom, "tx", txID);
    }
  }
}

async function handleGetBlocks(request, chain) {
  console.log("------------------handleGetBlocks-------------------------");

  const commandLength = 12;

  const payload = JSON.parse(request.slice(commandLength).toString());

  const blocks = await chain.getBlockHashes();

  sendInv(payload.AddrFrom, "block", blocks);
}

async function handleGetAddress(request, chain) {
  console.log("------------------handleGetAddress-------------------------");

  const commandLength = 12;

  const payload = JSON.parse(request.slice(commandLength).toString());

  sendInv(payload.AddrFrom, "addr", KnownNodes);

  console.log(`Sending data to ${payload.AddrFrom}:`, KnownNodes);
}

async function handleGetHeaders(request, chain) {
  console.log("------------------handleGetHeaders-------------------------");

  const commandLength = 12;

  const payload = JSON.parse(request.slice(commandLength).toString());

  const headers = await chain.getBlockHeaders(
    payload.FromHeaderHash,
    payload.StopHeaderHash
  );

  sendInv(payload.AddrFrom, "header", headers);
}

async function handleGetData(request, chain) {
  console.log("------------------handleGetData-------------------------");

  const commandLength = 12;

  const payload = JSON.parse(request.slice(commandLength).toString());

  if (payload.kind === "block") {
    console.log("getBlock headerHash", payload.id);

    let blocks = await chain.getBlock(payload.id);

    sendBlock(payload.nodeAddress, blocks);
  } else if (payload.kind === "tx") {
    const txID = payload.id;
    const tx = memoryPool[txID];

    if (tx) {
      sendTx(payload.nodeAddress, tx);
    } else {
      console.error(`Transaction ${txID} not found in memory pool`);
    }
  }
}

async function handleTx(request, chain) {
  console.log("------------------ handleTx -------------------------");

  const commandLength = 12;

  const payload = JSON.parse(request.slice(commandLength).toString());

  const tx = deserializeTransaction(payload.Transaction);

  memoryPool[tx.ID] = tx;

  console.log(`${nodeAddress}, ${Object.keys(memoryPool).length}`);

  KnownNodes.forEach((node) => {
    if (node !== nodeAddress && node !== payload.AddrFrom) {
      sendInv(node, "tx", [tx.ID]);
    }
  });

  console.log("------------------finish handleTx-------------------------");
}

async function mineTxInterval(chain) {
  intervalId = setInterval(async () => {
    if (isRunning) {
      console.log(
        "---------------------------- start to mine ------------------------"
      );
      await mineTx(chain);

      console.log(
        "---------------------------- end mine ------------------------"
      );
    }
  }, 2000);
}

function pauseFunction() {
  isRunning = false;
  console.log("mine paused.");
}

function resumeFunction() {
  isRunning = true;
  console.log("mine resumed.");
}

async function mineTx(chain) {
  console.log("------------------mineTx-------------------------");

  const txs = [];

  for (const id in memoryPool) {
    console.log(`tx: ${memoryPool[id].ID}`);
    const tx = memoryPool[id];

    console.log("txxxxxxxxxxxxxxxxxx", tx);

    if (await chain.verifyTransaction(tx)) {
      txs.push(tx);
    }
  }

  const cbTx = coinbaseTx(mineAddress, "");

  txs.push(cbTx);

  const newBlock = await chain.mineBlock(txs);

  console.log("newBlock genrated");

  const utxo = new UTXOSet(chain);

  await utxo.reIndex();

  console.log("New Block mined");

  for (const tx of txs) {
    console.log("tx for delete from memory pool", tx.ID);
    const txID = tx.ID;
    delete memoryPool[txID];
  }

  for (const node of KnownNodes) {
    if (node !== nodeAddress) {
      sendInv(node, "block", [newBlock.Hash]);
    }
  }
}

async function handleVersion(request, chain) {
  console.log("------------------handleVersion-------------------------");

  const payload = JSON.parse(request.slice(COMMAND_LENGTH).toString());

  const bestHeight = await chain.getBestHeight();

  console.log("bestHeight", bestHeight);

  const otherHeight = payload.BestHeight;

  console.log("otherHeight", payload, otherHeight);

  if (bestHeight < otherHeight) {
    await sendGetHeaders(
      payload.AddrFrom,
      await chain.getBlockWithHeight(0),
      ""
    );
  } else if (bestHeight > otherHeight) {
    await sendVersion(payload.AddrFrom, chain);
  }

  if (!nodeIsKnown(payload.AddrFrom)) {
    KnownNodes.push(payload.AddrFrom);
    sendGetAddress(payload.AddrFrom);
  }
}

async function handleConnection(data, chain) {
  console.log("------------------handleConnection-------------------------");

  const commandLength = 12;
  const command = bytesToCmd(data.slice(0, commandLength));
  console.log(`Received ${command} command`);

  switch (command) {
    case "block":
      await handleBlock(data, chain);
      break;
    case "inv":
      await handleInv(data, chain);
      break;
    case "getheaders":
      await handleGetHeaders(data, chain);
      break;
    case "getaddress":
      await handleGetAddress(data, chain);
      break;
    case "getblocks":
      await handleGetBlocks(data, chain);
      break;
    case "getdata":
      await handleGetData(data, chain);
      break;
    case "tx":
      await handleTx(data, chain);
      break;
    case "version":
      await handleVersion(data, chain);
      break;
    default:
      console.log("Unknown command");
  }
}

const startServer = async (nodeID, minerAddress, address) => {
  console.log("------------------startServer-------------------------");

  nodeAddress = `localhost:${nodeID}`;
  mineAddress = minerAddress;

  if (nodeAddress != KnownNodes[0]) {
    console.log("----------------run here--------------------------");

    const chain = new Blockchain(address, nodeID);

    await chain.continueBlockchain(address);

    await sendGetAddress(KnownNodes[0]);

    await sendVersion(KnownNodes[0], chain);

    await chain.closeDB();
  } else {
    const chain = new Blockchain(address, nodeID);

    await chain.continueBlockchain(address);

    mineTxInterval(chain);
    resumeFunction();
  }

  const server = net.createServer(async (socket) => {
    console.log("New connection established");

    // if (nodeAddress !== KnownNodes[0]) {

    //   console.log("----------------run here--------------------------")

    //   const chain = new Blockchain(address, nodeID);

    //   await chain.continueBlockchain(address);

    //   await sendVersion(KnownNodes[0], chain);

    //   await chain.closeDB();
    // }

    socket.on("data", async (data) => {
      let chain = new Blockchain(address, nodeID);

      await chain.continueBlockchain(address);

      await handleConnection(data, chain);

      await chain.closeDB();
    });

    socket.on("error", (err) => {
      console.error("Connection error:", err);
    });

    socket.on("close", () => {
      console.log("Connection closed");
    });
  });

  server.on("error", (err) => {
    console.error("Server error:", err);
  });

  server.listen(nodeID, "localhost", () => {
    console.log(`Server running on localhost:${nodeID}`);
  });
};

function GobEncode(data) {
  try {
    const encodedData = JSON.stringify(data);
    return Buffer.from(encodedData);
  } catch (error) {
    console.error(error);
    return null;
  }
}

function nodeIsKnown(addr) {
  return KnownNodes.includes(addr);
}

module.exports = {
  startServer,
  sendTx,
  KnownNodes,
};
