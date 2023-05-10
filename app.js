import express from "express"
import * as dotenv from 'dotenv'
import {AMQPClient} from "@cloudamqp/amqp-client";
import * as appRootDir from "app-root-dir"
import path from "path"
const rootDir = appRootDir.get()

dotenv.config({path: path.join(rootDir, "config.env")})
const app = express()

app.use("/", (req, res, next) => {
    res.status(200).json({Message: "You are at home"})
})
app.listen(process.env.PORT, function () {
    console.log(`App is running on port ${process.env.PORT}`)
    startPublisher()
    setTimeout(() => {
        startConsumer()
    }, 3000);
})

async function startPublisher() {
    try {
        const cloudAMQPURL = process.env.CLOUDAMQP_URL;
        const connection = new AMQPClient(cloudAMQPURL)
        await connection.connect()
        const channel = await connection.channel()
        console.log("[✅] Connection over channel established")

        // Declare exchange and queue, and create binding
        await channel.exchangeDeclare("emails", "direct")
        let q = await channel.queueDeclare("email.notifications")
        await channel.queueBind("email.notifications", "emails", "notification")

        async function sendToQueue(routingKey, email, name, body) {
            let message = {email, name, body}
            let jsonMessage = JSON.stringify(message)
            //amqp-client function expects: publish(exchange, routingKey, message, options)
            await channel.basicPublish('emails', "notification", jsonMessage)
            console.log("[📥] Message sent to queue", message)
        }

        //Send some messages to the queue
        sendToQueue("notification", "mohammadtavassolian3@gmail.com", "mohammad", "Hi this is a test")
    } catch (error) {
        console.log(error);
        setTimeout(() => {
            startPublisher()
        }, 3000)
    }
}

async function startConsumer() {
    try {
        //Setup a connection to the RabbitMQ server
        const cloudAMQPURL = process.env.CLOUDAMQP_URL
        const connection = new AMQPClient(cloudAMQPURL)
        await connection.connect()
        let channel = await connection.channel()
        console.log("[✅] Connection over channel established")

        const q = await channel.queue("email.notifications")
        let counter = 0
        const consumer = await q.subscribe({noAck: false}, async (msg) => {
            try {
                console.log(`[📤] Message received (${++counter})`, msg.bodyToString())
                msg.ack()
            } catch (error) {
                console.log(error);
                startConsumer()
            }
        })

    } catch (error) {
        console.log(error);
        startConsumer()
    }
}


