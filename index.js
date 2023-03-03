const express = require('express');
const cors = require('cors');
const app=express();
require('dotenv').config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const jwt  = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port =process.env.PORT || 5000;


//middleware
app.use(cors());
app.use(express.json());


//mongodb connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.qcvnypp.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });




function verifyJWT(req,res,next){
 const authHeader =  req.headers.authorization;
 if(!authHeader){
  return res.status(401).send('unauthorized access');
 }
 const token = authHeader.split(' ')[1];


 jwt.verify(token,process.env.ACCESS_TOKEN,function(err,decoded){
  if(err){
    return res.status(403).send({message:'forbidden access'})
  }
  req.decoded = decoded;
  next();
 })
}

//find multiple documents
async function run(){
 try{
    const appointmentsectionCollection = client.db('hairSalon').collection('appointmentsection');

    const bookingsCollection =client.db('hairSalon').collection('bookings');
    const usersCollection =client.db('hairSalon').collection('users');
    const specialistsCollection =client.db('hairSalon').collection('specialists');
    const paymentsCollection =client.db('hairSalon').collection('payments');





      // NOTE: make sure you use verifyAdmin after verifyJWT
      const verifyAdmin = async (req, res, next) =>{
        const decodedEmail = req.decoded.email;
        const query = { email: decodedEmail };
        const user = await usersCollection.findOne(query);

        if (user?.role !== 'admin') {
            return res.status(403).send({ message: 'forbidden access' })
        }
        next();
    }

    

   //use aggrigate to query multiple collection and merge data

   //appointsection service server code
    app.get('/appointmentsection',async(req,res)=>{
      const date=req.query.date;
        const query ={};//to get all the data
        const sections = await appointmentsectionCollection.find(query).toArray();
        
        //get the bookings of the provided date
        const bookingQuery={appointmentDate:date
        }
        const alreadyBooked=await bookingsCollection.find(bookingQuery).toArray();
  
        //to get  available alreadybooked bookings
        sections.forEach(section=>{
          const sectionBooked=alreadyBooked.filter(book=>book.service=== section.name);

          const bookedSlots = sectionBooked.map(book=>book.slot);
         
          //remailing slots
          const remainingSlots=section.slots.filter(slot=>!bookedSlots.includes(slot));  //give the data which sots are not booked availaable 
          section.slots=remainingSlots;
          console.log(date,section.name,remainingSlots.length);
          
        })

        res.send(sections);

    })






    // to get the exact name field from the  specialist section
 app.get('/appointmentSpeciality' ,async (req,res)=>{
  const query ={}
  const result = await appointmentsectionCollection.find(query).project({name:1}).toArray();
  res.send(result);
 })

 //to get the specialist data
app.get('/specialists',verifyJWT, verifyAdmin, async(req,res)=>{
  const query = {};
  const specialist = await specialistsCollection.find(query).toArray();
  res.send(specialist);

})

app.post('/specialists', verifyJWT,verifyAdmin, async (req,res)=>{
  const specialist = req.body;
  const result = await specialistsCollection.insertOne(specialist);
  res.send(result);
  
 
 
})


  /***
   * ApI naming convention
   
   * bookings
   * app.get('/bookings/') all bookings to get
   * app.get('/bookings/:id') specifice id booking
   * app.post('/bookings')   new booking new object
   * app.patch('bookings/:id') update specific id
   * app.delete('/bookings/:id') delete specific delete
   */


  //to get the my appointment code through email field
  app.get('/bookings', verifyJWT, async (req, res) => {
    const email = req.query.email;
    const decodedEmail = req.decoded.email;

    if (email !== decodedEmail) {
        return res.status(403).send({ message: 'forbidden access' });
    }

    const query = { email: email };
    const bookings = await bookingsCollection.find(query).toArray();
    res.send(bookings);
})


//modal to submit booking and give one booking at a time

app.post('/bookings',async(req,res)=>{
  const booking= req.body
  const query ={
    appointmentDate:booking.appointmentDate,
    email:booking.email,
    service: booking.service
  }

const alreadyBooked = await bookingsCollection.find(query).toArray();

if(alreadyBooked.length){
  const message= `You already have a appointment on ${booking.appointmentDate}`
  return res.send({acknowledged:false,message})
}

  const result = await bookingsCollection.insertOne(booking);
  res.send(result);
 });

app.get('/bookings/:id', async(req,res)=>{
  const id = req.params.id;
  
  const query = {_id: new  ObjectId(id)};
  const booking = await bookingsCollection.findOne(query)
  res.send(booking);

})


   



   

   app.post('/create-payment-intent', async (req, res) => {
    const booking = req.body;
    const price = booking.price;
    const amount = price * 100;

    const paymentIntent = await stripe.paymentIntents.create({
        currency: 'usd',
        amount: amount,
        "payment_method_types": [
            "card"
        ]
    });
    res.send({
        clientSecret: paymentIntent.client_secret,
    });
});


app.post('/payments', async (req, res) =>{
  const payment = req.body;
  const result = await paymentsCollection.insertOne(payment);
  const id = payment.bookingId
  const filter = {_id: new ObjectId(id)}
  const updatedDoc = {
      $set: {
          paid: true,
          transactionId: payment.transactionId
      }
  }
  const updatedResult = await bookingsCollection.updateOne(filter, updatedDoc)
  res.send(result);
})



  //to generate  token
   app.get('/jwt', async (req, res) => {
    const email = req.query.email;
    const query = { email: email };
    const user = await usersCollection.findOne(query);
    if (user) {
        const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '1h' })
        return res.send({ accessToken: token });
    }
    res.status(403).send({ accessToken: '' })
});


//to load all the users
app.get('/users',async(req,res)=>{
  const query = {};
  const users = await usersCollection.find(query).toArray();
  res.send(users);
});


// to check if this user is admin or not
app.get('/users/admin/:email', async(req,res)=>{
  const email = req.params.email;
  const query ={email}
  const user = await usersCollection.findOne(query);
  res.send({isAdmin: user?.role === 'admin'});

})






   //to get the information of the user

   app.post('/users', async (req, res) => {
    const user = req.body;
    console.log(user);
    const result = await usersCollection.insertOne(user);
    res.send(result);
});



//to make admin and update it
app.put('/users/admin/:id',verifyJWT,verifyAdmin, async(req,res)=>{


  
  const decodedEmail = req.decoded.email;
 
  const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true };
  const  updatedDoc ={
    $set:{
      role:'admin'
    }
  }
  const result = await usersCollection.updateOne(filter,updatedDoc,options);
  res.send(result);
});


// app.get('/addPrice', async (req,res)=>{
//   const filter ={}
//   const options = { upsert: true };
//   const  updatedDoc ={
//     $set:{
//       price:500
//     }
//   }
//   const result = await appointmentsectionCollection.updateMany(filter,updatedDoc,options);
//   res.send(result);

// })




app.delete('/specialists/:id',verifyJWT,verifyAdmin, async(req,res)=>{
  const id = req.params.id;
  const filter = {_id:new ObjectId(id)};
  const result = await specialistsCollection.deleteOne(filter);
  res.send(result);
   })

   
   app.delete('/users/:id',verifyJWT,verifyAdmin, async(req,res)=>{
    const id = req.params.id;
    const filter = {_id:new ObjectId(id)};
    const result = await usersCollection.deleteOne(filter);
    res.send(result);
     })
 

 }
 finally{

 }
}
run().catch(console.log);



app.get('/',async(req,res)=>{
    res.send('hair salon portal working')
})

app.listen(port,()=> console.log(`Hair salon portal running on ${port}`))