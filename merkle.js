const crypto = require('crypto');

class MerkleTree {
  constructor() {
    this.rootNode = null;
  }
}

class MerkleNode {
  constructor(left, right, data) {
    this.left = left;
    this.right = right;
    this.data = data;
  }
}

function newMerkleNode(left, right, data) {
  if (!left && !right) {
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    return new MerkleNode(null, null, hash);
  } else {
    const prevHashes = left.data + right.data;
    const hash = crypto.createHash('sha256').update(prevHashes).digest('hex');
    return new MerkleNode(left, right, hash);
  }
}

function newMerkleTree(data) {
  let nodes = [];

  if (data.length % 2 !== 0) {
    data.push(data[data.length - 1]);
  }

  data.forEach(dat => {
    const node = newMerkleNode(null, null, dat);
    nodes.push(node);
  });

  while (nodes.length > 1) {
    const level = [];

    for (let i = 0; i < nodes.length; i += 2) {
      const left = nodes[i];
      const right = nodes[i + 1];
      const node = newMerkleNode(left, right, null);
      level.push(node);
    }

    nodes = level;
  }

  const tree = new MerkleTree();
  tree.rootNode = nodes[0];

  return tree;
}


module.exports = {
    newMerkleNode,
    newMerkleTree
}