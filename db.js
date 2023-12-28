const { Level } = require('level')

let PATH = require('path');

require('dotenv').config()


const createDB = (path) => {
   let dbPath = PATH.join(process.env.DB_PATH, `db/db-${path}`);   

   let DB = new Level(dbPath);

   DB.open();
   
   return DB;
}

const returnPath = (path)=>{
   return PATH.join(process.env.DB_PATH, `db/db-${path}`);
}

module.exports = {
   createDB,
   returnPath,
   LH_KEY:"lh"
}


