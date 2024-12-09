import express from 'express';
import dotenv from 'dotenv';
import { ObjectId } from 'mongodb';
import { connectToMongoDB } from './dbconnection.js';
import cors from "cors"
import path from "path"
import { fileURLToPath } from 'url';

// load environment variables from .env file
dotenv.config({path: "./.env"})

// make the express app, use cors to prevent errors 
const app = express();
app.use(cors());

// the port the server will run on 
const port = process.env.PORT || 3000;

// middleware that will parse incoming JSON requests
app.use(express.json());

// serve static files from the "images" folder 
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename)
app.use('/images', express.static(path.join(__dirname, 'images')));

// logger middeware 
app.use((request, response, next) => {
    const curTime = new Date().toISOString();
    console.log(`${curTime} ${request.method} request: ${request.url}`)
    next();
})

// GET route to fetch all the products/clubs from the mongoDB database and send them in JSON format  
app.get('/products', async (req, res) => {
    try {
        const collection = await connectToMongoDB('afterClassClubs', 'Products');
        const products = await collection.find().toArray(); 
        res.json(products); 
    } catch (error) {
        console.error('error fetching the products:', error);
        res.status(500).json({ message: 'failed to fetch the products' });
    }
});

// POST route to make an order with the provided name, phone, total price, and cart
app.post('/orders', async (req, res) => {
    try {
        const { name, phone, totalPrice, order } = req.body;

        if (!name || !phone) {
            return res.status(400).json({ message: 'name and phone are required' });
        }

        //  reducing the structure of each item to only have its _id and name 
        const reducedOrder = order.map(item => ({
            _id: new ObjectId(item._id), 
            name: item.name
        }));

        const ordersCollection = await connectToMongoDB('afterClassClubs', 'Orders');
        const result = await ordersCollection.insertOne({
            name,
            phone,
            totalPrice,
            order: reducedOrder,
            date: new Date()
        });

        res.status(201).json({ message: 'order created successfully!', orderId: result.insertedId });
    } catch (error) {
        console.error('error in creating the order:', error);
        res.status(500).json({ message: 'failed to create the order' });
    }
});


// PUT route to update the availability of the products that were purchased 
app.put('/products/updateAvailability', async (req, res) => {
    try {
        const { cart } = req.body;

        
        if (!Array.isArray(cart) || cart.length === 0) {
            return res.status(400).json({ message: 'cart must not be a empty array' });
        }

        const productsCollection = await connectToMongoDB('afterClassClubs', 'Products');
        // productCount object made which has the product id as the key and the number of times it appears as the value 
        const productCount = cart.reduce((acc, product) => {
            if (acc[product._id]) {
                acc[product._id] += 1; 
            } else {
                acc[product._id] = 1; 
            }
            return acc;
        }, {});

        // update each of the product's availability according to the number of times it appeared in the cart 
        const updatePromises = Object.keys(productCount).map(async (productId) => {
            
            const product = await productsCollection.findOne({ _id: new ObjectId(productId) });

            if (!product) {
                return res.status(404).json({ message: `Product with _id ${productId} not found` });
            }

            const currentAvailability = product.availability || 0;

            if (currentAvailability < productCount[productId]) {
                return res.status(400).json({ message: `not enough availability for product with _id ${productId}` });
            }
 
            return productsCollection.updateOne(
                { _id: new ObjectId(productId) },
                { $inc: { availability: -productCount[productId] } } 
            );
        })
        
        // wait for each of the products availability to be updated 
        await Promise.all(updatePromises);

        res.json({ message: 'product availability updated successfully!' });
    } catch (error) {
        console.error('error updating the products availability:', error);
        res.status(500).json({ message: 'failed to update product availability' });
    }
});

// GET route for search 
app.get('/search', async (req, res) => {
    try {
        const { query } = req.query;

        if (!query) {
            return res.status(400).json({ message: 'search query is required' });
        }

        const collection = await connectToMongoDB('afterClassClubs', 'Products');

        // for checking with price and quantity convert to float
        const numQuery = parseFloat(query);

        // a regular expression query is made with the query and "i" would make it case insensitive 
        const regexQuery = new RegExp(query, 'i');

        // search the name and location attributes if they contain the query
        const searchCriteria = {
            $or: [
                { name: { $regex: regexQuery } },
                { location: { $regex: regexQuery } }
            ]
        };
        
        // if the query is not NaN, meaning it is converted to a number, also check in the price and availability fields 
        if (!isNaN(numQuery)) {
            searchCriteria.$or.push({ price: numQuery });
            searchCriteria.$or.push({ availability: numQuery });
        }

        const clubs = await collection.find(searchCriteria).toArray();
        res.json(clubs);

    } catch (error) {
        console.error('error in searching clubs:', error);
        res.status(500).json({ message: 'failed to search clubs' });
    }
});

// start the server 
app.listen(port, () => {
    console.log(`server running on http://localhost:${port}`);
});