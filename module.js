import { getRabbitConnection } from './rabbit-connection';
import { getMongoConnection } from './mongo-connection';
import winston from 'winston';
import * as Transactions from './db';

function sendResponseToMsg(ch, msg, data) {
  return ch.sendToQueue(
    msg.properties.replyTo,
    new Buffer(JSON.stringify(data)),
    { correlationId: msg.properties.correlationId }
  );
}

Promise
// wait for connection to RabbitMQ and MongoDB
  .all([getRabbitConnection(), getMongoConnection()])
  // create channel rabbit
  .then(([conn, db]) => Promise.all([conn.createChannel(), db]))
  .then(([ch, db]) => {
    // create topic
    ch.assertExchange('events', 'topic', { durable: true });
    // create queue
    ch.assertQueue('transactions-service', { durable: true })
      .then(q => {
        // fetch by one message from queue
        ch.prefetch(1);
        // bind queue to topic
        ch.bindQueue(q.queue, 'events', 'transactions.*');
        // listen to new messages
        ch.consume(q.queue, msg => {
          let data;

          try {
            // messages always should be JSONs
            data = JSON.parse(msg.content.toString());
          } catch (err) {
            // log error and exit
            winston.error(err, msg.content.toString());
            return;
          }

          // map a routing key with actual logic
          switch (msg.fields.routingKey) {
            case 'transactions.load':
              Transactions.load(db) // logic call
                .then(transactions => sendResponseToMsg(ch, msg, transactions)) // send response to queue
                .then(() => ch.ack(msg)); // notify queue message was processed
              break;
            case 'transactions.update':
              Transactions.update(db, data) // logic call
                .then(transaction => sendResponseToMsg(ch, msg, transaction)) // send response to queue
                .then(() => ch.ack(msg)); // notify queue message was processed
              break;
            case 'transactions.create':
              Transactions.create(db, data) // logic call
                .then(transaction => sendResponseToMsg(ch, msg, transaction)) // send response to queue
                .then(() => ch.ack(msg)); // notify queue message was processed
              break;
            case 'transactions.delete':
              Transactions.remove(db, data) // logic call
                .then(transaction => sendResponseToMsg(ch, msg, transaction)) // send response to queue
                .then(() => ch.ack(msg)); // notify queue message was processed
              break;
            default:
              // if we can't process this message, we should send it back to queue
              ch.nack(msg);
              return;
          }
        });
      });
  });
