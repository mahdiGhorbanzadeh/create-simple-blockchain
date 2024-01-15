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
let chain;

class Addr {
  constructor(addrList = []) {
    this.AddrList = addrList;
  }
}
class Block {
  constructor(addrFrom = "", block) {
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

function sendBlock(addr, block) {
  const data = new Block(nodeAddress, block);

  const payload = JSON.stringify(data);

  const request = Buffer.concat([cmdToBytes("block"), Buffer.from(payload)]);

  sendData(addr, request);
}

function sendData(addr, data) {
  const client = new net.Socket();

  client.on("error", (err) => {
    console.log(`${addr} is not available`);
    let updatedNodes = KnownNodes.filter((node) => node !== addr);
    KnownNodes = updatedNodes;
    client.destroy();
  });

  console.log("addr", addr);

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

async function sendVersion(addr) {
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

async function handleBlock(request) {
  console.log("------------------handleBlock-------------------------");

  const commandLength = 12;

  const payload = JSON.parse(request.slice(commandLength).toString());

  console.log("payload", payload);

  const blockData = payload.Block;

  const blocks = blockData;

  console.log("Received a new block list! ", blocks);

  let res = await chain.addBlock(blocks);

  if (res == "fork") {
    console.log("-----------------------------forked");
    reorganizationmode = true;
    blocksInTransit = [];
    await sendVersion(payload.AddrFrom, chain);
    return;
  } else {
    blocksInTransit = blocksInTransit.slice(16);
  }

  console.log(`Added block ${blocks}`);

  if (blocksInTransit.length > 0) {
    sendGetData(payload.AddrFrom, "block", blocksInTransit.slice(0, 16));
  } else {
    const utxo = new UTXOSet(chain);
    await utxo.reIndex();
  }
}

async function handleInv(request) {
  console.log("------------------handleInv-------------------------");

  const commandLength = 12;

  const payload = JSON.parse(request.slice(commandLength).toString());

  console.log(
    `Received inventory with ${payload.Items.length} ${payload.Type}`
  );

  if (payload.Type === "header") {
    console.log(
      " handle inv reorganizationHeaders",
      reorganizationHeaders,
      payload
    );

    if (reorganizationHeaders.length == 0) {
      sendGetData(payload.AddrFrom, "block", [payload.Items[0].Hash]);
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

async function handleGetBlocks(request) {
  console.log("------------------handleGetBlocks-------------------------");

  const commandLength = 12;

  const payload = JSON.parse(request.slice(commandLength).toString());

  const blocks = await chain.getBlockHashes();

  sendInv(payload.AddrFrom, "block", blocks);
}

async function handleGetAddress(request) {
  console.log("------------------handleGetAddress-------------------------");

  const commandLength = 12;

  const payload = JSON.parse(request.slice(commandLength).toString());

  sendInv(payload.AddrFrom, "addr", KnownNodes);

  console.log(`Sending data to ${payload.AddrFrom}:`, KnownNodes);
}

async function handleGetHeaders(request) {
  console.log("------------------handleGetHeaders-------------------------");

  const commandLength = 12;

  const payload = JSON.parse(request.slice(commandLength).toString());

  console.log("payload handleGetHeaders ", payload);

  const headers = await chain.getBlockHeaders(
    payload.FromHeaderHash,
    payload.StopHeaderHash
  );

  console.log("headers must be sent", headers, payload.AddrFrom);

  sendGetData(payload.AddrFrom, "header", headers);
}

async function handleGetData(request) {
  console.log("------------------handleGetData-------------------------");

  const commandLength = 12;

  const payload = JSON.parse(request.slice(commandLength).toString());

  if (payload.kind === "header") {
    reorganizationHeaders = reorganizationHeaders.concat(payload.id);
    console.log("payload.id.length", payload.id.length);
    if (payload.id.length == 100) {
      sendGetHeaders(
        payload.nodeAddress,
        payload.id[payload.id.length - 1].Hash,
        ""
      );
    } else {
      console.log("finish send header");
      await chain.checkSyncNodeHeaders(reorganizationHeaders);

      let height = await chain.findCommonPointWithSyncNode(
        reorganizationHeaders
      );

      console.log(" findCommonPointWithSyncNode height ", height);

      reorganizationHeaders = reorganizationHeaders.slice(height - 1);

      blocksInTransit = await chain.getHeadersHashFromHeaders(
        reorganizationHeaders
      );

      console.log(
        "blocksInTransit blocksInTransit blocksInTransit blocksInTransit",
        blocksInTransit.slice(0, 16)
      );

      sendGetData(payload.nodeAddress, "block", blocksInTransit.slice(0, 16));

      reorganizationHeaders = [];
    }
  } else if (payload.kind === "block") {
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

async function handleTx(request) {
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

async function mineTxInterval() {
  while (true) {
    if (isRunning) {
      console.log(
        "---------------------------- start to mine ------------------------"
      );

      await mineTx();

      console.log(
        "---------------------------- end mine ------------------------"
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait for 2 seconds
  }
}

function pauseFunction() {
  isRunning = false;
  console.log("mine paused.");
}

function resumeFunction() {
  isRunning = true;
  console.log("mine resumed.");
}

async function mineTx() {
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
      sendInv(node, "header", [
        { Hash: newBlock.Hash, Header: newBlock.Header },
      ]);
    }
  }
}

async function handleVersion(request) {
  console.log("------------------handleVersion-------------------------");

  const payload = JSON.parse(request.slice(COMMAND_LENGTH).toString());

  const bestHeight = await chain.getBestHeight();

  console.log("bestHeight", bestHeight);

  const otherHeight = payload.BestHeight;

  console.log("otherHeight", payload, otherHeight);

  if (bestHeight < otherHeight) {
    await sendGetHeaders(
      payload.AddrFrom,
      await chain.getBlockWithHeight(1),
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

async function handleConnection(data) {
  console.log("------------------handleConnection-------------------------");

  const commandLength = 12;
  const command = bytesToCmd(data.slice(0, commandLength));
  console.log(`Received ${command} command`);

  switch (command) {
    case "block":
      await handleBlock(data);
      break;
    case "inv":
      await handleInv(data);
      break;
    case "getheaders":
      await handleGetHeaders(data);
      break;
    case "getaddress":
      await handleGetAddress(data);
      break;
    case "getblocks":
      await handleGetBlocks(data);
      break;
    case "getdata":
      await handleGetData(data);
      break;
    case "tx":
      await handleTx(data);
      break;
    case "version":
      await handleVersion(data);
      break;
    default:
      console.log("Unknown command");
  }
}

const startServer = async (nodeID, minerAddress, address) => {
  console.log("------------------startServer-------------------------");

  nodeAddress = `localhost:${nodeID}`;
  mineAddress = minerAddress;

  chain = new Blockchain(address, nodeID);

  await chain.continueBlockchain(true);

  if (nodeAddress != KnownNodes[0]) {
    console.log("----------------run here--------------------------");

    await sendGetAddress(KnownNodes[0]);

    await sendVersion(KnownNodes[0], chain);
  } else {
    // mineTxInterval();
    // resumeFunction();
  }

  const server = net.createServer(async (socket) => {
    console.log("New connection established");

    socket.on("data", async (data) => {
      await handleConnection(data);
    });

    socket.on("error", (err) => {
      console.error("Connection error:", err);
    });

    socket.on("close", () => {
      console.log("Connection closed");
    });
  });

  server.on("error", async (err) => {
    await chain.closeDB();
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
