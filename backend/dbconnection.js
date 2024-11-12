import { MongoClient } from 'mongodb';
import dotenv from 'dotenv'

// Load environment variables from .env file
dotenv.config();

// MongoDB connection URI for local MongoDB instance
const connectionURL = "mongodb+srv://Syed:b5KM$7dmmS8r@cst3144.wwnij.mongodb.net/";

// Function to connect to MongoDB locally and return the collection
export async function connectToMongoDB(databaseName, collectionName) {
    try {
      // Create a new MongoClient
      const client = new MongoClient(connectionURL);
  
      // Connect to MongoDB
      await client.connect();
    
      // Access the database
      const database = client.db(databaseName);
  
      // Access the collection
      const collection = database.collection(collectionName);
  
      return collection;
    } catch (error) {
      // show any errors that may occur in connecting to mongoDB
      console.error('Error connecting to MongoDB:', error);
      throw error;
    }
  }