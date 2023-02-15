const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const jwt  = require('jsonwebtoken');


require('dotenv').config();
const port =process.env.PORT || 5000;

const app=express();

app.use(cors());
app.use(express.json());





const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.qcvnypp.mongodb.net/?retryWrites=true&w=majority`;


const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


async function run(){
 try{
    const appointmentsectionCollection = client.db('hairSalon').collection('appointmentsection');

    const bookingsCollection =client.db('hairSalon').collection('bookings');
    const usersCollection =client.db('hairSalon').collection('users');

    

   //use aggrigate to query multiple collection and merge data
    app.get('/appointmentsection',async(req,res)=>{
      const date=req.query.date;
        const query ={};
        const sections = await appointmentsectionCollection.find(query).toArray();

        //get the bookings of the provided date
        const bookingQuery={appointmentDate:date
        }
        const alreadyBooked=await bookingsCollection.find(bookingQuery).toArray();

        

        //code carefully
        sections.forEach(section=>{
          const sectionBooked=alreadyBooked.filter(book=>book.service=== section.name);
          const bookedSlots = sectionBooked.map(book=>book.slot);
         
          const remainingSlots=section.slots.filter(slot=>!bookedSlots.includes(slot));
          section.slots=remainingSlots;
          console.log(date,section.name,remainingSlots.length);
          
        })

        res.send(sections);

    })






  /***
   * ApI naming convention
   
   * bookings
   * app.get('/bookings/')
   * app.get('/bookings/:id')
   * app.post('/bookings')
   * app.patch('bookings/:id')
   * app.delete('/bookings/:id')
   */

  app.get('/bookings',async(req,res)=>{
    const email = req.query.email;
    const query ={email:email};
    const bookings = await bookingsCollection.find(query).toArray();
    res.send(bookings);

  })

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






   app.post('/users', async (req, res) => {
    const user = req.body;
    console.log(user);
    const result = await usersCollection.insertOne(user);
    res.send(result);
});

 }
 finally{

 }
}
run().catch(console.log);



app.get('/',async(req,res)=>{
    res.send('hair salon portal working')
})

app.listen(port,()=> console.log(`Hair salon portal running on ${port}`))