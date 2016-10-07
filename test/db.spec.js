import chai from 'chai';
import { MongoClient, ObjectId } from 'mongodb';
import * as Transactions from '../db';

chai.should();

let db;

before(() => MongoClient.connect('mongodb://localhost:27017/testing')
  .then(conn => {
    db = conn;
  })
);

describe('Transactions Service', () => {
  const transactions = [
    { _id: new ObjectId() },
    { _id: new ObjectId() },
    { _id: new ObjectId() },
  ];

  before(() => db.collection('transactions').insert(transactions));

  after(() => db.collection('transactions').remove({}));

  it(
    'should load transactions from database',
    () => Transactions.load(db)
      .then(res => {
        res.should.have.length(3);
      })
  );

  it(
    'should update transaction in database',
    () => Transactions.update(db, Object.assign({}, { _id: transactions[0]._id, title: 'test' }))
      .then(res => {
        res.should.have.property('title').equal('test');
      })
  );

  it(
    'should create transaction in database',
    () => Transactions.create(db, Object.assign({}, { title: 'test' }))
      .then(res => {
        res.should.have.property('title').equal('test');
      })
  );
});
