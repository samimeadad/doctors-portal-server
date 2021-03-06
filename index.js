const express = require( 'express' );
const app = express();
const cors = require( 'cors' );
const admin = require( "firebase-admin" );
require( 'dotenv' ).config()
const port = process.env.PORT || 5002;
const { MongoClient } = require( 'mongodb' );
const ObjectId = require( 'mongodb' ).ObjectId;
const stripe = require( 'stripe' )( process.env.STRIPE_SECRET );
const fileUpload = require( 'express-fileupload' );

const serviceAccount = JSON.parse( process.env.FIREBASE_SERVICE_ACCOUNT );

admin.initializeApp( {
    credential: admin.credential.cert( serviceAccount )
} );


//middleware
app.use( cors() );
app.use( express.json() );
app.use( fileUpload() );

const uri = `mongodb+srv://${ process.env.DB_USER }:${ process.env.DB_PASS }@cluster0.iezc6.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient( uri, { useNewUrlParser: true, useUnifiedTopology: true } );

async function verifyToken ( req, res, next ) {
    if ( req?.headers?.authorization.startsWith( 'Bearer ' ) ) {
        const token = req?.headers?.authorization?.split( ' ' )[ 1 ];

        try {
            const decodedUser = await admin.auth().verifyIdToken( token );
            req.decodedEmail = decodedUser.email;
            // next();
        }
        catch {
            // res.status( 401 ).json( { error: 'Unauthorized' } );
        }
    }
    next();
}

const run = async () => {
    try {
        await client.connect();
        console.log( 'Connected to MongoDB Database' );
        const database = client.db( 'doctors_portal' );
        const appointmentsCollection = database.collection( 'appointments' );
        const usersCollection = database.collection( 'users' );
        const doctorsCollection = database.collection( 'doctors' );

        app.get( '/appointments', verifyToken, async ( req, res ) => {
            const email = req.query.email;
            const date = req.query.date;
            const query = { email: email, date: date };
            const cursor = appointmentsCollection.find( query );
            const appointments = await cursor.toArray();
            res.json( appointments );
        } )

        app.get( '/appointments/:id', async ( req, res ) => {
            const id = req.params.id;
            const query = { _id: ObjectId( id ) };
            const result = await appointmentsCollection.findOne( query );
            res.json( result );
        } )

        app.post( '/appointments', async ( req, res ) => {
            const appointment = req.body;
            const result = await appointmentsCollection.insertOne( appointment );
            res.json( result );
        } )

        app.put( '/appointments/:id', async ( req, res ) => {
            const id = req.params.id;
            const payment = req.body;
            const query = { _id: ObjectId( id ) };
            const updateDoc = {
                $set: {
                    payment: payment
                }
            };
            const result = await appointmentsCollection.updateOne( query, updateDoc );
            res.json( result );
        } )

        app.get( '/users/:email', async ( req, res ) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne( query );
            let isAdmin = false;
            if ( user?.role === 'admin' ) {
                isAdmin = true;
            }
            res.json( { admin: isAdmin } );
        } )

        app.post( '/users', async ( req, res ) => {
            const user = req.body;
            const result = await usersCollection.insertOne( user );
            console.log( result );
            res.json( result );
        } )

        app.put( '/users', async ( req, res ) => {
            const user = req.body;
            const query = { email: user.email };
            const options = { upsert: true };
            const updateDoc = { $set: user };
            const result = await usersCollection.updateOne( query, updateDoc, options );
            res.json( result );
        } )

        app.put( '/users/admin', verifyToken, async ( req, res ) => {
            const user = req.body;
            console.log( user );
            const requester = req.decodedEmail;
            if ( requester ) {
                const requesterAccount = await usersCollection.findOne( { email: requester } );

                if ( requesterAccount.role === 'admin' ) {
                    const query = { email: user.adminEmail };
                    const updateDoc = { $set: { role: 'admin' } };
                    const result = await usersCollection.updateOne( query, updateDoc );
                    res.json( result );
                }
            }
            else {
                res.status( 403 ).json( { error: 'You don not have authority to make admin' } );
            }
        } )

        app.post( '/create-payment-intent', async ( req, res ) => {
            const paymentInfo = req.body;
            const amount = paymentInfo.price * 100;
            const paymentIntent = await stripe.paymentIntents.create( {
                currency: 'usd',
                amount: amount,
                payment_method_types: [ 'card' ]
            } )
            res.json( { clientSecret: paymentIntent.client_secret } )
        } )

        app.post( '/doctors', async ( req, res ) => {
            const name = req.body.name;
            const email = req.body.email;
            const image = req.files.image;
            const imageData = image.data;
            const encodeImage = imageData.toString( 'base64' );
            const imageBuffer = Buffer.from( encodeImage, 'base64' );
            const doctor = {
                name,
                email,
                image: imageBuffer
            }
            const result = await doctorsCollection.insertOne( doctor );
            res.json( result );
        } )

        app.get( '/doctors', async ( req, res ) => {
            const cursor = doctorsCollection.find( {} );
            const doctors = await cursor.toArray();
            res.json( doctors );
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