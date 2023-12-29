const { Level } = require('level')

let PATH = require('path');

require('dotenv').config()

let isOpenDB = false;


const createDB = async (path) => {


   while(isOpenDB){
      await new Promise(resolve => setTimeout(resolve, 100));
   }

   let DB;

   await new Promise((resolve, reject) => {
      let dbPath = PATH.join(process.env.DB_PATH, `db/db-${path}`);
      
      isOpenDB = true;

      DB = new Level(dbPath);
  
      DB.open((err) => {
        if (err) {
         resolve(err); 
        } else {
          resolve(DB);
        }
      });
   });
   
   console.log("Database open successfully");

   return DB;
}

const closeDBRes = ()=>{
   isOpenDB = false;
}

const returnPath = (path)=>{
   return PATH.join(process.env.DB_PATH, `db/db-${path}`);
}

module.exports = {
   createDB,
   returnPath,
   closeDBRes,
   LH_KEY:"lh"
}


