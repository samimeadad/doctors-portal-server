const express = require( 'express' );
const app = express();
const cors = require( 'cors' );
require( 'dotenv' ).config()
const port = process.env.PORT || 5001;
const { MongoClient } = require( 'mongodb' );

//middleware
app.use( cors() );
app.use( express.json() );

const uri = `mongodb+srv://${ process.env.DB_USER }:${ process.env.DB_PASS }@cluster0.iezc6.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient( uri, { useNewUrlParser: true, useUnifiedTopology: true } );

const run = async () => {
    try {
        await client.connect();
        console.log( 'Connected to MongoDB Database' );
        const database = client.db( 'doctors_portal' );
        const appointmentsCollection = database.collection( 'appointments' );

        app.get( '/appointments', async ( req, res ) => {
            const email = req.query.email;
            const date = new Date( req.query.date ).toLocaleDateString();
            const query = { email: email, date: date };
            const cursor = appointmentsCollection.find( query );
            const appointments = await cursor.toArray();
            res.json( appointments );
        } )

        app.post( '/appointments', async ( req, res ) => {
            const appointment = req.body;
            const result = await appointmentsCollection.insertOne( appointment );
            console.log( result );
            res.json( result );
        } )
    }
    catch ( err ) {
        console.error( err );
    }
    finally {
        // await client.close();
    }
}

run().catch( console.dir );

app.get( '/', ( req, res ) => {
    res.send( 'Hello Doctors Portal!' )
} )

app.listen( port, () => {
    console.log( `Doctors Portal App Server listening at http://localhost:${ port }` )
} )