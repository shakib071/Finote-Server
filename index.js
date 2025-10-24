const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express()
require('dotenv').config();
const cors = require('cors');
const port = 5000 
const admin = require("firebase-admin");



// middleware

app.use(cors());
app.use(express.json());


const { DB_USER , DB_PASS } = process.env;

const uri = `mongodb+srv://${DB_USER}:${DB_PASS}@cluster0.chkr6fi.mongodb.net/?appName=Cluster0`;


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});








async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const usersCollection = client.db('FinoteDB').collection('users');
    const calculationCollection = client.db('FinoteDB').collection('calculations');
    const incomeHistoryCollection = client.db('FinoteDB').collection('incomeHistorys');


    app.get('/',(req,res)=> {
    res.send("Hello world from server");
    });

    app.post('/users',async(req,res)=> {
        const {username,email,photoURL,uid} = req.body;

        try{
            const existingUser = await usersCollection.findOne({email});

            if(existingUser){
                return res.status(200).send({message: 'User Already exists'});
            }
            const newUser = {
                uid,
                email,
                username,
                photoURL,
                createdAt: new Date(),
            };

            const result = await usersCollection.insertOne(newUser);
            res.send(result);
        }
        catch(error) {
            res.status(500).send({message: 'server error'});
        }
    });




    app.post('/add-income/:userId', async(req,res) => {
        const userId = req.params.userId;
        const {name , amount} = req.body;

        const incomeData = {
            name,
            amount,
            createdAt : new Date(),
        }

        try{
            const income = await incomeHistoryCollection.findOne({userId});
            // const calculate = await calculationCollection.findOne({userId});

            // if(calculate){
                
            // }

            // else{
            //     const newCalculate = await calculationCollection.insertOne({
            //         userId,
            //         balance: parseInt(amount),
            //         expense: 0,
            //     })
            // }

            if(income){
                const updateIncome = await incomeHistoryCollection.findOneAndUpdate(
                    {userId},
                    {$push: {incomeHistory: incomeData}},
                    {new:true}
                )

               res.send(updateIncome);
            }

            else{
                const newIncome = await incomeHistoryCollection.insertOne({
                    userId,
                    incomeHistory: [incomeData],
                })

                res.send(newIncome);
            }
        }

        catch{
          res.status(500).send({ message: "Internal Server Error" });
        }


    });

    
    
    app.listen(port,() => {
        console.log(`Example app listening on port ${port}`);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);