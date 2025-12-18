const express = require('express');
const cors = require('cors');
require('dotenv').config()

const port = process.env.PORT || 3000;
const app = express();
app.use(cors());
app.use(express.json())


app.get('/',(req,res)=>{
    res.send("Hello,its Blood Donation app")
});
app.listen(port,()=>{
    console.log(`Server is running on ${port}`)
});