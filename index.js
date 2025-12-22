const jwt = require('jsonwebtoken');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const port = process.env.PORT || 3000;
const app = express();
app.use(cors());
app.use(express.json())


app.post('/jwt', async (req, res) => {
  const user = req.body; // Usually { email: 'user@example.com' }
  const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
  res.send({ token });
});

// Middleware to verify JWT Token
const verifyToken = (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send({ message: 'unauthorized access' });
  }

  const token = req.headers.authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'unauthorized access' });
    }

    req.decoded = decoded;

    next();
  });
};


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
    const blogCollection = database.collection("blogs")
    const fundingCollection = database.collection("funding")

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


    // Update the donation request
    app.patch("/update-donation-request/:id", async (req, res) => {
      const id = req.params.id;
      const updatedData = req.body;
      const filter = { _id: new ObjectId(id) };

      const updateDoc = {
        $set: {
          recipientName: updatedData.recipientName,
          recipientDistrict: updatedData.recipientDistrict,
          recipientUpazila: updatedData.recipientUpazila,
          hospitalName: updatedData.hospitalName,
          fullAddress: updatedData.fullAddress,
          bloodGroup: updatedData.bloodGroup,
          donationDate: updatedData.donationDate,
          donationTime: updatedData.donationTime,
          requestMessage: updatedData.requestMessage,
        },
      };

      const result = await donationCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Change status to inprogress
    app.patch("/donation-requests/donate/:id", async (req, res) => {
      const id = req.params.id;
      const { donorName, donorEmail } = req.body;
      const filter = { _id: new ObjectId(id) };

      const updateDoc = {
        $set: {
          donorName: donorName,
          donorEmail: donorEmail,
          status: "inprogress",
        },
      };

      const result = await donationCollection.updateOne(filter, updateDoc);
      res.send(result);
    });


    // Update Donation Status (Done, Canceled, In-progress, etc.)
    app.patch('/donation-requests/status/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;

      const filter = { _id: new ObjectId(id) };

      const updatedDoc = {
        $set: {
          status: status
        },
      };

      try {
        const result = await donationCollection.updateOne(filter, updatedDoc);
        if (result.modifiedCount > 0) {
          res.send(result);
        } else {
          res.status(404).send({ message: "No changes made or request not found" });
        }
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Internal Server Error" });
      }
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


    // admin apis

    //  middle ware before allowing admin activity
    const verifyAdmin = async (req, res, next) => {

      const email = req.decoded.email;

      const query = { email: email };
      const user = await userCollection.findOne(query);

      const isAdmin = user?.role === 'admin';

      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }

      next();
    };


    // The verifyVolunteer Middleware
    const verifyVolunteer = async (req, res, next) => {
      const email = req.decoded.email;
      const user = await userCollection.findOne({ email });
      if (user?.role === 'admin' || user?.role === 'volunteer') {
        next();
      } else {
        return res.status(403).send({ message: 'forbidden access' });
      }
    };

    //Get all users (with optional status filter)
    app.get("/users", async (req, res) => {
      const status = req.query.status;
      let query = {};
      if (status && status !== 'all') {
        query.status = status;
      }
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });

    //Change User Role (Admin/Volunteer/Donor)
    app.patch("/users/role/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const { role } = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = { $set: { role: role } };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    //Change User Status (active/blocked)
    app.patch("/users/status/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = { $set: { status: status } };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });


    // Check if a user is an admin
    app.get('/users/admin/:email', verifyToken, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      let admin = false;
      if (user) {
        admin = user?.role === 'admin';
      }
      res.send({ admin });
    });
    // search functionality
    app.get("/donor-search", async (req, res) => {
      try {
        const { bloodGroup, district, upazila } = req.query;
        let query = {
          role: "donor",
          status: "active"
        };

        if (bloodGroup && bloodGroup !== "") query.bloodGroup = bloodGroup;
        if (district && district !== "") query.district = district;
        if (upazila && upazila !== "") query.upazila = upazila;

        const result = await userCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Search failed" });
      }
    });


    app.get("/all-pending-requests", verifyToken, async (req, res) => {
      try {
        const query = { status: 'pending' };
        const result = await donationCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Internal Server Error" });
      }

    });


    app.get("/admin-stats", verifyToken, verifyAdmin, async (req, res) => {
      const totalUsers = await userCollection.countDocuments();
      const totalRequests = await donationCollection.countDocuments();
      const successfulDonations = await donationCollection.countDocuments({ status: 'done' });
      const pendingRequests = await donationCollection.countDocuments({ status: 'pending' });
      res.send({
        totalUsers,
        totalRequests,
        successfulDonations,
        pendingRequests
      });
    });


    // Create a new blog post
    app.post('/blogs', verifyToken, async (req, res) => {
      const blogData = req.body;

      const newBlog = {
        ...blogData,
        status: 'draft',
        createdAt: new Date()
      };

      try {
        const result = await blogCollection.insertOne(newBlog);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to create blog" });
      }
    });

    // Protected route for Admin/Volunteer
    app.get("/all-blogs", verifyToken, verifyVolunteer, async (req, res) => {
      const result = await blogCollection.find().toArray();
      res.send(result);
    });


    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

    // 1. Create Payment Intent
    app.post('/create-payment-intent', verifyToken, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100); // Stripe works in cents

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({ clientSecret: paymentIntent.client_secret });
    });

    // 2. Save Funding Info
    app.post('/fundings', verifyToken, async (req, res) => {
      const funding = req.body;
      const result = await fundingCollection.insertOne(funding);
      res.send(result);
    });

    // 3. Get All Funding (For the table)
    app.get('/fundings', verifyToken, async (req, res) => {
      const result = await fundingCollection.find().toArray();
      res.send(result);
    });


    // server/index.js

    app.get('/admin-stats', verifyToken, verifyAdmin, async (req, res) => {
      const payments = await fundingCollection.aggregate([
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$amount' }
          }
        }
      ]).toArray();

      const totalRevenue = payments.length > 0 ? payments[0].totalRevenue : 0;

      const users = await userCollection.estimatedDocumentCount();
      const donationRequests = await donationCollection.estimatedDocumentCount();
      const blogCount = await blogCollection.estimatedDocumentCount();

      res.send({
        totalRevenue,
        users,
        donationRequests,
        blogCount
      });
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