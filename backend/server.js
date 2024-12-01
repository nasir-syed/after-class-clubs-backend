import express from 'express';
import dotenv from 'dotenv';
import { ObjectId } from 'mongodb';
import { connectToMongoDB } from './dbconnection.js';
import cors from "cors"
import path from "path"
import { fileURLToPath } from 'url';

dotenv.config({path: "./.env"})


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename)

const app = express();
app.use(cors());
const port = process.env.PORT || 3000;

app.use(express.json());

app.use('/images', express.static(path.join(__dirname, 'images')));

app.use((request, response, next) => {
    const curTime = new Date().toISOString();
    console.log(`${curTime} ${request.method} request: ${request.url}`)
    next();
})

app.get('/products', async (req, res) => {
    try {
        const collection = await connectToMongoDB('afterClassClubs', 'Products');
        const products = await collection.find().toArray(); 
        res.json(products); 
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ message: 'Failed to fetch products' });
    }
});


app.post('/orders', async (req, res) => {
    try {
        const { name, phone, totalPrice, order } = req.body;

        if (!name || !phone) {
            return res.status(400).json({ message: 'Name and phone are required' });
        }

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

        res.status(201).json({ message: 'Order created successfully', orderId: result.insertedId });
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ message: 'Failed to create order' });
    }
});

app.put('/products/updateAvailability', async (req, res) => {
    try {
        const { cart } = req.body;

        
        if (!Array.isArray(cart) || cart.length === 0) {
            return res.status(400).json({ message: 'Cart must be a non-empty array' });
        }

        const productsCollection = await connectToMongoDB('afterClassClubs', 'Products');

        
        const productCount = cart.reduce((acc, product) => {
            if (acc[product._id]) {
                acc[product._id] += 1; 
            } else {
                acc[product._id] = 1; 
            }
            return acc;
        }, {});

        
        const updatePromises = Object.keys(productCount).map(async (productId) => {
            
            const product = await productsCollection.findOne({ _id: new ObjectId(productId) });

            if (!product) {
                return res.status(404).json({ message: `Product with _id ${productId} not found` });
            }

            const currentAvailability = product.availability || 0;
            const quantityToDeduct = productCount[productId]; 

            if (currentAvailability < quantityToDeduct) {
                return res.status(400).json({ message: `Not enough availability for product with _id ${productId}` });
            }
 
            return productsCollection.updateOne(
                { _id: new ObjectId(productId) },
                { $inc: { availability: -quantityToDeduct } } 
            );
        });

        
        await Promise.all(updatePromises);

        res.json({ message: 'Product availability updated successfully' });
    } catch (error) {
        console.error('Error updating product availability:', error);
        res.status(500).json({ message: 'Failed to update product availability' });
    }
});

app.get('/search', async (req, res) => {
    try {
        const { query } = req.query;

        if (!query) {
            return res.status(400).json({ message: 'Search query is required' });
        }
 
        const collection = await connectToMongoDB('afterClassClubs', 'Products');

        const regexQuery = new RegExp(query, 'i');
        const clubs = await collection.find({
            $or: [
                { name: { $regex: regexQuery } },
                { location: { $regex: regexQuery } },
                { price: { $regex: regexQuery } },
                { availability: { $regex: regexQuery } }
            ]
        }).toArray();

        res.json(clubs);
    } catch (error) {
        console.error('Error searching clubs:', error);
        res.status(500).json({ message: 'Failed to search clubs' });
    }
});




app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
