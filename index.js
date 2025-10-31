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
    // Connect the client to the server
    await client.connect();
    const usersCollection = client.db('FinoteDB').collection('users');
    const calculationCollection = client.db('FinoteDB').collection('calculations');
    const incomeHistoryCollection = client.db('FinoteDB').collection('incomeHistorys');
    const expenseHistoryCollection = client.db('FinoteDB').collection('expenseHistorys');
    const categoryCollection = client.db('FinoteDB').collection('category');


    app.get('/',(req,res)=> {
    res.send("Hello world from server");
    });

    //get income expense

    app.get('/get-income-expense/:userId',async(req,res)=> {
        const userId = req.params.userId;
        const now = new Date();
        const month = now.getMonth()+1; //1-12
        const year = now.getFullYear();

        const userData = await calculationCollection.findOne({userId});
        // no user create a data;
        if(!userData) {
            const newData = {
                userId,
                amount: [{balance:0,expense:0,month,year}]
            };
            await calculationCollection.insertOne(newData);
            return res.send(newData.amount[0]);
        }

        // check for current month

        const currentMonth = userData.amount.find(a=> a.month === month && a.year === year);

        //if found
        if(currentMonth){
            return res.send(currentMonth);
        }

        //if not found , calculate previos month remaining money if exists .. then 

        const index = (userData?.amount?.length || 0) - 1;
        // no previous
        if(index<0){
            const newMonth = {balance:0 ,expense:0, month,year};
            await calculationCollection.updateOne(
                {userId},
                {$push:{ amount: newMonth}}
            );
            return res.send(newMonth);

        }
        // has previous month
        else {
            const lastEntry = userData?.amount[index];
            const remaining = (lastEntry.balance || 0) - (lastEntry.expense||0);

            const newMonth = {balance: remaining ,expense:0, month,year};
            await calculationCollection.updateOne(
                {userId},
                {$push:{ amount: newMonth}}
            );
            return res.send(newMonth);

        }




    });

    //get top 10 expense category history for this month

    app.get('/get-top10-expense-history/:userId',async(req,res)=> {
        const userId = req.params.userId;
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        const number = parseInt(req.query.number) || 10;

        try{
            const userInExpenseHistory = await expenseHistoryCollection.findOne({userId});

            if(userInExpenseHistory){
                const expenses = userInExpenseHistory.expenseHistory || [];
                const currentMonthExpenses = expenses.filter(expense => {
                    const date = new Date(expense.date);
                    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
                })

                const categoryTotals = {};
                currentMonthExpenses.forEach(expense => {
                    const category = expense.category || 'Uncategorized';
                    const amount = parseInt(expense.amount) || 0;
                    const fill = expense.fill || '#000';

                    if(!categoryTotals[category]){
                        categoryTotals[category] = {total:0,fill};
                    }
                    categoryTotals[category].total += amount;
                });

                if(number===-1){
                    const sortedCategories = Object.entries(categoryTotals).map(([category, {total,fill}]) => ({category,total,fill})).sort((a,b) => b.total - a.total);
                    res.send(sortedCategories);
                }
                else{
                    const sortedCategories = Object.entries(categoryTotals).map(([category, {total,fill}]) => ({category,total,fill})).sort((a,b) => b.total - a.total).slice(0,number);
                    res.send(sortedCategories);
                }
                
            }
            else{
                res.send([]);
            }

        }
        catch{
            res.status(500).send({message: 'server error'});
        }
    });

    //get daily expenses this month with query for all or 10 expenses with pagination

    // app.get('/get-daily-expense/:userId',async(req,res)=> {
    //     const userId = req.params.userId;
    //     const {count} = req.query;

    //     // if -1 then get all data else get the specific number of data
    //     const dataCount = parseInt(count);
    //     try{
    //         const userData = await expenseHistoryCollection.findOne({userId});

    //         if(userData){
    //             const expenseData = 
    //         }
    //         else{
    //             res.send([]);
    //         }
    //     }
    //     catch{

    //     }
    // });


    //get the categories of user 

    app.get('/get-category/:userId',async(req,res)=> {
        const userId = req.params.userId;

        
        try{
            const existingUser = await categoryCollection.findOne({userId});
            if(existingUser){
                const categories = existingUser.categories;
                res.send(categories);
            }
            else{
                
                await categoryCollection.insertOne({
                    userId,
                    categories: ['Food','Cloth','Grocery'],
                })

                res.send(['Food','Cloth','Grocery']);
            }
        }

        catch{

        }
    });


    //get daily expense .. current month and previos month

    app.get('/get-daily-expense/:userId', async(req,res)=>{

        const userId = req.params.userId;

        try{
            const userData = await expenseHistoryCollection.findOne({userId});
            const expenses = userData?.expenseHistory || [];

            const now = new Date();
            const currentMonth = now.getMonth(); // 0 index 
            const currentYear = now.getFullYear();
            const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
            const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

            // helper → get daily totals for given month/year
            const getDailyTotals = (month, year) => {
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const dailyTotals = Array.from({ length: daysInMonth }, (_, i) => ({
                fullDate: `${year}-${String(month + 1).padStart(2, "0")}-${String(
                i + 1
                ).padStart(2, "0")}`,
                total: 0,
            }));

            // sum expenses by day
            expenses.forEach((exp) => {
                const d = new Date(exp.date);
                if (d.getMonth() === month && d.getFullYear() === year) {
                const day = d.getDate();
                dailyTotals[day - 1].total += Number(exp.amount) || 0;
                }
            });

            return dailyTotals;
            };

            // get current and previous month data
            const currentMonthData = getDailyTotals(currentMonth, currentYear);
            const prevMonthData = getDailyTotals(prevMonth, prevYear);

            // align both months to same number of days (for chart or comparison)
            const maxDays = Math.max(currentMonthData.length, prevMonthData.length);
            const result = Array.from({ length: maxDays }, (_, i) => ({
            date: currentMonthData[i]?.fullDate || `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`,
            currentMonth: currentMonthData[i]?.total || 0,
            prevMonth: prevMonthData[i]?.total || 0,
            }));

            res.send(result);

        }

        catch{
            res.status(500).send({ message: "Server error" });
        }


    });


    //get expense data  by month 

    app.get('/get-expense-data/:userId',async(req,res)=>{
        const userId = req.params.userId;
        const limit = parseInt(req.query.limit)||10;
        const page = parseInt(req.query.page)||0;
        const month = parseInt(req.query.month);
        const year = parseInt(req.query.year);
        const search = req.query.search?.toLowerCase() || "";


        try{
            const skip = page * limit;
            const userData = await expenseHistoryCollection.findOne({userId});

            if(!userData || !userData.expenseHistory){
                return res.send({pagination:[],count:0});
            };

            //filter expenses by month and year 

            let filtered = userData.expenseHistory.filter((expense)=> {
                const date = new Date(expense.date);
                return (
                    date.getMonth() + 1 === month && date.getFullYear() === year
                );
            });

            //apply search 

            if(search){
                filtered = filtered.filter((expense)=>{
                    const name = expense?.name?.toLowerCase() || "";
                    const category = expense?.category?.toLowerCase() || "";
                    const description = expense?.description?.toLowerCase() || "";
                    return (
                        name.includes(search) ||
                        category.includes(search) ||
                        description.includes(search)
                    );
                });
            }


             // Sort by date (latest first)
            const sorted = filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

            //apply pagination 
            const pagination = sorted.slice(skip,skip+limit);
            res.send({pagination,count:pagination.length});
        }

        catch{
            res.status(500).send({ message: 'Server error' });
        }

    });

    //get income data by month

    app.get('/get-income-data/:userId',async(req,res)=>{
        const userId = req.params.userId;
        const limit = parseInt(req.query.limit)||10;
        const page = parseInt(req.query.page)||0;
        const month = parseInt(req.query.month);
        const year = parseInt(req.query.year);
        const search = req.query.search?.toLowerCase() || "";


        try{
            const skip = page * limit;
            const userData = await incomeHistoryCollection.findOne({userId});

            if(!userData || !userData.incomeHistory){
                return res.send({pagination:[],count:0});
            };

            //filter income by month and year 

            let filtered = userData.incomeHistory.filter((income)=> {
                const date = new Date(income.createdAt);
                return (
                    date.getMonth() + 1 === month && date.getFullYear() === year
                );
            });

            //apply search 

            if(search){
                filtered = filtered.filter((income)=>{
                    const name = income?.name?.toLowerCase() || "";

                    return (
                        name.includes(search)
                    );
                });
            }


             // Sort by date (latest first)
            const sorted = filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

            //apply pagination 
            const pagination = sorted.slice(skip,skip+limit);
            res.send({pagination,count:pagination.length});
        }

        catch{
            res.status(500).send({ message: 'Server error' });
        }

    });

    //get expense summury of last 6 month 

    app.get('/get-expense-summary/:userId',async(req,res)=> {
        const userId = req.params.userId;

        try{
            const now = new Date();
            let currentMonth = now.getMonth() + 1;
            let currentYear = now.getFullYear();

            // Array of last 6 months (current + previous 5)
            const months = [];
            for (let i = 0; i < 6; i++) {
                months.unshift({ month: currentMonth, year: currentYear });
                currentMonth--;
                if (currentMonth === 0) {
                    currentMonth = 12;
                    currentYear--;
                }
            }

            // Month names 
            const monthNames = [
                "January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"
                ];

            
            const userData = await calculationCollection.findOne({ userId });

            if(!userData || !Array.isArray(userData?.amount)){
                const result = months.map((m) => ({
                    month: monthNames[m.month - 1],
                    expense: 0,
                }))
                return res.send(result);
            }

            //if user and data is available 

            const result = months.map(({month,year})=> {
                const match = userData?.amount.find(
                    (item) => item.month === month && item.year === year
                );
                return {
                    month: monthNames[month-1],
                    expense:match ? match.expense : 0,
                };
            });
            res.send(result);
        }

        catch{
            res.status(500).send({ message: "Internal server error" });
        }
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
        const {name , amount,color} = req.body;

        const incomeData = {
            name,
            amount:parseInt(amount),
            fill:color,
            createdAt : new Date(),
        }

        try{
            const income = await incomeHistoryCollection.findOne({userId});
            const calculate = await calculationCollection.findOne({userId});

            const now = new Date();
            const month = now.getMonth()+1; // 1–12
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

        const {name,amount,description,color,category} = req.body;

        const data = {
            name,
            amount:parseInt(amount),
            description,
            category,
            fill:color,
            date: new Date()
        }

        try{
            const existingUser = await expenseHistoryCollection.findOne({userId});

            const calculate = await calculationCollection.findOne({userId});

            const now = new Date();
            const month = now.getMonth()+1; // 1–12
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


    //add category 
    
    app.post('/add-category/:userId',async(req,res)=> {
        const userId = req.params.userId;
        const {category} = req.body;

        try{
            const existingUser = await categoryCollection.findOne({userId});
            if(existingUser){
                const updateCategory = await categoryCollection.findOneAndUpdate(
                    {userId},
                    {$push: {categories: category}},
                    {new:true}
                )
                res.send(updateCategory);
            }
            else{
                const newCategory = await categoryCollection.insertOne({
                    userId,
                    categories: [category],
                })

                res.send(newCategory);
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