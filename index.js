const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');


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


    app.get('/appointmentsection',async(req,res)=>{
        const query ={};
        const section = await appointmentsectionCollection.find(query).toArray();
        res.send(section);

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

   app.post('/bookings',async(req,res)=>{
    const booking= req.body
    console.log(booking);
    const result = await bookingsCollection.insertOne(booking);
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