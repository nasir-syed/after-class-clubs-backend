import { MongoClient } from 'mongodb';
import dotenv from 'dotenv'

// load environment variables from .env file
dotenv.config()

// MongoDB connection URI for local MongoDB instance
const connectionURL = process.env.MONGODB_URI;

// function to connect to MongoDB locally and return the collection
export async function connectToMongoDB(databaseName, collectionName) {
    try {
      // create a new MongoClient
      const client = new MongoClient(connectionURL);
  
      // connect to MongoDB
      await client.connect();
    
      // access the database and collection 
      const database = client.db(databaseName);
      const collection = database.collection(collectionName);
  
      return collection;
    } catch (error) {

      // show any errors that may occur in connecting to mongoDB
      console.error('error occurred in connecting to MongoDB:', error);
      throw error;
    }
  }