const express = require('express');
const cors = require('cors');
require('dotenv').config();

const port = process.env.PORT || 3000;
const app = express();
app.use(cors());
app.use(express.json())


const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@hero.3n4q6b5.mongodb.net/?appName=Hero`;

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
    // await client.connect();

    const database = client.db('blooddonationdb')
    const userCollection = database.collection('user')
    const donationCollection = database.collection('donationRequests');



    // create user
    app.post('/users', async (req, res) => {
      const userInfo = req.body;
      userInfo.role = "Donor";
      userInfo.createdAt = new Date();

      const result = await userCollection.insertOne(userInfo);
      res.send(result)
    })

    //create donation requests
    app.post("/donation-requests", async (req, res) => {
      const requestData = req.body;
      const user = await userCollection.findOne({ email: requestData.requesterEmail })
      if (user?.status === 'blocked') {
        return res.status(403).send({ message: "Blocked users cannot create requests." });
      }
      const newRequest = {
        ...requestData,
        status: "pending",
        createdAt: new Date()
      };
      const result = await donationCollection.insertOne(newRequest);
      res.send(result)
    })

    // get a single donation request
    app.get("/donation-requests/recent/:email", async (req, res) => {
      const email = req.params.email;
      const query = { requesterEmail: email };


      const result = await donationCollection.find(query)
        .sort({ createdAt: -1 })
        .limit(3)
        .toArray();

      res.send(result);
    });

    //  set query for pagination
    app.get("/donation-requests/my-requests/:email", async (req, res) => {
      const email = req.params.email;
      const filterStatus = req.query.status;
      const page = parseInt(req.query.page) || 0;
      const size = parseInt(req.query.size) || 5;

      let query = { requesterEmail: email };

      if (filterStatus && filterStatus !== 'all') {
        query.status = filterStatus;
      }

      const result = await donationCollection.find(query)
        .sort({ createdAt: -1 })
        .skip(page * size)
        .limit(size)
        .toArray();

      const count = await donationCollection.countDocuments(query);

      res.send({ result, count });
    });


    //Get a single donation request to fill the update form
    app.get("/donation-request/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await donationCollection.findOne(query);
      res.send(result);
    });

    // get a single user
    app.get('/users/:email', async (req, res) => {
      try {
        const email = req.params.email;


        if (!userCollection) {
          return res.status(500).send({ message: "Database not initialized" });
        }

        const query = { email: email };
        const result = await userCollection.findOne(query);
        if (!result) {
          return res.status(404).send({ message: "User not found in database" });
        }

        res.send(result);
      } catch (error) {
        console.error("Backend Error at /users/:email :", error);
        res.status(500).send({ message: "Internal Server Error", error: error.message });
      }
    });

    app.patch('/users/:email', async (req, res) => {
      const email = req.params.email;
      const updatedData = req.body;
      delete updatedData.email;

      const query = { email: email };
      const updateDoc = {
        $set: {
          name: updatedData.name,
          avatar: updatedData.avatar,
          bloodGroup: updatedData.bloodGroup,
          district: updatedData.district,
          upazila: updatedData.upazila,
        },
      };

      try {
        const result = await userCollection.updateOne(query, updateDoc);
        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "User not found" });
        }
        res.send(result);
      } catch (error) {
        console.error("Database Error:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {


  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send("Hello,its Blood Donation app")
});
app.listen(port, () => {
  console.log(`Server is running on ${port}`)
});