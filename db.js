const { Level } = require("level");

let PATH = require("path");

require("dotenv").config();

let isOpenDB = false;

const createDB = async (path, needToWrite) => {
  console.log("needToWrite", needToWrite);
  let DB;
  let dbPath = PATH.join(process.env.DB_PATH, `db/db-${path}`);

  if (needToWrite) {
    while (isOpenDB) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    await new Promise((resolve, reject) => {
      isOpenDB = true;

      DB = new Level(dbPath);

      DB.open((err) => {
        if (err) {
          console.log("errerrerrerrerrerrerrerrerrerr", err);
          resolve(err);
        } else {
          resolve(DB);
        }
      });
    });
  } else {
    DB = new Level(dbPath);
  }

  console.log("Database open successfully");

  return DB;
};

const closeDBRes = () => {
  isOpenDB = false;
};

const returnPath = (path) => {
  return PATH.join(process.env.DB_PATH, `db/db-${path}`);
};

module.exports = {
  createDB,
  returnPath,
  closeDBRes,
  LH_KEY: "lh",
};
