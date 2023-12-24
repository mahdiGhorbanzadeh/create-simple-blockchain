const { Level } = require('level')

let PATH = require('path');

require('dotenv').config()


const createDB = (path) => {
   let dbPath = PATH.join(process.env.DB_PATH, `db/db-${path}`);   

   let DB = new Level(dbPath);

   return DB;
}

module.exports = {
   createDB,
   LH_KEY:"lh"
}


