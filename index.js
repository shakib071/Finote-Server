const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express()
require('dotenv').config();
const cors = require('cors');
const port = 5000 
const admin = require("firebase-admin");
// const cron = require("node-cron");
// const axios = require("axios");




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
    const expenseHistoryCollection = client.db('FinoteDB').collection('expenseHistorys');


    app.get('/',(req,res)=> {
    res.send("Hello world from server");
    });


    //add user to database 

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


    //add income in database . also update the monthly income from calculation callection

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
            const calculate = await calculationCollection.findOne({userId});

            const now = new Date();
            const month = now.getMonth()+1; // 0–11
            const year = now.getFullYear();


            if(calculate){
                const existingMonthIndex = calculate.amount.findIndex(
                    (item) => item.month === month && item.year === year
                );

                // if month and year data already in database update only the balance and expense
                if(existingMonthIndex !== -1){
                    await calculationCollection.updateOne(
                        { userId, "amount.month": month, "amount.year": year },
                        {
                        $inc: {
                        "amount.$.balance": parseInt(amount), // add to balance

                        },
                        }
                    );
                }

                //else add a new data 
                else{
                    const data = {
                        balance: parseInt(amount),
                        expense: 0,
                        month: new Date().getMonth()+1, // 0 index 
                        year : new Date().getFullYear(),
                    }

                    await calculationCollection.updateOne(
                        {userId},
                        {
                            $push: {amount: data},
                        }
                    )
                }


            }

            else{

                const data = {
                    balance: parseInt(amount),
                    expense: 0,
                    month: new Date().getMonth()+1, // 1 index 
                    year : new Date().getFullYear(),
                }
                const newCalculate = await calculationCollection.insertOne({
                    userId,
                    amount : [data],
                })
            }

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

    //add expesnse in database . also update the monthly expense from calculation callection
    
    app.post('/add-expense/:userId', async(req,res) => {
        const userId = req.params.userId;

        const {name,amount,description} = req.body;

        const data = {
            name,
            amount,
            description,
            date: new Date()
        }

        try{
            const existingUser = await expenseHistoryCollection.findOne({userId});

            const calculate = await calculationCollection.findOne({userId});

            const now = new Date();
            const month = now.getMonth()+1; // 0–11
            const year = now.getFullYear();


            if(calculate){
                const existingMonthIndex = calculate.amount.findIndex(
                    (item) => item.month === month && item.year === year
                );

                // if month and year data already in database update only the expense
                if(existingMonthIndex !== -1){
                    await calculationCollection.updateOne(
                        { userId, "amount.month": month, "amount.year": year },
                        {
                        $inc: {
                        "amount.$.expense": parseInt(amount), // expense

                        },
                        }
                    );
                }

                //else add a new data 
                else{
                    const data = {
                        balance: 0,
                        expense: parseInt(amount),
                        month: new Date().getMonth()+1, // 0 index 
                        year : new Date().getFullYear(),
                    }

                    await calculationCollection.updateOne(
                        {userId},
                        {
                            $push: {amount: data},
                        }
                    )
                }


            }

            else{

                const data = {
                    balance: 0,
                    expense: parseInt(amount),
                    month: new Date().getMonth()+1, // 1 index 
                    year : new Date().getFullYear(),
                }
                const newCalculate = await calculationCollection.insertOne({
                    userId,
                    amount : [data],
                })
            }

            if(existingUser){
                const updateExpense = await expenseHistoryCollection.findOneAndUpdate(
                    {userId},
                    {$push: {expenseHistory: data}},
                    {new:true}
                )

               res.send(updateExpense);
            }
            else{
                const newExpense = await expenseHistoryCollection.insertOne({
                    userId,
                    expenseHistory: [data],
                })

                res.send(newExpense)
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